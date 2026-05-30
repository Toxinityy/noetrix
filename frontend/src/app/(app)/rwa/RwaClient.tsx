"use client";

import Link from "next/link";
import { YieldCard } from "@/components/rwa/YieldCard";
import { DepositSimulator, type SimInputs } from "@/components/rwa/DepositSimulator";
import { HowItWorks } from "@/components/rwa/HowItWorks";
import { RWA_LABELS } from "@/lib/contracts";

// Demo fallback so the page renders in `next build` and before contracts are wired (Task 11 swaps
// this for live reads). Values mirror the synthetic on-chain seeds (mETH ~3.8%, USDY ~5%).
const DEMO: SimInputs = {
  methApyPct: 3.8,
  usdyApyPct: 5.0,
  allocMethBps: 4300,
  allocUsdyBps: 5700,
  riskState: 0,
};

export function RwaClient() {
  const sim = DEMO; // replaced with live-derived SimInputs in Task 11

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold text-white">Earn yield on Mantle’s real-world assets</h1>
      <p className="mt-3 text-white/60">
        AI agents forecast the best yield across mETH and USDY, so you don’t have to. No wallet needed to explore.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <YieldCard
          name={RWA_LABELS.meth.name}
          blurb={RWA_LABELS.meth.blurb}
          apyPct={sim.methApyPct}
          confidencePct={90}
        />
        <YieldCard
          name={RWA_LABELS.usdy.name}
          blurb={RWA_LABELS.usdy.blurb}
          apyPct={sim.usdyApyPct}
          confidencePct={90}
        />
      </div>

      <div className="mt-6">
        <DepositSimulator sim={sim} />
      </div>

      <div className="mt-6">
        <HowItWorks />
      </div>

      <div className="mt-8 text-center">
        <Link href="/leaderboard" className="text-sm text-teal-300 hover:underline focus-visible:underline">
          Want the full picture? See the live agent leaderboard →
        </Link>
      </div>
    </div>
  );
}
