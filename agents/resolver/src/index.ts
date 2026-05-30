import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadConfig, type ResolverConfig } from "./config.js";
import { loadState, saveState } from "./state.js";

// PredictionStatus enum (IPredictionMarket): Committed=0, Revealed=1, Resolved=2, Cancelled=3, Forfeited=4.
const REVEALED = 1;
const TERMINAL = new Set([2, 3, 4]);

const predictionMarketAbi = [
  {
    type: "function",
    name: "nextPredictionId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getPrediction",
    stateMutability: "view",
    inputs: [{ name: "predictionId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "categoryId", type: "bytes32" },
          { name: "commitHash", type: "bytes32" },
          { name: "value", type: "bytes" },
          { name: "confidence", type: "uint16" },
          { name: "contentHash", type: "bytes32" },
          { name: "stake", type: "uint256" },
          { name: "commitBlock", type: "uint256" },
          { name: "resolutionBlock", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "score", type: "int256" },
        ],
      },
    ],
  },
] as const;

const resolutionEngineAbi = [
  {
    type: "function",
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [{ name: "predictionId", type: "uint256" }],
    outputs: [],
  },
  // Custom errors so viem decodes reverts by name in logs.
  { type: "error", name: "AlreadyResolved", inputs: [] },
  { type: "error", name: "PredictionNotRevealed", inputs: [] },
  { type: "error", name: "ResolutionBlockNotReached", inputs: [] },
  { type: "error", name: "ScoringEngineNotSet", inputs: [] },
  { type: "error", name: "CategoryNotRegistered", inputs: [] },
] as const;

interface Prediction {
  status: number;
  resolutionBlock: bigint;
}

async function resolveOne(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: ResolverConfig,
  id: bigint,
): Promise<boolean> {
  try {
    // No simulate/estimate-first: the public Mantle RPC load-balances eth_call across nodes that lag
    // the chain head, so a pre-flight call spuriously reverts ResolutionBlockNotReached even when the
    // tx would land. tick() already gates on currentBlock >= resolutionBlock, so we send directly with
    // a fixed gas ceiling (resolve() uses <1M; unused gas is refunded) and trust the receipt status.
    const txHash = await walletClient.writeContract({
      address: cfg.resolutionEngine,
      abi: resolutionEngineAbi,
      functionName: "resolve",
      args: [id],
      account: walletClient.account!,
      chain: walletClient.chain,
      gas: 3_000_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      console.error(`[resolver] prediction ${id}: tx reverted (${txHash.slice(0, 10)})`);
      return false;
    }
    console.log(`[resolver] resolved prediction ${id} (${txHash.slice(0, 10)})`);
    return true;
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (msg.includes("ResolutionBlockNotReached")) {
      console.log(`[resolver] prediction ${id}: not yet at resolution block — will retry`);
    } else {
      console.error(`[resolver] prediction ${id}: resolve failed:`, msg.split("\n")[0]);
    }
    return false;
  }
}

async function tick(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: ResolverConfig,
): Promise<void> {
  const state = loadState();
  const [nextId, currentBlock] = await Promise.all([
    publicClient.readContract({
      address: cfg.predictionMarket,
      abi: predictionMarketAbi,
      functionName: "nextPredictionId",
    }) as Promise<bigint>,
    publicClient.getBlockNumber(),
  ]);

  const last = Number(nextId) - 1;
  if (last < state.cursor) {
    console.log(`[resolver] tick — no predictions yet (cursor=${state.cursor})`);
    return;
  }

  console.log(
    `[resolver] tick — scanning predictions ${state.cursor}..${last} (block ${currentBlock})`,
  );

  const statuses = new Map<number, number>();
  let resolvedCount = 0;

  for (let id = state.cursor; id <= last; id++) {
    let p: Prediction;
    try {
      const raw = (await publicClient.readContract({
        address: cfg.predictionMarket,
        abi: predictionMarketAbi,
        functionName: "getPrediction",
        args: [BigInt(id)],
      })) as Prediction;
      p = { status: Number(raw.status), resolutionBlock: BigInt(raw.resolutionBlock) };
    } catch (err) {
      console.error(`[resolver] prediction ${id}: read failed:`, (err as Error).message);
      continue;
    }
    statuses.set(id, p.status);

    if (p.status === REVEALED && currentBlock >= p.resolutionBlock) {
      const ok = await resolveOne(publicClient, walletClient, cfg, BigInt(id));
      if (ok) {
        statuses.set(id, 2); // now Resolved
        resolvedCount++;
      }
    }
  }

  // Advance the cursor past a contiguous run of terminal predictions from the start.
  let cursor = state.cursor;
  while (cursor <= last && TERMINAL.has(statuses.get(cursor) ?? -1)) cursor++;
  if (cursor !== state.cursor) {
    saveState({ cursor });
    console.log(`[resolver] cursor advanced ${state.cursor} → ${cursor}`);
  }
  if (resolvedCount > 0) console.log(`[resolver] resolved ${resolvedCount} prediction(s) this tick`);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const chain = defineChain({
    id: cfg.chainId,
    name: "Mantle Sepolia",
    nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
  const account = privateKeyToAccount(cfg.privateKey);
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });

  console.log(
    `[resolver] starting — market=${cfg.predictionMarket} engine=${cfg.resolutionEngine} caller=${account.address} interval=${Math.round(cfg.intervalMs / 1000)}s`,
  );

  const oneShot = process.argv.includes("--once") || process.env.RESOLVE_ONCE === "true";

  do {
    try {
      await tick(publicClient, walletClient, cfg);
    } catch (err) {
      console.error(`[resolver] tick failed:`, (err as Error).message);
    }
    if (oneShot) break;
    await new Promise((r) => setTimeout(r, cfg.intervalMs));
    // eslint-disable-next-line no-constant-condition
  } while (true);
}

main().catch((err) => {
  console.error("[resolver] fatal:", (err as Error).message);
  process.exit(1);
});
