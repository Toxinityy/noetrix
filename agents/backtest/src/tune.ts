import { rawDisagreement } from "@predictor-index/forecasters";
import type { MetricKey } from "@predictor-index/market-data";
import { buildRoster } from "./roster.js";
import { metricView } from "./view.js";

export function splitIndex(len: number, trainFrac: number): number {
  return Math.max(1, Math.floor(len * trainFrac));
}

/// p-th percentile (nearest-rank) of a bigint list. Empty → 1n (a safe non-zero scale floor).
export function percentileBig(xs: bigint[], p: number): bigint {
  if (xs.length === 0) return 1n;
  const sorted = xs.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  const v = sorted[rank];
  return v > 0n ? v : 1n;
}

/// Tune the per-category disagreeScale = 90th percentile of the raw swarm dispersion observed over the
/// TRAIN window (the 6 statistical agents; deepseek excluded from tuning to keep it deterministic).
/// Uses the same expanding-window contributor construction as the replay, but only needs the bands.
export function tuneDisagreeScale(
  metric: MetricKey,
  series: number[],
  fgAligned: (number | null)[],
  trainFrac = 0.7,
  minHistory = 8,
  pct = 90,
): bigint {
  const view = metricView(metric);
  const roster = buildRoster(null); // statistical only
  const trainEnd = splitIndex(series.length, trainFrac);
  const dRaws: bigint[] = [];
  for (let t = minHistory; t < trainEnd; t++) {
    const hist = series.slice(0, t);
    const fgPrev = fgAligned[t - 1] ?? null;
    const lo: bigint[] = [];
    const hi: bigint[] = [];
    for (const a of roster) {
      const band = a.forecast(hist, view, fgPrev, metric, t);
      if (!band.fitted) continue;
      lo.push(view.toDomain(Math.min(band.lower, band.upper)));
      hi.push(view.toDomain(Math.max(band.lower, band.upper)));
    }
    if (lo.length > 0) dRaws.push(rawDisagreement(lo, hi, view.domainMin, view.domainMax));
  }
  return percentileBig(dRaws, pct);
}
