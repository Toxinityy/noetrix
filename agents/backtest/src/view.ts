import { METRICS, type MetricKey } from "@predictor-index/market-data";
import type { MetricView } from "./types.js";

/// Build the working↔domain conversion for a metric. Strategies operate in the working unit (bps, or
/// USD for TVL — both < 2^53); CRPS + swarm operate in the on-chain domain bigint.
export function metricView(metric: MetricKey): MetricView {
  const cfg = METRICS[metric];
  const workingMin = Number(cfg.domainMin) / (cfg.workingUnit === "usd" ? 1e8 : 1);
  // For 'usd', divide the bigint by 1e8 BEFORE Number() to stay exact, then to a (safe) Number.
  const workingMax =
    cfg.workingUnit === "usd" ? Number(cfg.domainMax / 100_000_000n) : Number(cfg.domainMax);
  return {
    metric,
    workingMin,
    workingMax,
    domainMin: cfg.domainMin,
    domainMax: cfg.domainMax,
    toDomain: cfg.toDomain,
  };
}
