import type { Band, StrategyOpts } from "../types.js";

/// Persistence / random-walk baseline (ported from naive-baseline). mean = last value; 95% band
/// half-width = max(8% * |last|, 1.96 * stddev of last up-to-10 first-differences).
export function persistence(series: number[], _opts: StrategyOpts, bandPct = 0.08): Band {
  if (series.length === 0) return { mean: 0, lower: 0, upper: 1, fitted: false };
  const last = series[series.length - 1];

  const recent = series.slice(-11);
  let vol = 0;
  if (recent.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
    const m = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const v = diffs.reduce((a, b) => a + (b - m) ** 2, 0) / diffs.length;
    vol = Math.sqrt(v);
  }

  const half = Math.max(Math.abs(last) * bandPct, 1.96 * vol);
  return { mean: last, lower: last - half, upper: last + half, fitted: series.length >= 2 };
}
