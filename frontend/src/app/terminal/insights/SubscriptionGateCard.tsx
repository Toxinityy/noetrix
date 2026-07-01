"use client";

import * as React from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { env, hasSubscriptionGate } from "@/lib/env";
import { subscriptionGateAbi } from "@/lib/contracts";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Gates a premium /insights surface behind a REAL on-chain subscription.
 *
 * Reads `SubscriptionGate.tierOf(wallet)`; the surface unlocks when the connected
 * wallet holds a subscription tier (bought with MNT via /pricing). When no gate is
 * configured, children render unconditionally so the page never breaks. This reads
 * the SubscriptionGate only — it does NOT touch the composite-feed reads, so the
 * advisory consumers (DemoFeedConsumer / YieldAllocator / RiskManager) are unaffected.
 */
export function SubscriptionGateCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  const { address } = useAccount();

  const tierRead = useReadContract({
    address: env.addresses.subscriptionGate as `0x${string}`,
    abi: subscriptionGateAbi,
    functionName: "tierOf",
    args: [(address ?? ZERO) as `0x${string}`],
    chainId: env.chainId,
    query: { enabled: hasSubscriptionGate && !!address, refetchInterval: 30_000 },
  });

  // Gate not configured for this deployment → never block.
  if (!hasSubscriptionGate) return <>{children}</>;

  const isSubscribed = !!address && Number(tierRead.data ?? 0) > 0;

  if (isSubscribed) return <>{children}</>;

  const connected = !!address;
  return (
    <Panel elevation={1} className="lg:col-span-2">
      <PanelHeader
        caption="Premium signal"
        title={title}
        right={<StatusPill tone="muted">subscribers only</StatusPill>}
      />
      <PanelBody className="pt-2">
        <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15 text-[var(--color-accent)]">
            <Lock size={15} aria-hidden />
          </span>
          <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
            {caption}{" "}
            {connected
              ? "Your wallet has no active subscription. The gate is enforced on-chain; self-serve checkout is contract-only in this demo."
              : "Connect a subscribed wallet to unlock it (the gate reads SubscriptionGate on-chain)."}
          </p>
          <Link
            href="/terminal/pricing"
            className="inline-flex items-center rounded-md border border-[var(--color-accent)] px-3 py-1.5 font-mono text-[12px] text-[var(--color-accent)] transition-colors hover:bg-[color:var(--color-accent)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            View pricing →
          </Link>
        </div>
      </PanelBody>
    </Panel>
  );
}
