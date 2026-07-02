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
import { loadConfig, type RefresherConfig } from "./config.js";

/// CompositeFeed.refresh is permissionless and rate-limited to 100 blocks/category. A second call
/// inside the window reverts `RateLimited()` — expected and harmless; we catch and move on.
const compositeFeedAbi = [
  {
    type: "function",
    name: "refresh",
    stateMutability: "nonpayable",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [],
  },
  // Custom errors included so viem decodes the revert by name (RateLimited is expected/benign).
  { type: "error", name: "RateLimited", inputs: [] },
  { type: "error", name: "NotConfigured", inputs: [] },
  { type: "error", name: "NoAccess", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
] as const;

function isRateLimited(err: unknown): boolean {
  return ((err as Error)?.message ?? "").includes("RateLimited");
}

async function refreshCategory(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: RefresherConfig,
  cat: { label: string; id: Hex },
): Promise<void> {
  try {
    // Simulate first so an in-window RateLimited revert never costs gas.
    const { request } = await publicClient.simulateContract({
      address: cfg.compositeFeed,
      abi: compositeFeedAbi,
      functionName: "refresh",
      args: [cat.id],
      account: walletClient.account,
    });
    const txHash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[refresher] ${cat.label}: refreshed (${txHash.slice(0, 10)})`);
  } catch (err) {
    if (isRateLimited(err)) {
      console.log(`[refresher] ${cat.label}: skipped (rate-limited / no change)`);
    } else {
      console.error(`[refresher] ${cat.label}: refresh failed:`, (err as Error).message);
    }
  }
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
    `[refresher] starting — feed=${cfg.compositeFeed} caller=${account.address} interval=${Math.round(cfg.intervalMs / 60000)}min`,
  );

  // Single-shot mode for Vercel/GitHub Actions cron (the platform handles the schedule).
  const oneShot = process.argv.includes("--once") || process.env.REFRESH_ONCE === "true";

  // A broke refresher fails silently for days (txs revert, pm2 still "online") and the feed
  // stale-holds toward the RiskManager freeze — this happened once. Shout while there's runway.
  const LOW_BALANCE_WEI = 5n * 10n ** 18n; // ~75 refreshes of headroom at ~0.067 MNT/tx

  do {
    try {
      const balance = await publicClient.getBalance({ address: account.address });
      if (balance < LOW_BALANCE_WEI) {
        console.error(
          `[refresher] LOW BALANCE: ${(Number(balance) / 1e18).toFixed(3)} MNT — fund ${account.address} or refreshes will stop and the feed will go stale`,
        );
      }
    } catch { /* balance check is best-effort */ }
    for (const cat of cfg.categories) {
      await refreshCategory(publicClient, walletClient, cfg, cat);
    }
    if (oneShot) break;
    await new Promise((r) => setTimeout(r, cfg.intervalMs));
    // eslint-disable-next-line no-constant-condition
  } while (true);
}

main().catch((err) => {
  console.error("[refresher] fatal:", (err as Error).message);
  process.exit(1);
});
