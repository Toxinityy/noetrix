import type { Band, StrategyOpts } from "../types.js";

/// EWMA-volatility: exponentially-weighted level for the point, band sized by an EWMA of absolute
/// first-differences (RiskMetrics-style, lambda≈0.94). Emphasizes the uncertainty/width dimension.
export function ewmaVol(series: number[], _opts: StrategyOpts, lambda = 0.94): Band {
  if (series.length < 2) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  // EWMA level
  let level = series[0];
  for (let i = 1; i < series.length; i++) level = lambda * level + (1 - lambda) * series[i];
  // EWMA of |first difference| as a volatility proxy
  let vol = Math.abs(series[1] - series[0]);
  for (let i = 2; i < series.length; i++) {
    vol = lambda * vol + (1 - lambda) * Math.abs(series[i] - series[i - 1]);
  }
  const half = 1.96 * vol;
  return { mean: level, lower: level - half, upper: level + half, fitted: true };
}
