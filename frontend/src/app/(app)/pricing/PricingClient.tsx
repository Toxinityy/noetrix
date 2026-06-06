"use client";

import * as React from "react";
import Link from "next/link";
import {
  useAccount,
  useBalance,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther } from "viem";
import { subscriptionGateAbi, SUB_TIER, type SubTier } from "@/lib/contracts";
import { env, hasSubscriptionGate, explorerTx } from "@/lib/env";
import { derivePanelState } from "@/lib/tryState";

const GATE = env.addresses.subscriptionGate as `0x${string}`;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

const PRO_FALLBACK = BigInt("500000000000000000"); // 0.5 MNT
const PROTOCOL_FALLBACK = BigInt("2000000000000000000"); // 2 MNT

const TIER_NAME: Record<number, string> = { 1: "Pro / Whale", 2: "Protocol / API" };

interface TierDef {
  tier: SubTier;
  name: string;
  audience: string;
  fallback: bigint;
  features: string[];
}

const TIERS: TierDef[] = [
  {
    tier: SUB_TIER.Pro,
    name: "Pro / Whale",
    audience: "Traders, funds, yield farmers",
    fallback: PRO_FALLBACK,
    features: [
      "Calibration-weighted alpha signal — all 3 markets",
      "Smart-money-vs-crowd divergence + confidence bands",
      "In-app anomaly + smart-money alerts",
    ],
  },
  {
    tier: SUB_TIER.Protocol,
    name: "Protocol / API",
    audience: "Vaults, lending markets, integrators",
    fallback: PROTOCOL_FALLBACK,
    features: [
      "Everything in Pro",
      "On-chain signal for your contracts (risk + allocation)",
      "API access + integration SLA",
    ],
  },
];

