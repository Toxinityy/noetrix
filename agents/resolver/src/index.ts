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

// PythSpotResolver: keeper records the real Pyth print once per resolutionBlock, then anyone resolves.
const pythResolverAbi = [
  {
    type: "function",
    name: "record",
    stateMutability: "payable",
    inputs: [
      { name: "resolutionBlock", type: "uint256" },
      { name: "updateData", type: "bytes[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "recorded",
    stateMutability: "view",
    inputs: [{ name: "resolutionBlock", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  { type: "error", name: "BadPrice", inputs: [] },
  { type: "error", name: "LowConfidence", inputs: [] },
  { type: "error", name: "HorizonNotReached", inputs: [] },
  { type: "error", name: "AlreadyRecorded", inputs: [] },
  { type: "error", name: "NotKeeper", inputs: [] },
  { type: "error", name: "InsufficientFee", inputs: [] },
] as const;

const pythAbi = [
  {
    type: "function",
    name: "getUpdateFee",
    stateMutability: "view",
    inputs: [{ name: "updateData", type: "bytes[]" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

interface Prediction {
  status: number;
  resolutionBlock: bigint;
  categoryId: Hex;
}

/// Fetch a signed price update from Hermes for `feedId` (hex VAAs, 0x-prefixed for viem).
async function fetchHermesUpdate(hermesUrl: string, feedId: Hex): Promise<Hex[]> {
  const id = feedId.startsWith("0x") ? feedId.slice(2) : feedId;
  const url = `${hermesUrl}/v2/updates/price/latest?ids[]=${id}&encoding=hex`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const json = (await res.json()) as { binary?: { data?: string[] } };
  const data = json.binary?.data ?? [];
  if (data.length === 0) throw new Error("hermes returned no update data");
  return data.map((d) => (d.startsWith("0x") ? d : `0x${d}`) as Hex);
}

/// Keeper step for the Pyth spot category: pin the real Pyth price for `rb` once (first write wins).
/// Returns true if the snapshot is (now or already) recorded; false if it couldn't be recorded this
/// tick (stale/low-conf/RPC) — the caller then skips resolve (which would revert NotRecorded) and
/// retries next tick. A permanent failure is handled by PredictionMarket.voidExpired.
async function recordPythSnapshot(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: ResolverConfig,
  rb: bigint,
): Promise<boolean> {
  const pyth = cfg.pyth!;
  try {
    const already = (await publicClient.readContract({
      address: pyth.resolver,
      abi: pythResolverAbi,
      functionName: "recorded",
      args: [rb],
    })) as boolean;
    if (already) return true;

    const updateData = await fetchHermesUpdate(pyth.hermesUrl, pyth.feedId);
    const fee = (await publicClient.readContract({
      address: pyth.pythAddress,
      abi: pythAbi,
      functionName: "getUpdateFee",
      args: [updateData],
    })) as bigint;

    const txHash = await walletClient.writeContract({
      address: pyth.resolver,
      abi: pythResolverAbi,
      functionName: "record",
      args: [rb, updateData],
      value: fee,
      account: walletClient.account!,
      chain: walletClient.chain,
      gas: 3_000_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      console.error(`[resolver] pyth record block ${rb}: tx reverted (${txHash.slice(0, 10)})`);
      return false;
    }
    console.log(`[resolver] recorded Pyth snapshot for block ${rb} (${txHash.slice(0, 10)})`);
    return true;
  } catch (err) {
    console.error(`[resolver] pyth record block ${rb} failed:`, ((err as Error)?.message ?? "").split("\n")[0]);
    return false;
  }
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

  // Redeploy guard: if nextPredictionId reset below our cursor (a fresh PredictionMarket), the stale
  // cursor would early-return forever. Clamp it back so the scan resumes — removes the manual
  // "delete resolver.state.json on redeploy" trap.
  if (state.cursor > Number(nextId)) {
    console.warn(
      `[resolver] cursor ${state.cursor} > nextPredictionId ${Number(nextId)} — market redeployed? resetting cursor to 1`,
    );
    state.cursor = 1;
    saveState({ cursor: 1 });
  }

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
      p = {
        status: Number(raw.status),
        resolutionBlock: BigInt(raw.resolutionBlock),
        categoryId: raw.categoryId,
      };
    } catch (err) {
      console.error(`[resolver] prediction ${id}: read failed:`, (err as Error).message);
      continue;
    }
    statuses.set(id, p.status);

    if (p.status === REVEALED && currentBlock >= p.resolutionBlock) {
      // Pyth spot category: pin the real Pyth snapshot before resolving (keeper-snapshot design).
      if (cfg.pyth && p.categoryId.toLowerCase() === cfg.pyth.categoryId.toLowerCase()) {
        const pinned = await recordPythSnapshot(publicClient, walletClient, cfg, p.resolutionBlock);
        if (!pinned) continue; // resolve would revert NotRecorded; retry next tick
      }
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
  if (cfg.pyth) {
    console.log(
      `[resolver] pyth keeper mode ON — resolver=${cfg.pyth.resolver} feed=${cfg.pyth.feedId.slice(0, 10)}… hermes=${cfg.pyth.hermesUrl}`,
    );
  }

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
