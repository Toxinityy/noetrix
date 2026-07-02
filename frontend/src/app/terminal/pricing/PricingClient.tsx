"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useAccount, useConnect, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { env, hasSubscriptionGate, explorerTx } from "@/lib/env";
import { subscriptionGateAbi, SUB_TIER } from "@/lib/contracts";

const CONTACT_URL = "https://github.com/Toxinityy/noetrix";

const TIERS = [
  {
    name: "Pro / Whale",
    audience: "Traders, funds, yield farmers",
    tier: SUB_TIER.Pro,
    fallbackWei: parseEther("0.5"),
    features: [
      "Unlocks the gated anomaly + smart-money alert feed on /insights",
      "Calibration-weighted alpha signal across all markets (open in v1)",
      "Smart-money-vs-crowd divergence + confidence bands (open in v1)",
    ],
  },
  {
    name: "Protocol / API",
    audience: "Vaults, lending markets, integrators",
    tier: SUB_TIER.Protocol,
    fallbackWei: parseEther("2"),
    features: [
      "Everything in Pro",
      "On-chain signal for your contracts (risk + allocation)",
      "API access + integration support",
    ],
  },
] as const;

export function PricingClient() {
  // Hydration-safe mounted flag (wallet state is client-only).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [pendingTier, setPendingTier] = React.useState<number | null>(null);
  const [txHash, setTxHash] = React.useState<`0x${string}` | null>(null);
  const [paidTier, setPaidTier] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const gate = env.addresses.subscriptionGate as `0x${string}`;
  const proPrice = useReadContract({
    address: gate, abi: subscriptionGateAbi, functionName: "proPrice",
    query: { enabled: hasSubscriptionGate },
  });
  const protocolPrice = useReadContract({
    address: gate, abi: subscriptionGateAbi, functionName: "protocolPrice",
    query: { enabled: hasSubscriptionGate },
  });
  const tierOf = useReadContract({
    address: gate, abi: subscriptionGateAbi, functionName: "tierOf", args: [address ?? "0x0"],
    query: { enabled: hasSubscriptionGate && !!address },
  });
  const expiry = useReadContract({
    address: gate, abi: subscriptionGateAbi, functionName: "subscriptionExpiry", args: [address ?? "0x0"],
    query: { enabled: hasSubscriptionGate && !!address },
  });

  const priceWei = (t: (typeof TIERS)[number]) =>
    t.tier === SUB_TIER.Pro
      ? ((proPrice.data as bigint | undefined) ?? t.fallbackWei)
      : ((protocolPrice.data as bigint | undefined) ?? t.fallbackWei);

  const wrongChain = isConnected && chainId !== env.chainId;
  const onChainTier = Number(tierOf.data ?? 0);
  const expiryDate =
    expiry.data && Number(expiry.data) > 0 ? new Date(Number(expiry.data) * 1000) : null;

  const handleConnect = () => {
    const connector = connectors.find((c) => c.type === "injected") ?? connectors[0];
    if (connector && typeof window !== "undefined" && (window as { ethereum?: unknown }).ethereum) {
      connect({ connector });
    } else {
      window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
    }
  };

  const subscribe = async (t: (typeof TIERS)[number]) => {
    setError(null);
    if (!isConnected) return handleConnect();
    if (wrongChain) return switchChain({ chainId: env.chainId });
    setPendingTier(t.tier);
    try {
      const hash = await writeContractAsync({
        address: gate, abi: subscriptionGateAbi, functionName: "subscribe",
        args: [t.tier], value: priceWei(t),
      });
      setTxHash(hash);
      setPaidTier(t.tier);
      tierOf.refetch();
      expiry.refetch();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(msg.includes("User rejected") ? "Payment cancelled." : "Subscription tx reverted.");
    } finally {
      setPendingTier(null);
    }
  };

  const buttonLabel = (t: (typeof TIERS)[number]) => {
    if (!mounted) return "Subscribe";
    if (!isConnected) return "Connect wallet";
    if (wrongChain) return switching ? "Switching…" : "Switch to Mantle Sepolia";
    if (pendingTier === t.tier) return "Confirm in wallet…";
    return `Subscribe · ${formatEther(priceWei(t))} MNT`;
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">Pricing</h1>
        <span className="rounded border border-[var(--color-warn)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warn)]">
          Testnet pilot
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[var(--color-text-dim)]">
        Subscribe on-chain in testnet MNT for access to Noetrix&apos;s calibration-weighted forecast
        signal. Prices are hackathon-demo rates on Mantle Sepolia — target production pricing is
        $500–$2,000/mo.
      </p>

      {hasSubscriptionGate && (
        <p className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          Subscribing sends a <span className="text-[var(--color-text-dim)]">real payable transaction</span> to
          SubscriptionGate — you get a Mantlescan receipt and an on-chain tier + expiry. Feed reads are open
          in v1, so this proves the payment rail; the gated surface today is the{" "}
          <Link href="/terminal/insights" className="text-[var(--color-accent)] hover:underline">
            /insights anomaly signal
          </Link>
          .
        </p>
      )}

      {mounted && onChainTier > 0 && (
        <div
          role="status"
          className="mt-3 rounded border border-[var(--color-up)]/40 bg-[var(--color-up)]/10 px-3 py-2 font-mono text-[11px] text-[var(--color-up)]"
        >
          Active subscription · tier {onChainTier === SUB_TIER.Protocol ? "Protocol" : "Pro"}
          {expiryDate && ` · expires ${expiryDate.toLocaleDateString()}`}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <section
            key={tier.name}
            className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {tier.audience}
            </div>
            <h2 className="mt-1 text-lg font-medium text-[var(--color-text)]">{tier.name}</h2>
            <div className="mt-2 text-2xl font-semibold text-[var(--color-accent)]">
              {formatEther(priceWei(tier))} test MNT{" "}
              <span className="text-sm text-[var(--color-text-dim)]">/ 30 days</span>
            </div>

            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-text-dim)]">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-up)]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            {hasSubscriptionGate ? (
              <button
                type="button"
                onClick={() => subscribe(tier)}
                disabled={pendingTier !== null}
                className="mt-5 flex items-center justify-center gap-2 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50"
              >
                {pendingTier === tier.tier && <Loader2 size={13} className="animate-spin" aria-hidden />}
                {buttonLabel(tier)}
              </button>
            ) : (
              <a
                href={CONTACT_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-5 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"
              >
                Contact us
              </a>
            )}
          </section>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 font-mono text-[11px] text-[var(--color-down)]">
          {error}
        </p>
      )}

      {txHash && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center gap-2 rounded border border-[var(--color-up)]/40 bg-[var(--color-up)]/10 px-3 py-2 font-mono text-[11px] text-[var(--color-up)]"
        >
          Paid on-chain · {paidTier === SUB_TIER.Protocol ? "Protocol" : "Pro"} tier subscribed.
          <a
            href={explorerTx(txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            View tx on Mantlescan <ExternalLink size={11} aria-hidden />
          </a>
        </div>
      )}

      {/* Unit economics — MEASURED on-chain, not estimated. */}
      <section className="mt-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          What it actually costs — measured on-chain
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-3xl font-semibold text-[var(--color-accent)]">233 MNT</span>
          <span className="text-sm text-[var(--color-text-dim)]">
            (~<span className="text-[var(--color-text)]">$98</span>) of gas ran the entire network for 33 days —{" "}
            <span className="text-[var(--color-text)]">9,490</span> on-chain transactions across 9 bot wallets,
            every one verifiable on Mantlescan.
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="font-mono text-lg text-[var(--color-accent)]">~$120/yr</div>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              Projected run-rate after today&apos;s cadence cut. The 5-min feed refresh was{" "}
              <span className="text-[var(--color-text)]">81%</span> of all gas — now hourly, with forecasts
              daily. A $1,000 starter then runs the network for years. Cadence is the dial.
            </p>
          </div>
          <div>
            <div className="font-mono text-lg text-[var(--color-accent)]">Self-funding</div>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              Agents pay their own gas + 0.1 MNT to compete; resolution is permissionless and pays a 2%
              reward, so scoring costs the protocol nothing; slashed stakes pay the winners. The only
              structural cost is the feed refresh.
            </p>
          </div>
          <div>
            <div className="font-mono text-lg text-[var(--color-accent)]">≈ $0 / buyer</div>
            <p className="mt-1 text-sm text-[var(--color-text-dim)]">
              One composite feed serves every subscriber. A single $500/mo plan covers annual infra
              ~50× over — everything above is near-pure margin.
            </p>
          </div>
        </div>

        <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[var(--color-text-muted)]">
          Measured across all 9 bot wallets, 30 May → 2 Jul 2026 (Etherscan V2, chainId 5003). Gas paid in
          testnet MNT; $ values it at the mainnet MNT price (~$0.42) and the gas price the bots actually paid —
          a mainnet-equivalent projection. Live on testnet · no signed customers yet ·{" "}
          <a
            href="https://github.com/Toxinityy/noetrix/blob/master/scripts/gas-audit.mjs"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            verify the measurement (script + wallet list)
          </a>
        </p>
      </section>

      <div className="mt-8 text-center">
        <Link href="/terminal/about" className="text-sm text-[var(--color-accent)] hover:underline">
          How the forecast network works → about
        </Link>
      </div>
    </div>
  );
}
