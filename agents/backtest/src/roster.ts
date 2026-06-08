import { persistence, arima, meanReversion, momentum, ewmaVol, sentiment } from "@predictor-index/forecasters";
import type { MetricKey } from "@predictor-index/market-data";
import type { MetricView } from "./types.js";

interface Band { mean: number; lower: number; upper: number; fitted: boolean }

/// A DeepSeek forecast cache: key `${metric}:${ts}` → working-unit band + confidence (bps).
export type DeepSeekCache = Record<string, { lower: number; upper: number; confidence: number }> | null;

export interface AgentSpec {
  key: string;
  label: string;
  /// forecast on history (working unit). fg = Fear&Greed at the forecast time (or null). metric+ts let
  /// the deepseek adapter look up its cached forecast. Returns a working-unit Band.
  forecast: (hist: number[], view: MetricView, fg: number | null, metric: MetricKey, ts: number) => Band;
}

const STATISTICAL: AgentSpec[] = [
  { key: "persistence", label: "Naive", forecast: (h, v) => persistence(h, { domainMin: v.workingMin, domainMax: v.workingMax }) },
  { key: "arima", label: "ARIMA", forecast: (h, v) => arima(h, { domainMin: v.workingMin, domainMax: v.workingMax, horizon: 1 }) },
  { key: "meanReversion", label: "Mean-Reversion", forecast: (h, v) => meanReversion(h, { domainMin: v.workingMin, domainMax: v.workingMax }) },
  { key: "momentum", label: "Momentum", forecast: (h, v) => momentum(h, { domainMin: v.workingMin, domainMax: v.workingMax }) },
  { key: "ewmaVol", label: "EWMA-Vol", forecast: (h, v) => ewmaVol(h, { domainMin: v.workingMin, domainMax: v.workingMax }) },
  { key: "sentiment", label: "Sentiment (F&G)", forecast: (h, v, fg) => sentiment(h, { domainMin: v.workingMin, domainMax: v.workingMax }, fg ?? undefined) },
];

/// The DeepSeek adapter reads a precomputed cache (Plan: gen-deepseek-cache.ts). If a step has no
/// cached forecast, it returns an unfitted band so the replay skips it as a non-contributor.
function deepseekSpec(cache: NonNullable<DeepSeekCache>): AgentSpec {
  return {
    key: "deepseek",
    label: "DeepSeek Reasoner",
    forecast: (_h, _v, _fg, metric, ts) => {
      const hit = cache[`${metric}:${ts}`];
      if (!hit) return { mean: 0, lower: 0, upper: 0, fitted: false };
      return { mean: (hit.lower + hit.upper) / 2, lower: hit.lower, upper: hit.upper, fitted: true };
    },
  };
}

export function buildRoster(cache: DeepSeekCache): AgentSpec[] {
  const roster = [...STATISTICAL];
  if (cache && Object.keys(cache).length > 0) roster.push(deepseekSpec(cache));
  return roster;
}
