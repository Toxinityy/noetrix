import type { Band, StrategyOpts } from "../types.js";

/// Momentum / trend-following: fit an OLS line over the last k points and extrapolate `horizon`
/// steps. mean = last + slope*horizon. Band half-width from the residual stddev around the fit.
export function momentum(series: number[], opts: StrategyOpts, k = 10): Band {
  const horizon = opts.horizon ?? 1;
  if (series.length < 3) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const window = series.slice(-k);
  const n = window.length;
  // x = 0..n-1
  const xbar = (n - 1) / 2;
  const ybar = window.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xbar) * (window[i] - ybar);
    sxx += (i - xbar) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  // residual stddev around the fit
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const fit = intercept + slope * i;
    sse += (window[i] - fit) ** 2;
  }
  const resid = Math.sqrt(sse / Math.max(1, n - 2));
  const last = window[n - 1];
  const meanForecast = last + slope * horizon;
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * resid);
  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
