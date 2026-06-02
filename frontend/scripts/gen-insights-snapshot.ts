/**
 * Generate public/insights-snapshot.json — REAL on-chain data for the proof-first /insights page.
 * Reads Mantle Sepolia contracts via viem (no indexer, no hosting). Re-run before the demo.
 *
 * Usage:
 *   tsx scripts/gen-insights-snapshot.ts                          → read chain (public RPC)
 *   SNAPSHOT_RPC_URL=https://… SNAPSHOT_FROM_BLOCK=NNN tsx scripts/gen-insights-snapshot.ts
 *
 * SNAPSHOT_FROM_BLOCK should be the CompositeFeed deploy block for a complete feed history;
 * if getLogs over a huge range fails on the public RPC, feedHistory degrades to a single current
 * point via CompositeFeed.read (script still succeeds).
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, keccak256, toBytes, decodeAbiParameters, type Hex } from "viem";
import { CATEGORIES, type CategoryId } from "../src/lib/mockData";
import type { InsightsSnapshot, SnapCategory, SnapPrediction, SnapReputation } from "../src/lib/snapshot";

const STATUS = ["Committed", "Revealed", "Resolved", "Cancelled", "Forfeited"] as const;
const categories = Object.keys(CATEGORIES) as CategoryId[];

const USD_8DEC: Record<CategoryId, boolean> = {
  METH_APR_24H: false,
  USDY_APY_24H: false,
  AAVE_MANTLE_TVL_24H: true,
};
const scaleFor = (c: CategoryId) => (USD_8DEC[c] ? 1e8 : 1);

const RESOLVER_KEY: Record<CategoryId, string> = {
  METH_APR_24H: "MethAprResolver",
  USDY_APY_24H: "UsdyApyResolver",
  AAVE_MANTLE_TVL_24H: "AaveMantleTvlResolver",
};

const catHash = (label: string): Hex => keccak256(toBytes(label));

const predictionMarketAbi = [
  { type: "function", name: "nextPredictionId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getPrediction", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple", components: [
        { name: "agentId", type: "uint256" }, { name: "categoryId", type: "bytes32" },
        { name: "commitHash", type: "bytes32" }, { name: "value", type: "bytes" },
        { name: "confidence", type: "uint16" }, { name: "contentHash", type: "bytes32" },
        { name: "stake", type: "uint256" }, { name: "commitBlock", type: "uint256" },
        { name: "resolutionBlock", type: "uint256" }, { name: "status", type: "uint8" },
        { name: "score", type: "int256" },
      ],
    }],
  },
] as const;

const agentRegistryAbi = [{
  type: "function", name: "getReputation", stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }, { name: "categoryId", type: "bytes32" }],
  outputs: [{
    type: "tuple", components: [
      { name: "accuracyScore", type: "int256" }, { name: "calibrationScore", type: "int256" },
      { name: "resolvedCount", type: "uint256" }, { name: "lastUpdatedBlock", type: "uint256" },
      { name: "bucketAccuracy", type: "int256[10]" }, { name: "bucketCount", type: "uint256[10]" },
    ],
  }],
}] as const;

const resolverAbi = [{
  type: "function", name: "resolve", stateMutability: "view",
  inputs: [{ name: "predictionValue", type: "bytes" }, { name: "resolutionBlock", type: "uint256" }],
  outputs: [{ name: "outcome", type: "bytes" }],
}] as const;

const yieldAllocatorAbi = [{
  type: "function", name: "getAllocation", stateMutability: "view", inputs: [],
  outputs: [
    { name: "allocMethBps", type: "uint256" }, { name: "allocUsdyBps", type: "uint256" },
    { name: "methYield", type: "uint256" }, { name: "usdyYield", type: "uint256" },
  ],
}] as const;

const riskManagerAbi = [{
  type: "function", name: "riskState", stateMutability: "view",
  inputs: [{ name: "categoryId", type: "bytes32" }], outputs: [{ type: "uint8" }],
}] as const;

const compositeFeedReadAbi = [{
  type: "function", name: "read", stateMutability: "view",
  inputs: [{ name: "categoryId", type: "bytes32" }],
  outputs: [{
    type: "tuple", components: [
      { name: "value", type: "bytes" }, { name: "confidence", type: "uint16" },
      { name: "contributingAgents", type: "uint256" }, { name: "lastUpdatedBlock", type: "uint256" },
    ],
  }],
}] as const;

const compositeFeedRefreshedEvent = {
  type: "event", name: "CompositeFeedRefreshed",
  inputs: [
    { name: "categoryId", type: "bytes32", indexed: true },
    { name: "value", type: "uint256", indexed: false },
    { name: "confidence", type: "uint16", indexed: false },
    { name: "contributorCount", type: "uint256", indexed: false },
    { name: "blockNumber", type: "uint256", indexed: false },
  ],
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Load .env manually so tsx picks up NEXT_PUBLIC_RPC_URL without the Next.js runtime
  try {
    const envPath = resolve(process.cwd(), ".env");
    const { readFileSync: rfs } = await import("node:fs");
    for (const line of rfs(envPath, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* .env optional */ }

  const rpc = process.env.SNAPSHOT_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";
  const deployments = JSON.parse(
    readFileSync(resolve(process.cwd(), "../contracts/deployments/mantle-sepolia.json"), "utf8"),
  ) as Record<string, string> & { chainId: number };

  const chain = {
    id: deployments.chainId ?? 5003,
    name: "Mantle Sepolia",
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  } as const;
  const client = createPublicClient({ chain, transport: http(rpc) });

  const pm = deployments.PredictionMarket as Hex;
  const registry = deployments.AgentRegistry as Hex;
  const block = Number(await client.getBlockNumber());

  const next = Number(await client.readContract({ address: pm, abi: predictionMarketAbi, functionName: "nextPredictionId" }));
  type Raw = { id: number; agentId: number; categoryId: string; value: Hex; confidence: number; status: number; score: bigint; commitBlock: number; resolutionBlock: number };
  const raws: Raw[] = [];
  console.log(`[gen-insights-snapshot] fetching ${next - 1} predictions from chain…`);
  for (let id = 1; id < next; id++) {
    // Small delay to respect public RPC rate limits (Alchemy free tier: ~330 CU/s)
    if (id > 1) await sleep(200);
    const p = (await client.readContract({ address: pm, abi: predictionMarketAbi, functionName: "getPrediction", args: [BigInt(id)] })) as {
      agentId: bigint; categoryId: Hex; value: Hex; confidence: number; stake: bigint; commitBlock: bigint; resolutionBlock: bigint; status: number; score: bigint;
    };
    raws.push({
      id, agentId: Number(p.agentId), categoryId: p.categoryId.toLowerCase(), value: p.value,
      confidence: p.confidence, status: p.status, score: p.score,
      commitBlock: Number(p.commitBlock), resolutionBlock: Number(p.resolutionBlock),
    });
    if (id % 10 === 0) console.log(`  … fetched prediction ${id}/${next - 1}`);
  }

  const out: InsightsSnapshot = {
    generatedAt: new Date().toISOString(),
    chainId: chain.id,
    block,
    source: "chain",
    allocation: null,
    categories: {} as InsightsSnapshot["categories"],
  };

  try {
    const a = (await client.readContract({ address: deployments.YieldAllocator as Hex, abi: yieldAllocatorAbi, functionName: "getAllocation" })) as readonly [bigint, bigint, bigint, bigint];
    out.allocation = { methBps: Number(a[0]), usdyBps: Number(a[1]) };
  } catch (e) {
    console.warn("[snapshot] allocation read failed:", (e as Error).message);
  }

  for (const cat of categories) {
    const hash = catHash(cat).toLowerCase();
    const scale = scaleFor(cat);
    const resolverAddr = deployments[RESOLVER_KEY[cat]] as Hex;
    const catRaws = raws.filter((r) => r.categoryId === hash);

    const predictions: SnapPrediction[] = [];
    for (const r of catRaws) {
      let low = 0, high = 0;
      if (r.value && r.value !== "0x") {
        try {
          const [lo, hi] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], r.value) as [bigint, bigint];
          low = Number(lo) / scale; high = Number(hi) / scale;
        } catch { /* leave 0 */ }
      }
      let outcome: number | null = null;
      if (r.status === 2 /* Resolved */) {
        try {
          const ob = (await client.readContract({
            address: resolverAddr, abi: resolverAbi, functionName: "resolve",
            args: [r.value && r.value !== "0x" ? r.value : "0x", BigInt(r.resolutionBlock)],
          })) as Hex;
          const [ov] = decodeAbiParameters([{ type: "uint256" }], ob) as [bigint];
          outcome = Number(ov) / scale;
        } catch (e) {
          console.warn(`[snapshot] outcome read failed pred ${r.id}:`, (e as Error).message);
        }
      }
      predictions.push({
        id: r.id, agentId: r.agentId, status: STATUS[r.status] ?? `status${r.status}`,
        low, high, confidence: r.confidence, score: r.status === 2 ? Number(r.score) : null,
        outcome, commitBlock: r.commitBlock, resolutionBlock: r.resolutionBlock,
      });
    }

    const agentIds = [...new Set(catRaws.map((r) => r.agentId))];
    const reputations: SnapReputation[] = [];
    for (const agentId of agentIds) {
      try {
        const rep = (await client.readContract({ address: registry, abi: agentRegistryAbi, functionName: "getReputation", args: [BigInt(agentId), catHash(cat)] })) as {
          accuracyScore: bigint; calibrationScore: bigint; resolvedCount: bigint;
        };
        reputations.push({
          agentId, accuracyScore: Number(rep.accuracyScore),
          calibrationScore: Number(rep.calibrationScore), resolvedCount: Number(rep.resolvedCount),
        });
      } catch (e) {
        console.warn(`[snapshot] reputation read failed agent ${agentId}/${cat}:`, (e as Error).message);
      }
    }

    let feedHistory: SnapCategory["feedHistory"] = [];
    try {
      const logs = await client.getLogs({
        address: deployments.CompositeFeed as Hex,
        event: compositeFeedRefreshedEvent,
        args: { categoryId: catHash(cat) },
        fromBlock: process.env.SNAPSHOT_FROM_BLOCK ? BigInt(process.env.SNAPSHOT_FROM_BLOCK) : 0n,
        toBlock: "latest",
      });
      feedHistory = logs.map((l) => ({
        block: Number(l.args.blockNumber ?? l.blockNumber ?? 0),
        value: Number(l.args.value ?? 0n) / scale,
        confidence: Number(l.args.confidence ?? 0),
        contributors: Number(l.args.contributorCount ?? 0n),
      })).sort((a, b) => a.block - b.block);
    } catch (e) {
      console.warn(`[snapshot] feed logs failed ${cat}:`, (e as Error).message);
    }

    if (feedHistory.length === 0) {
      try {
        const f = (await client.readContract({ address: deployments.CompositeFeed as Hex, abi: compositeFeedReadAbi, functionName: "read", args: [catHash(cat)] })) as {
          value: Hex; confidence: number; contributingAgents: bigint; lastUpdatedBlock: bigint;
        };
        if (f.value && f.value !== "0x") {
          const [v] = decodeAbiParameters([{ type: "uint256" }], f.value) as [bigint];
          const fb = Number(f.lastUpdatedBlock) || block;
          if (Number(v) > 0) {
            feedHistory = [{ block: fb, value: Number(v) / scale, confidence: Number(f.confidence), contributors: Number(f.contributingAgents) }];
          }
        }
      } catch (e) {
        console.warn(`[snapshot] feed read fallback failed ${cat}:`, (e as Error).message);
      }
    }

    let risk: SnapCategory["risk"] = null;
    try {
      const rs = Number(await client.readContract({ address: deployments.RiskManager as Hex, abi: riskManagerAbi, functionName: "riskState", args: [catHash(cat)] }));
      risk = (["Normal", "Caution", "Frozen"][rs] as SnapCategory["risk"]) ?? null;
    } catch (e) {
      console.warn(`[snapshot] risk read failed ${cat}:`, (e as Error).message);
    }

    out.categories[cat] = { reputations, predictions, feedHistory, risk };
  }

  const dir = resolve(process.cwd(), "public");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "insights-snapshot.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  const totalPreds = Object.values(out.categories).reduce((s, c) => s + c.predictions.length, 0);
  console.log(`[gen-insights-snapshot] wrote ${path} @ block ${block} — ${totalPreds} predictions`);
}

main().catch((err) => {
  console.error("[gen-insights-snapshot] failed:", err);
  process.exit(1);
});
