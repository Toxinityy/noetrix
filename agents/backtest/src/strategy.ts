import type { StressLevel } from "./types.js";

const W_FLOOR = 0.2; // never fully abandon mETH when calm
const W_CAP = 0.95; // never 100% (keep a safety sleeve)
const STRESS_CAP = 0.15;
const ELEVATED_CAP = 0.5;

/// Pre-registered allocation rule (mirrors rwaSim/YieldAllocator + MarketStressMonitor):
/// confidence-monotone lean toward mETH when calm; rotate to USDY safety under stress.
/// `stress = null` = a single-agent strategy with no crowd-stress signal (that signal is the ensemble's edge).
export function allocMeth(confBps: number, stress: StressLevel | null): number {
  const c = Math.max(0, Math.min(10_000, confBps)) / 10_000;
  let w = W_FLOOR + (W_CAP - W_FLOOR) * c;
  if (stress === "Stressed") w = Math.min(w, STRESS_CAP);
  else if (stress === "Elevated") w = Math.min(w, ELEVATED_CAP);
  return w;
}

export interface StrategyResult {
  cumulative: number[];
  final: number;
  maxDD: number;
  vol: number;
  sharpe: number;
}

/// Compound a per-step weight path over asset returns → cumulative/final return + drawdown + annualized vol/Sharpe.
/// cumulative[i] is the fractional cumulative return after step i (0.021 = +2.1%); maxDD ≤ 0.
export function simulate(weights: number[], methReturns: number[], usdyReturns: number[]): StrategyResult {
  const n = Math.min(weights.length, methReturns.length, usdyReturns.length);
  const stepReturns: number[] = [];
  const cumulative: number[] = [];
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  for (let i = 0; i < n; i++) {
    const r = weights[i] * methReturns[i] + (1 - weights[i]) * usdyReturns[i];
    stepReturns.push(r);
    equity *= 1 + r;
    cumulative.push(equity - 1);
    if (equity > peak) peak = equity;
    const dd = equity / peak - 1;
    if (dd < maxDD) maxDD = dd;
  }
  const final = equity - 1;
  const mean = stepReturns.reduce((s, x) => s + x, 0) / (n || 1);
  const variance = stepReturns.reduce((s, x) => s + (x - mean) ** 2, 0) / (n || 1);
  const sd = Math.sqrt(variance);
  const vol = sd * Math.sqrt(365); // daily → annualized
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(365) : 0;
  return { cumulative, final, maxDD, vol, sharpe };
}
