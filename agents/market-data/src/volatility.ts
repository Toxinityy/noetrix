function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

/// Rolling stdev of first differences (absolute changes), windowed. One value per input point;
/// warmup points (< 2 diffs available) are 0. Suited to bps APR/APY + the F&G index.
export function rollingStdevFirstDiff(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(1, i - window + 1);
    const diffs: number[] = [];
    for (let j = start; j <= i; j++) diffs.push(values[j] - values[j - 1]);
    out.push(stdev(diffs));
  }
  return out;
}

/// Rolling stdev of daily log-returns, windowed. Suited to USD TVL (multiplicative moves). Non-positive
/// values are skipped in the log (treated as no-return) to avoid NaN.
export function rollingStdevLogReturn(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(1, i - window + 1);
    const rets: number[] = [];
    for (let j = start; j <= i; j++) {
      if (values[j] > 0 && values[j - 1] > 0) rets.push(Math.log(values[j] / values[j - 1]));
    }
    out.push(stdev(rets));
  }
  return out;
}

/// Clamp values to median ± k·sigma (winsorization) — tames TVL jumps from token-price swings/migrations
/// that aren't yield-signal noise. Uses the median as the center so that extreme outliers do not inflate
/// the bound that is meant to cap them.
export function winsorize(values: number[], k = 3): number[] {
  if (values.length < 2) return values.slice();
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const med = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const s = stdev(values);
  const lo = med - k * s;
  const hi = med + k * s;
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}
