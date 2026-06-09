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

/// Web2 deposit simulator (no wallet, no chain write). Two controls drive it:
///   1. deposit amount, scales the dollar projection (de-emphasized supporting input)
///   2. Market conditions (Calm to Stressed), the HERO control: re-weights the AI allocation and
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
  const stressWord = stress < 34 ? "Calm" : stress < 67 ? "Volatile" : "Stressed";

  const stressPillColor =
    stressLevel === "Stressed"
      ? "bg-red-500/20 text-red-300 ring-red-500/30"
      : stressLevel === "Elevated"
        ? "bg-amber-500/20 text-amber-300 ring-amber-500/30"
        : "bg-teal-500/20 text-teal-300 ring-teal-500/30";

  return (
    <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-elev-1)] p-6">
      {/* 1. Deposit amount , supporting input, de-emphasized so the slider + outcome lead */}
      <label htmlFor="rwa-amt" className="text-sm text-[var(--color-text-dim)]">
        If you deposited
      </label>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg text-[var(--color-text-dim)]">$</span>
        <input
          id="rwa-amt"
          type="number"
          min={100}
          max={1_000_000}
          step={100}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="num w-36 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] px-3 py-1.5 text-lg text-[var(--color-text)] outline-none focus-visible:border-[var(--color-accent)]/60"
        />
      </div>
      <input
        type="range"
        min={100}
        max={100_000}
        step={100}
        value={Math.min(amount, 100_000)}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mt-3 w-full cursor-pointer accent-[var(--color-accent)]"
        aria-label="Deposit amount in dollars"
      />

      {/* 2. Market conditions , the hero control. Stronger border + elevation than the $ input.
          Drives allocation + safety below. */}
      <div className="mt-7 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] p-4">
        <div className="flex items-baseline justify-between">
          <label htmlFor="rwa-market" className="text-sm font-medium text-[var(--color-text)]">
            Market conditions:{" "}
            <span className="text-[var(--color-accent)]">{stressWord}</span>
          </label>
          <span className="num text-xs text-[var(--color-text-muted)]">drag to stress-test the AI</span>
        </div>
        <input
          id="rwa-market"
          type="range"
          min={0}
          max={100}
          step={1}
          value={stress}
          onChange={(e) => setStress(Number(e.target.value))}
          className="mt-3 h-6 w-full cursor-pointer accent-[var(--color-accent)]"
          aria-label="Market stress, calm to stressed"
          aria-valuetext={stressWord}
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>Calm</span>
          <span>Volatile</span>
          <span>Stressed</span>
        </div>
      </div>

      {/* 3. Allocation , re-weights as market conditions change */}
      <div className="mt-6">
        <div className="mb-2 text-sm text-[var(--color-text-dim)]">How the AI would balance it</div>
        <AllocationBar methBps={market.allocMethBps} usdyBps={market.allocUsdyBps} />
      </div>

      {/* 4. Safety , flips Normal/Caution/Frozen, with a plain-English reason when it leaves Normal */}
      <div className="mt-6 flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-dim)]">Safety check</span>
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
      <p className="mt-2 min-h-[1rem] text-xs text-[var(--color-warn)]" role="status" aria-live="polite">
        {reason}
      </p>

      {/* 5. Outcome , the single largest number on the surface */}
      <div className="mt-6 grid gap-1">
        <div className="text-sm text-[var(--color-text-dim)]">Projected yield in a year</div>
        <div className="num text-4xl font-semibold text-[var(--color-accent)]">
          ${projectedYear.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="num text-sm text-[var(--color-text-muted)]">≈ {market.blendedApyPct.toFixed(2)}% blended yearly return</div>
      </div>

      <p className="mt-5 text-xs text-[var(--color-text-muted)]">
        Explore freely. This is a forecast simulator. Nothing here moves real money, and there are no fees.
      </p>
    </div>
  );
}
