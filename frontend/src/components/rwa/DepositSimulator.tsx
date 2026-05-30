"use client";

import { useState } from "react";
import { AllocationBar } from "./AllocationBar";
import { SafetyBadge } from "./SafetyBadge";

export interface SimInputs {
  methApyPct: number; // forecast mETH yield, %
  usdyApyPct: number; // forecast USDY yield, %
  allocMethBps: number; // from YieldAllocator
  allocUsdyBps: number;
  riskState: 0 | 1 | 2; // worst of the two assets
}

/// Web2 deposit simulator — no wallet, no chain write. Projects a year of yield from a deposit
/// amount and the live (or demo) forecast/allocation, updating instantly client-side.
export function DepositSimulator({ sim }: { sim: SimInputs }) {
  const [amount, setAmount] = useState(10_000);
  const mShare = sim.allocMethBps / 10_000;
  const uShare = sim.allocUsdyBps / 10_000;
  const blendedApy = mShare * sim.methApyPct + uShare * sim.usdyApyPct;
  const projectedYear = (amount * blendedApy) / 100;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-teal-400/[0.07] to-transparent p-6 ring-1 ring-white/10">
      <label htmlFor="rwa-amt" className="text-sm text-white/70">
        If you deposited
      </label>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-2xl text-white/80">$</span>
        <input
          id="rwa-amt"
          type="number"
          min={100}
          max={1_000_000}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="num w-44 rounded-xl bg-white/5 px-3 py-2 text-2xl text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-teal-400/60"
        />
      </div>
      <input
        type="range"
        min={100}
        max={100_000}
        step={100}
        value={Math.min(amount, 100_000)}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mt-4 w-full cursor-pointer accent-teal-400"
        aria-label="Deposit amount"
      />

      <div className="mt-6 grid gap-1">
        <div className="text-sm text-white/60">Projected yield in a year</div>
        <div className="num text-4xl font-semibold text-teal-300">
          ${projectedYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="num text-sm text-white/50">≈ {blendedApy.toFixed(2)}% blended yearly return</div>
      </div>

      <div className="mt-6">
        <div className="mb-2 text-sm text-white/60">How the AI would balance it</div>
        <AllocationBar methBps={sim.allocMethBps} usdyBps={sim.allocUsdyBps} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-white/60">Safety check</span>
        <SafetyBadge state={sim.riskState} />
      </div>

      <p className="mt-5 text-xs text-white/40">
        Explore freely — this is a forecast simulator. Nothing here moves real money, and there are no fees.
      </p>
    </div>
  );
}
