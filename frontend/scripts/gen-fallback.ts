/**
 * Generate public/fallback-leaderboard.json — the static dataset the frontend serves when the
 * indexer is unreachable (demo-safety, PRD Prompt 13 Part B).
 *
 * Three sources (first match wins):
 *   CHAIN_RPC=https://…  tsx scripts/gen-fallback.ts   → read reputations straight from chain
 *                                                         (bypasses the flaky local indexer)
 *   INDEXER_URL=https://… tsx scripts/gen-fallback.ts  → pre-fetch live leaderboards from the indexer
 *   (neither)            tsx scripts/gen-fallback.ts   → build from curated mock data
 *
 * The chain path is the demo-reliable one: the chain is the source of truth and only needs to be
 * reachable ONCE to snapshot real agent scores. It throws (never writes an empty/stub file) if the
 * read fails or finds zero scored agents — committing a stub leaderboard silently is the failure
 * mode this guard prevents.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, keccak256, toBytes, defineChain, type Abi } from "viem";
import { AGENTS, CATEGORIES, agentDisplayName, inferKind, type CategoryId } from "../src/lib/mockData";

interface LeaderRow {
  id: number;
  name: string;
  kind: string;
  accuracyScore: number;
  calibrationScore: number;
  resolvedCount: number;
  lastUpdatedBlock: number;
  controller?: string;
}

const categories = Object.keys(CATEGORIES) as CategoryId[];

// Mirrors frontend/src/lib/contracts.ts categoryHash — keccak256 of the raw label bytes.
const categoryHash = (label: string) => keccak256(toBytes(label));

function fromMock(category: CategoryId): LeaderRow[] {
  return AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    accuracyScore: a.reputation[category].accuracyScore,
    calibrationScore: a.reputation[category].calibrationScore,
    resolvedCount: a.reputation[category].resolvedCount,
    lastUpdatedBlock: a.reputation[category].lastUpdatedBlock,
    controller: a.controller,
  })).sort((x, y) => y.accuracyScore - x.accuracyScore);
}

async function fromIndexer(base: string, category: CategoryId): Promise<LeaderRow[]> {
  const res = await fetch(`${base.replace(/\/$/, "")}/leaderboard?category=${category}&limit=50`);
  if (!res.ok) throw new Error(`indexer ${res.status} for ${category}`);
  const json = (await res.json()) as { leaderboard: Array<Record<string, string>> };
  return (json.leaderboard ?? []).map((r) => {
    const id = Number(r.agentId);
    const name = agentDisplayName(id);
    return {
      id,
      name,
      kind: inferKind(name),
      accuracyScore: Number(r.accuracyScore),
      calibrationScore: Number(r.calibrationScore),
      resolvedCount: Number(r.resolvedCount),
      lastUpdatedBlock: Number(r.lastUpdatedBlock),
    };
  });
}

// ── Chain source ────────────────────────────────────────────────────────────────────────────────
const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [] } },
});

// Minimal AgentRegistry surface. getReputation returns the on-chain Reputation struct; we only read
// the four scalar fields the leaderboard shows (bucket arrays are present on-chain but unused here).
const registryAbi = [
  { type: "function", name: "nextAgentId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "controllerOf",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "getReputation",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "accuracyScore", type: "int256" },
          { name: "calibrationScore", type: "int256" },
          { name: "resolvedCount", type: "uint256" },
          { name: "lastUpdatedBlock", type: "uint256" },
          { name: "bucketAccuracy", type: "int256[10]" },
          { name: "bucketCount", type: "uint256[10]" },
        ],
      },
    ],
  },
] as const satisfies Abi;

function registryAddress(): `0x${string}` {
  const env = process.env.ADDR_AGENT_REGISTRY;
  if (env && /^0x[0-9a-fA-F]{40}$/.test(env)) return env as `0x${string}`;
  // fall back to the deployments artifact (resolve from cwd=frontend or repo root)
  for (const p of ["../contracts/deployments/mantle-sepolia.json", "contracts/deployments/mantle-sepolia.json"]) {
    try {
      const json = JSON.parse(readFileSync(resolve(process.cwd(), p), "utf8"));
      const addr = json.AgentRegistry ?? json.contracts?.AgentRegistry;
      if (addr) return addr as `0x${string}`;
    } catch {
      /* try next candidate path */
    }
  }
  throw new Error("AgentRegistry address not found — set ADDR_AGENT_REGISTRY or provide deployments JSON");
}

async function fromChain(rpc: string): Promise<Record<string, LeaderRow[]>> {
  const client = createPublicClient({ chain: mantleSepolia, transport: http(rpc) });
  const registry = registryAddress();
  const next = (await client.readContract({
    address: registry,
    abi: registryAbi,
    functionName: "nextAgentId",
  })) as bigint;
  const lastAgent = Number(next) - 1; // ids are 1..nextAgentId-1
  if (lastAgent < 1) throw new Error("chain read: no agents registered (nextAgentId<=1)");

  const out: Record<string, LeaderRow[]> = {};
  for (const category of categories) {
    const id = categoryHash(category);
    const rows: LeaderRow[] = [];
    for (let agentId = 1; agentId <= lastAgent; agentId++) {
      const rep = (await client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getReputation",
        args: [BigInt(agentId), id],
      })) as {
        accuracyScore: bigint;
        calibrationScore: bigint;
        resolvedCount: bigint;
        lastUpdatedBlock: bigint;
      };
      if (rep.resolvedCount === BigInt(0)) continue; // never scored in this category — skip, like the indexer
      const name = agentDisplayName(agentId);
      rows.push({
        id: agentId,
        name,
        kind: inferKind(name),
        accuracyScore: Number(rep.accuracyScore),
        calibrationScore: Number(rep.calibrationScore),
        resolvedCount: Number(rep.resolvedCount),
        lastUpdatedBlock: Number(rep.lastUpdatedBlock),
      });
    }
    rows.sort((x, y) => y.accuracyScore - x.accuracyScore); // accuracy desc, like /leaderboard
    out[category] = rows;
  }
  return out;
}

async function main() {
  const rpc = process.env.CHAIN_RPC;
  const indexer = process.env.INDEXER_URL;
  const source = rpc ? "chain" : indexer ? "indexer" : "mock";

  const out: { generatedAt: string; source: string; categories: Record<string, LeaderRow[]> } = {
    generatedAt: new Date().toISOString(),
    source,
    categories: {},
  };

  if (rpc) {
    out.categories = await fromChain(rpc);
    const total = Object.values(out.categories).reduce((n, rows) => n + rows.length, 0);
    // Critical-gap guard: never write an empty/stub snapshot. A silent stub looks "live" but isn't.
    if (total === 0) {
      throw new Error("chain read returned 0 scored agents across all categories — refusing to write a stub");
    }
  } else {
    for (const category of categories) {
      out.categories[category] = indexer ? await fromIndexer(indexer, category) : fromMock(category);
    }
  }

  const dir = resolve(process.cwd(), "public");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "fallback-leaderboard.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  const counts = Object.entries(out.categories).map(([c, r]) => `${c}:${r.length}`).join(" ");
  console.log(`[gen-fallback] wrote ${path} (source=${out.source}) ${counts}`);
}

main().catch((err) => {
  console.error("[gen-fallback] failed:", err);
  process.exit(1);
});