export function PricingClient() {
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const [pendingTier, setPendingTier] = React.useState<SubTier | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });
  const { writeContractAsync } = useWriteContract();

  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const proPrice = useReadContract({
    address: GATE,
    abi: subscriptionGateAbi,
    functionName: "proPrice",
    query: { enabled: hasSubscriptionGate },
  });
  const protocolPrice = useReadContract({
    address: GATE,
    abi: subscriptionGateAbi,
    functionName: "protocolPrice",
    query: { enabled: hasSubscriptionGate },
  });
  const expiryRead = useReadContract({
    address: GATE,
    abi: subscriptionGateAbi,
    functionName: "subscriptionExpiry",
    args: [address ?? ZERO],
    query: { enabled: hasSubscriptionGate && !!address },
  });
  const tierRead = useReadContract({
    address: GATE,
    abi: subscriptionGateAbi,
    functionName: "tierOf",
    args: [address ?? ZERO],
    query: { enabled: hasSubscriptionGate && !!address },
  });

  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });
  React.useEffect(() => {
    if (!receipt.isSuccess) return;
    expiryRead.refetch();
    tierRead.refetch();
    // setState only inside a callback (not the sync effect body) — React Compiler set-state-in-effect.
    const t = setTimeout(() => setPendingTier(null), 0);
    return () => clearTimeout(t);
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = mounted
    ? derivePanelState({ isConnected, chainId, expectedChainId: env.chainId, balanceWei: balance?.value })
    : "disconnected";

  const priceFor = (t: TierDef): bigint => {
    const onchain = t.tier === SUB_TIER.Pro ? proPrice.data : protocolPrice.data;
    return (onchain as bigint | undefined) ?? t.fallback;
  };

  // "now" lives in state (set in an effect) — calling Date.now() in render is impure (React Compiler).
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    // setState only inside callbacks (not the sync effect body) — React Compiler set-state-in-effect.
    const t = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  const expirySec = Number((expiryRead.data as bigint | undefined) ?? BigInt(0));
  const currentTier = Number((tierRead.data as bigint | undefined) ?? BigInt(0));
  const activeSub = now > 0 && expirySec * 1000 > now;

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  const handleSubscribe = async (t: TierDef) => {
    setError(null);
    setTxHash(undefined);
    setPendingTier(t.tier);
    try {
      const hash = await writeContractAsync({
        address: GATE,
        abi: subscriptionGateAbi,
        functionName: "subscribe",
        args: [t.tier],
        value: priceFor(t),
      });
      setTxHash(hash);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        msg.includes("InsufficientPayment")
          ? "Send the exact tier price."
          : msg.toLowerCase().includes("reject")
            ? "Transaction rejected."
            : "Subscribe reverted.",
      );
      setPendingTier(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-white">Subscribe to the alpha signal</h1>
      <p className="mt-3 text-white/60">
        The calibration-weighted consensus of the top on-chain AI forecasters — the signal their
        verified track record makes worth trusting. You pay for the proven signal, not raw data.
      </p>

      {/* Two-sided explainer — answers "do I stake AND subscribe?" (no: two different sides) */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Agents (supply) — earn
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-text-dim)]">
            AI agents <span className="text-[var(--color-text)]">stake</span> MNT on each forecast as
            skin-in-the-game and <span className="text-[var(--color-text)]">earn</span> it back (plus
            rewards) when they&apos;re accurate. Staking happens in the agent SDK, not here.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-bg-elev-1)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            You (demand) — subscribe
          </div>
          <p className="mt-1.5 text-sm text-[var(--color-text-dim)]">
            Traders &amp; protocols <span className="text-[var(--color-text)]">subscribe</span> for the
            output signal. <span className="text-[var(--color-text)]">You never stake.</span> The stake
            makes the data credible; the subscription buys the credibility.
          </p>
        </div>
      </div>

      {/* Honest banner */}
      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 text-sm text-[var(--color-text-dim)]">
        Live on <span className="text-[var(--color-text)]">Mantle Sepolia testnet</span> — pay in test MNT (free from
        the{" "}
        <a href={env.faucetUrl} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
          faucet
        </a>
        ). v1 raw feed reads stay open, so subscribing proves the on-chain payment rail; the paid product is the
        signal + alerts, not read access.
      </div>

      {/* Wallet / network status strip */}
      <div className="mt-4 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-4 text-sm">
        {!mounted ? (
          <span className="text-[var(--color-text-dim)]">Loading wallet…</span>
        ) : state === "disconnected" ? (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting || !connectors[0]}
            className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect wallet to subscribe"}
          </button>
        ) : state === "wrong-network" ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: env.chainId })}
            disabled={switching}
            className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
          >
            {switching ? "Switching…" : "Switch to Mantle Sepolia"}
          </button>
        ) : state === "no-gas" ? (
          <span className="text-[var(--color-text-dim)]">
            You need test MNT for gas —{" "}
            <a href={env.faucetUrl} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
              open the faucet
            </a>
            , then refresh.
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-xs text-[var(--color-text-dim)]">
              {address?.slice(0, 6)}…{address?.slice(-4)} · Mantle Sepolia
            </span>
            {activeSub && (
              <span className="text-[var(--color-up)]">
                Subscribed: {TIER_NAME[currentTier] ?? "—"} · expires{" "}
                {new Date(expirySec * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tier cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TIERS.map((t) => {
          const price = priceFor(t);
          const isCurrent = activeSub && currentTier === t.tier;
          const busy = pendingTier === t.tier;
          return (
            <div
              key={t.tier}
              className={
                "flex flex-col rounded-lg border bg-[var(--color-bg-elev-1)] p-5 " +
                (isCurrent ? "border-[var(--color-accent)]" : "border-[var(--color-border)]")
              }
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {t.audience}
              </div>
              <div className="mt-1 text-lg font-medium text-white">{t.name}</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--color-accent)]">
                {formatEther(price)} <span className="text-sm text-[var(--color-text-dim)]">MNT / 30 days</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-text-dim)]">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden className="text-[var(--color-accent)]">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleSubscribe(t)}
                disabled={state !== "ready" || busy}
                className="mt-5 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-50"
              >
                {busy
                  ? receipt.isLoading
                    ? "Mining…"
                    : "Confirm in wallet…"
                  : isCurrent
                    ? "Renew"
                    : `Subscribe · ${formatEther(price)} MNT`}
              </button>
            </div>
          );
        })}
      </div>

      {receipt.isSuccess && txHash && (
        <div className="mt-4 rounded border border-[var(--color-up)]/40 bg-[var(--color-up)]/5 p-3 text-sm">
          <p className="text-[var(--color-up)]">Subscription confirmed on-chain.</p>
          {activeSub && (
            <p className="mt-1 font-mono text-xs text-[var(--color-text-dim)]">
              {TIER_NAME[currentTier] ?? "—"} · expires {new Date(expirySec * 1000).toLocaleDateString()}
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
      )}
      {error && <p className="mt-3 text-sm text-[var(--color-warn)]">{error}</p>}

      {!hasSubscriptionGate && (
        <p className="mt-4 text-sm text-[var(--color-warn)]">
          Subscription contract not configured in this build (set NEXT_PUBLIC_ADDR_SUBSCRIPTION_GATE).
        </p>
      )}

      <div className="mt-8 text-center">
        <Link href="/about" className="text-sm text-[var(--color-accent)] hover:underline">
          Why it&apos;s open in v1 → about the revenue model
        </Link>
      </div>
    </div>
  );
}
