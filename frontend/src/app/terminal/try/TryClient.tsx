"use client";

import * as React from "react";
import Link from "next/link";
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeAbiParameters } from "viem";
import { compositeFeedAbi, categoryHash } from "@/lib/contracts";
import { env, hasFeed, explorerTx } from "@/lib/env";
import { derivePanelState } from "@/lib/tryState";
import { friendlyValue } from "@/lib/labels";
import { fmtUSDCompact } from "@/lib/format";
import type { CategoryId } from "@/lib/mockData";
import { formatRawFeedFields } from "@/lib/feedView";

const CATEGORY_OPTIONS = [
  { id: "METH_APR_24H", name: "mETH staking APR" },
  { id: "USDY_APY_24H", name: "USDY treasury APY" },
  { id: "AAVE_MANTLE_TVL_24H", name: "Aave-Mantle TVL" },
] as const;
type CatId = (typeof CATEGORY_OPTIONS)[number]["id"];

/// Translate a raw on-chain feed integer into a Web2-friendly value for its category.
/// APR/APY categories store basis points (382 -> "3.82%"); TVL stores USD 8-decimal
/// (14200000000000000 -> "$142.3M"). Never show the bare integer as the headline.
function friendlyFeedValue(cat: CatId, raw: bigint): string {
  const n = Number(raw);
  if (cat === "AAVE_MANTLE_TVL_24H") return fmtUSDCompact(n / 1e8);
  return friendlyValue(cat as CategoryId, n);
}

interface FeedRead {
  value: bigint;
  confidence: number;
  contributors: number;
  block: number;
}

function decodeFeed(data: unknown): FeedRead | null {
  if (!data) return null;
  const f = data as { value: `0x${string}`; confidence: number; contributingAgents: bigint; lastUpdatedBlock: bigint };
  let value = BigInt(0);
  try {
    value = decodeAbiParameters([{ type: "uint256" }], f.value)[0] as bigint;
  } catch {
    value = BigInt(0);
  }
  return {
    value,
    confidence: Number(f.confidence),
    contributors: Number(f.contributingAgents),
    block: Number(f.lastUpdatedBlock),
  };
}

