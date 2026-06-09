"use client";

import * as React from "react";
import Link from "next/link";
import { useReadContract } from "wagmi";
import { decodeAbiParameters } from "viem";
import { YieldCard } from "@/components/rwa/YieldCard";
import { DepositSimulator, type SimInputs } from "@/components/rwa/DepositSimulator";
import { HowItWorks } from "@/components/rwa/HowItWorks";
import {
  RWA_LABELS,
  categoryHash,
  compositeFeedAbi,
  yieldAllocatorAbi,
  riskManagerAbi,
} from "@/lib/contracts";
import { env, hasFeed, hasYieldAllocator, hasRiskManager } from "@/lib/env";

// Demo fallback so the page renders in `next build` and before contracts are wired. Values mirror
// the synthetic on-chain seeds (mETH ~3.8% in the bps domain shown as %, USDY ~5%).
const DEMO: SimInputs = {
  methApyPct: 3.8,
  usdyApyPct: 5.0,
  allocMethBps: 4300,
  allocUsdyBps: 5700,
  riskState: 0,
};

const METH_ID = categoryHash("METH_APR_24H");
const USDY_ID = categoryHash("USDY_APY_24H");

/// Decode a CompositeFeed.read() result into { aprBps, confidenceBps }.
function decodeFeed(data: unknown): { bps: number; confBps: number } | null {
  if (!data) return null;
  const f = data as { value: `0x${string}`; confidence: number };
  let bps = 0;
  try {
    bps = Number((decodeAbiParameters([{ type: "uint256" }], f.value)[0] as bigint));
  } catch {
    return null; // unset feed
  }
  return { bps, confBps: Number(f.confidence) };
}

export function RwaClient() {
  const feedEnabled = hasFeed;

  const methFeed = useReadContract({
    address: env.addresses.compositeFeed as `0x${string}`,
    abi: compositeFeedAbi,
    functionName: "read",
    args: [METH_ID],
    query: { enabled: feedEnabled, refetchInterval: 30_000 },
  });
  const usdyFeed = useReadContract({
    address: env.addresses.compositeFeed as `0x${string}`,
    abi: compositeFeedAbi,
    functionName: "read",
    args: [USDY_ID],
    query: { enabled: feedEnabled, refetchInterval: 30_000 },
  });
  const allocation = useReadContract({
    address: env.addresses.yieldAllocator as `0x${string}`,
    abi: yieldAllocatorAbi,
    functionName: "getAllocation",
    query: { enabled: hasYieldAllocator, refetchInterval: 30_000 },
  });
  const methRisk = useReadContract({
    address: env.addresses.riskManager as `0x${string}`,
    abi: riskManagerAbi,
    functionName: "riskState",
    args: [METH_ID],
    query: { enabled: hasRiskManager, refetchInterval: 30_000 },
  });
  const usdyRisk = useReadContract({
    address: env.addresses.riskManager as `0x${string}`,
    abi: riskManagerAbi,
    functionName: "riskState",
    args: [USDY_ID],
    query: { enabled: hasRiskManager, refetchInterval: 30_000 },
  });

  const sim: SimInputs = React.useMemo(() => {
    const meth = decodeFeed(methFeed.data);
    const usdy = decodeFeed(usdyFeed.data);
    const alloc = allocation.data as [bigint, bigint, bigint, bigint] | undefined;

    // Worst (highest enum) of the two risk states drives the headline badge; default Normal.
    const worstRisk = Math.max(
      methRisk.data != null ? Number(methRisk.data) : 0,
      usdyRisk.data != null ? Number(usdyRisk.data) : 0,
    ) as 0 | 1 | 2;

    return {
      methApyPct: meth ? meth.bps / 100 : DEMO.methApyPct,
      usdyApyPct: usdy ? usdy.bps / 100 : DEMO.usdyApyPct,
      allocMethBps: alloc ? Number(alloc[0]) : DEMO.allocMethBps,
      allocUsdyBps: alloc ? Number(alloc[1]) : DEMO.allocUsdyBps,
      riskState: hasRiskManager ? worstRisk : DEMO.riskState,
    };
  }, [methFeed.data, usdyFeed.data, allocation.data, methRisk.data, usdyRisk.data]);

  const methConfPct = React.useMemo(() => {
    const m = decodeFeed(methFeed.data);
    return m ? Math.round(m.confBps / 100) : 90;
  }, [methFeed.data]);
  const usdyConfPct = React.useMemo(() => {
    const u = decodeFeed(usdyFeed.data);
    return u ? Math.round(u.confBps / 100) : 90;
  }, [usdyFeed.data]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-[var(--color-text)]">Earn yield on Mantle’s real-world assets</h1>
      <p className="mt-3 text-[var(--color-text-dim)]">
        AI agents forecast the best yield across mETH and USDY, so you don’t have to. No wallet needed to explore.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="earn-yields">
        <YieldCard
          name={RWA_LABELS.meth.name}
          blurb={RWA_LABELS.meth.blurb}
          apyPct={sim.methApyPct}
          confidencePct={methConfPct}
        />
        <YieldCard
          name={RWA_LABELS.usdy.name}
          blurb={RWA_LABELS.usdy.blurb}
          apyPct={sim.usdyApyPct}
          confidencePct={usdyConfPct}
        />
      </div>

      <div className="mt-6" data-tour="earn-simulator">
        <DepositSimulator sim={sim} />
      </div>

      <div className="mt-6" data-tour="earn-how">
        <HowItWorks />
      </div>

      <div className="mt-8 text-center" data-tour="earn-more">
        <Link href="/terminal/leaderboard" className="text-sm text-[var(--color-accent)] hover:underline focus-visible:underline">
          Want the full picture? See the live agent leaderboard →
        </Link>
      </div>
    </div>
  );
}
