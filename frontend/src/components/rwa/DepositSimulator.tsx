"use client";

import { useState } from "react";
import { AllocationBar } from "./AllocationBar";
import { SafetyBadge } from "./SafetyBadge";
import { simulateMarket, simulateStress, riskReason, type MarketBase, type StressLevel } from "@/lib/rwaSim";

export interface SimInputs {
  methApyPct: number; // forecast mETH yield, %
  usdyApyPct: number; // forecast USDY yield, %
  allocMethBps: number; // from YieldAllocator (calm baseline)
  allocUsdyBps: number;
  riskState: 0 | 1 | 2; // worst of the two assets at calm
}

// AI confidence at "calm" (stress 0). Demo baseline; when live, the calm state approximates the
// on-chain feed confidence. Stress drives it down per-asset in simulateMarket.
const BASE_CONF_BPS = 9_000;

/// Web2 deposit simulator — no wallet, no chain write. Two controls drive it:
///   1. deposit amount → scales the dollar projection
///   2. Market conditions (Calm→Stressed) → the HERO control: re-weights the AI allocation and
///      flips the safety state live, client-side, mirroring the on-chain YieldAllocator/RiskManager
///      math (see lib/rwaSim.ts). This is the demo's interactive peak: move the market, watch the
///      AI re-balance and the safety badge flip.
export function DepositSimulator({ sim }: { sim: SimInputs }) {
  const [amount, setAmount] = useState(10_000);
  const [stress, setStress] = useState(0); // 0 = calm, 100 = stressed

  const base: MarketBase = {
    methApyPct: sim.methApyPct,
    usdyApyPct: sim.usdyApyPct,
    baseConfBps: BASE_CONF_BPS,
  };
  const market = simulateMarket(stress, base);
  const stressLevel: StressLevel = simulateStress(stress);
  const projectedYear = (amount * market.blendedApyPct) / 100;
  const reason = riskReason(market);

  const stressPillColor =
    stressLevel === "Stressed"
      ? "bg-red-500/20 text-red-300 ring-red-500/30"
      : stressLevel === "Elevated"
        ? "bg-amber-500/20 text-amber-300 ring-amber-500/30"
        : "bg-teal-500/20 text-teal-300 ring-teal-500/30";

  return (
    <div className="rounded-3xl bg-gradient-to-b from-teal-400/[0.07] to-transparent p-6 ring-1 ring-white/10">
      {/* 1. Deposit amount */}
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
        aria-label="Deposit amount in dollars"
      />

      {/* 2. Market conditions — the hero control. Drives allocation + safety below. */}
      <div className="mt-7 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
        <div className="flex items-baseline justify-between">
          <label htmlFor="rwa-market" className="text-sm font-medium text-white/80">
            Market conditions
          </label>
          <span className="num text-xs text-white/50">drag to stress-test the AI</span>
        </div>
        <input
          id="rwa-market"
          type="range"
          min={0}
          max={100}
          step={1}
          value={stress}
          onChange={(e) => setStress(Number(e.target.value))}
          className="mt-3 h-6 w-full cursor-pointer accent-teal-400"
          aria-label="Market stress, calm to stressed"
          aria-valuetext={stress < 34 ? "Calm" : stress < 67 ? "Volatile" : "Stressed"}
        />
        <div className="mt-1 flex justify-between text-xs text-white/45">
          <span>Calm</span>
          <span>Volatile</span>
          <span>Stressed</span>
        </div>
      </div>

      {/* 3. Allocation — re-weights as market conditions change */}
      <div className="mt-6">
        <div className="mb-2 text-sm text-white/60">How the AI would balance it</div>
        <AllocationBar methBps={market.allocMethBps} usdyBps={market.allocUsdyBps} />
      </div>

      {/* 4. Safety — flips Normal→Caution→Frozen, with a plain-English reason when it leaves Normal */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-white/60">Safety check</span>
        <div className="flex items-center gap-2">
          {/* Swarm stress level pill — mirrors the on-chain MarketStressMonitor Calm/Elevated/Stressed */}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${stressPillColor}`}
            aria-label={`Market stress level: ${stressLevel}`}
          >
            <span aria-hidden="true">●</span>
            <span className="ml-1">{stressLevel}</span>
          </span>
          <SafetyBadge state={market.riskState} />
        </div>
      </div>
      <p className="mt-2 min-h-[1rem] text-xs text-amber-300/80" role="status" aria-live="polite">
        {reason}
      </p>

      {/* 5. Outcome */}
      <div className="mt-6 grid gap-1">
        <div className="text-sm text-white/60">Projected yield in a year</div>
        <div className="num text-4xl font-semibold text-teal-300">
          ${projectedYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="num text-sm text-white/50">≈ {market.blendedApyPct.toFixed(2)}% blended yearly return</div>
      </div>

      <p className="mt-5 text-xs text-white/40">
        Explore freely — this is a forecast simulator. Nothing here moves real money, and there are no fees.
      </p>
    </div>
  );
}