export function TryClient() {
  const [selected, setSelected] = React.useState<CatId>("METH_APR_24H");
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const [beforeBlock, setBeforeBlock] = React.useState<number | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting, error: connectError } = useConnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });
  const { writeContractAsync, isPending: writing } = useWriteContract();

  // Hydration-safe mounted flag (wallet state is client-only).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const read = useReadContract({
    address: env.addresses.compositeFeed as `0x${string}`,
    abi: compositeFeedAbi,
    functionName: "read",
    args: [categoryHash(selected)],
    query: { enabled: hasFeed, refetchInterval: 15_000 },
  });
  const feed = decodeFeed(read.data);

  // Per-category 100-block refresh cooldown (CompositeFeed.REFRESH_RATE_LIMIT_BLOCKS). Watch the head
  // block so we can disable Refresh during the cooldown instead of letting a doomed RateLimited tx
  // fire (which surfaces as a confusing generic "reverted" because the wallet's gas-estimate failure
  // doesn't carry the decoded custom-error name).
  const COOLDOWN_BLOCKS = 100;
  const { data: blockNow } = useBlockNumber({ watch: true, query: { enabled: hasFeed } });
  const blocksSinceRefresh =
    feed?.block && blockNow ? Number(blockNow) - feed.block : null;
  const onCooldown =
    blocksSinceRefresh !== null && blocksSinceRefresh >= 0 && blocksSinceRefresh < COOLDOWN_BLOCKS;
  const blocksLeft = onCooldown ? COOLDOWN_BLOCKS - (blocksSinceRefresh ?? 0) : 0;

  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });
  React.useEffect(() => {
    if (receipt.isSuccess) read.refetch();
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = mounted
    ? derivePanelState({ isConnected, chainId, expectedChainId: env.chainId, balanceWei: balance?.value })
    : "disconnected";

  // EIP-6963 discovery can register several injected connectors; pick the injected one explicitly
  // rather than connectors[0] (which is whichever wallet was discovered first). No extension present
  // → send the user to install one instead of firing a connect that throws and silently resets.
  const hasInjectedWallet =
    mounted && typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);

  const handleConnect = () => {
    const connector = connectors.find((c) => c.type === "injected") ?? connectors[0];
    if (connector && hasInjectedWallet) {
      connect({ connector });
      return;
    }
    window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
  };

  const handleRefresh = async () => {
    if (onCooldown) {
      setError(`This feed was just refreshed. Try again in ~${blocksLeft} blocks (~${blocksLeft * 2}s) or pick another category.`);
      return;
    }
    setError(null);
    setTxHash(undefined);
    setBeforeBlock(feed?.block ?? 0);
    try {
      const hash = await writeContractAsync({
        address: env.addresses.compositeFeed as `0x${string}`,
        abi: compositeFeedAbi,
        functionName: "refresh",
        args: [categoryHash(selected)],
      });
      setTxHash(hash);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        msg.includes("RateLimited")
          ? "This feed was just refreshed. Wait ~100 blocks or pick another category."
          : "Transaction rejected or reverted.",
      );
    }
  };

  const catName = CATEGORY_OPTIONS.find((c) => c.id === selected)!.name;
  const rawFields = feed
    ? formatRawFeedFields(
        selected as CategoryId,
        feed.value,
        feed.confidence,
        feed.contributors,
        feed.block,
      )
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12" data-tour="try-refresh">
      <h1 className="text-3xl font-semibold text-[var(--color-text)]">Try it live</h1>
      <p className="mt-3 text-[var(--color-text-dim)]">
        Connect a wallet and write to the live on-chain AI feed on Mantle Sepolia in one transaction, fully
        permissionless. No subscription, no signup.
      </p>

      {/* Category picker */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Category">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected === c.id}
            onClick={() => {
              setSelected(c.id);
              setTxHash(undefined);
              setBeforeBlock(null);
              setError(null);
            }}
            className={
              "rounded border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors " +
              (selected === c.id
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]")
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Live read-only snapshot. Renders in every state. Plain-English headline; the raw
          on-chain integers live behind a "Show on-chain values" toggle. */}
      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          live on-chain feed · {catName}
        </div>
        {!hasFeed ? (
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">
            Feed address not configured in this build (set NEXT_PUBLIC_ADDR_COMPOSITE_FEED).
          </p>
        ) : feed ? (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {catName}
                </div>
                <div className="num mt-0.5 text-2xl font-semibold text-[var(--color-text)]">
                  {friendlyFeedValue(selected, feed.value)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  AI confidence
                </div>
                <div className="num mt-0.5 text-2xl font-semibold text-[var(--color-text)]">
                  {Math.round(feed.confidence / 100)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  Contributors
                </div>
                <div className="num mt-0.5 text-2xl font-semibold text-[var(--color-text)]">
                  {feed.contributors} {feed.contributors === 1 ? "AI agent" : "AI agents"}
                </div>
              </div>
            </div>
            <div className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
              last updated at block {feed.block}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]">
                Show contract details
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs text-[var(--color-text-dim)] sm:grid-cols-4">
                <div>
                  <div className="text-[var(--color-text-muted)]">stored forecast</div>
                  <div>{rawFields?.value}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">stored confidence</div>
                  <div>{rawFields?.confidence}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">included forecasts</div>
                  <div>{rawFields?.contributors}</div>
                </div>
                <div>
                  <div className="text-[var(--color-text-muted)]">last update block</div>
                  <div>{rawFields?.lastUpdatedBlock}</div>
                </div>
              </div>
            </details>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">Reading feed…</p>
        )}
      </div>

      {/* The guided action panel */}
      <div className="mt-4 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-5">
        {!mounted ? (
          <p className="text-sm text-[var(--color-text-dim)]">Loading wallet…</p>
        ) : state === "disconnected" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">
              {hasInjectedWallet
                ? "Connect a wallet to request a real composite refresh on Mantle Sepolia."
                : "No browser wallet detected. Install one (e.g. MetaMask) or open this page in your wallet's browser."}
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                title={connectError ? connectError.message : undefined}
                className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
              >
                {connecting ? "Connecting…" : hasInjectedWallet ? "Connect wallet" : "Install a wallet"}
              </button>
            </div>
            {connectError && (
              <p className="mt-3 text-sm text-[var(--color-warn)]">
                {/rejected|denied|4001/i.test(connectError.message)
                  ? "Connection request was rejected in your wallet."
                  : connectError.message}
              </p>
            )}
          </div>
        ) : state === "wrong-network" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">Step 2: switch your wallet to Mantle Sepolia.</p>
            <button
              type="button"
              onClick={() => switchChain({ chainId: env.chainId })}
              disabled={switching}
              className="mt-4 rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
            >
              {switching ? "Switching…" : "Switch to Mantle Sepolia"}
            </button>
          </div>
        ) : state === "no-gas" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">
              Step 3: you need a little testnet MNT for gas. Grab some, then re-check.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href={env.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"
              >
                Open faucet
              </a>
              <button
                type="button"
                onClick={() => read.refetch()}
                className="rounded border border-[var(--color-border)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              >
                I&apos;ve funded it, re-check
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">
              Step 4: refresh the {catName} feed. One signature writes a fresh consensus on-chain.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={writing || receipt.isLoading || onCooldown}
              className="mt-4 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
            >
              {writing
                ? "Confirm in wallet…"
                : receipt.isLoading
                  ? "Confirming…"
                  : onCooldown
                    ? `Cooling down, ~${blocksLeft} blocks`
                    : "Refresh the live AI feed"}
            </button>
            {onCooldown && (
              <p className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
                Just refreshed. The feed rate-limits to one update per {COOLDOWN_BLOCKS} blocks (~{COOLDOWN_BLOCKS * 2}s).
                Available again in ~{blocksLeft} blocks, or switch category.
              </p>
            )}

            {receipt.isSuccess &&
              txHash &&
              (beforeBlock != null && feed && feed.block === beforeBlock ? (
                // Hold-last-good path: the tx succeeded but no fresh agent forecast was in-window,
                // so the contract kept its last value (lastUpdatedBlock unchanged). Say so — don't
                // claim an update that didn't happen.
                <div className="mt-4 rounded border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/5 p-3 text-sm">
                  <p className="text-[var(--color-warn)]">
                    The feed held its last value — no fresh agent forecasts were in-window for this
                    refresh, so nothing changed on-chain.
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--color-text-dim)]">
                    lastUpdatedBlock unchanged at {beforeBlock}
                  </p>
                  <a
                    href={explorerTx(txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-[var(--color-accent)] hover:underline"
                  >
                    View your transaction ↗
                  </a>
                </div>
              ) : (
                <div className="mt-4 rounded border border-[var(--color-up)]/40 bg-[var(--color-up)]/5 p-3 text-sm">
                  <p className="text-[var(--color-up)]">You just updated the on-chain AI feed.</p>
                  {beforeBlock != null && feed && (
                    <p className="mt-1 font-mono text-xs text-[var(--color-text-dim)]">
                      lastUpdatedBlock {beforeBlock} → {feed.block}
                    </p>
                  )}
                  <a
                    href={explorerTx(txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-[var(--color-accent)] hover:underline"
                  >
                    View your transaction ↗
                  </a>
                </div>
              ))}
            {error && <p className="mt-3 text-sm text-[var(--color-warn)]">{error}</p>}
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/terminal/leaderboard" className="text-sm text-[var(--color-accent)] hover:underline">
          See the agents behind this feed → leaderboard
        </Link>
      </div>
    </div>
  );
}
