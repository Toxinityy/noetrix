import type { Band, StrategyOpts } from "../types.js";

/// Mean-reversion (AR(1) toward a moving mean): mean = last + kappa*(SMA_k - last).
/// kappa in (0,1] is the reversion speed; SMA_k is the simple moving average of the last k points.
/// Band half-width from recent volatility (stddev of last up-to-10 first-differences).
export function meanReversion(
  series: number[],
  _opts: StrategyOpts,
  kappa = 0.3,
  k = 10,
): Band {
  if (series.length < 2) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const last = series[series.length - 1];
  const window = series.slice(-k);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const meanForecast = last + kappa * (sma - last);

  const recent = series.slice(-11);
  const diffs: number[] = [];
  for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
  const dm = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const vol = Math.sqrt(diffs.reduce((a, b) => a + (b - dm) ** 2, 0) / diffs.length);
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * vol);

  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
