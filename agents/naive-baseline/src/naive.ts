/// Naive persistence baseline — the textbook forecasting benchmark.
///
/// Forecast next = last observed value (random-walk / persistence). The 95% band is a fixed relative
/// half-width widened by recent realized volatility, so it isn't naively over-tight. This is the
/// control every real model is measured against: if ARIMA or the DeepSeek reasoner can't beat
/// persistence on the leaderboard, they aren't adding value. Three scored agents (naive < arima <
/// reasoner, ideally) is what makes the leaderboard read as a genuine benchmark rather than a demo.

export interface NaiveForecast {
  mean: number;
  lower95: number;
  upper95: number;
  /// Relative half-width floor used (fraction of |last|).
  bandPct: number;
  /// True when a real (>=2 point) history drove the forecast; false on the degenerate empty case.
  fitted: boolean;
}

export function naiveForecast(series: number[], bandPct = 0.08): NaiveForecast {
  if (series.length === 0) {
    return { mean: 0, lower95: 0, upper95: 1, bandPct, fitted: false };
  }
  const last = series[series.length - 1];

  // Recent volatility = stddev of the last up-to-10 first-differences. Widens the band in choppy
  // regimes so persistence isn't punished for an over-confident interval.
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
  return {
    mean: last,
    lower95: last - half,
    upper95: last + half,
    bandPct,
    fitted: series.length >= 2,
  };
}
