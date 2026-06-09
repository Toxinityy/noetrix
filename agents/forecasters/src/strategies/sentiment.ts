import type { Band, StrategyOpts } from "../types.js";

/// Sentiment tilt driven by a Fear & Greed value `fg` ∈ [0,100]. Greed (>50) tilts the level up,
/// fear (<50) tilts it down (flight-to-safety for risk metrics) and widens the band. `beta` is the
/// max relative tilt at the extremes; `fearWiden` is the max extra band widening at full fear.
export function sentiment(
  series: number[],
  _opts: StrategyOpts,
  fg: number | undefined,
  beta = 0.1,
  fearWiden = 0.5,
): Band {
  if (series.length < 2 || fg === undefined || !Number.isFinite(fg)) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const last = series[series.length - 1];
  const tilt = (fg - 50) / 50; // [-1, 1]: <0 fear, >0 greed
  const meanForecast = last * (1 + beta * tilt);

  // base volatility from recent diffs
  const recent = series.slice(-11);
  const diffs: number[] = [];
  for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
  const dm = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const vol = Math.sqrt(diffs.reduce((a, b) => a + (b - dm) ** 2, 0) / diffs.length);

  const fearFactor = 1 + Math.max(0, (50 - fg) / 50) * fearWiden; // ≥1, larger in fear
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * vol) * fearFactor;
  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
