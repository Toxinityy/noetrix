import type { CategoryResult } from "./types.js";

export interface SwarmCalibration {
  generatedAt: string;
  fearExtreme: number;
  fearMed: number;
  greedExtreme: number;
  categories: Record<
    string,
    { domainMin: string; domainMax: string; disagreeScale: string; dMed: number; dHigh: number; surpriseMed: number; surpriseHigh: number }
  >;
}

/// Collapse the backtest results into the on-chain calibration the contracts consume:
/// per-category bounds + disagreeScale + stress thresholds, plus the absolute F&G bands.
export function buildCalibration(results: CategoryResult[], generatedAt = ""): SwarmCalibration {
  const categories: SwarmCalibration["categories"] = {};
  for (const r of results) {
    categories[r.metric] = {
      domainMin: r.domainMin,
      domainMax: r.domainMax,
      disagreeScale: r.disagreeScale,
      dMed: r.stress.dMed,
      dHigh: r.stress.dHigh,
      surpriseMed: r.stress.surpriseMed,
      surpriseHigh: r.stress.surpriseHigh,
    };
  }
  return { generatedAt, fearExtreme: 25, fearMed: 45, greedExtreme: 75, categories };
}
