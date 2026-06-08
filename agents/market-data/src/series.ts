import type { MetricSeries } from "./types.js";
import { parseYieldChart, parseFearGreed, parseProtocolChainTvl, parseChainTvl } from "./parsers.js";
import { apyPctToBps } from "./normalize.js";

function nowIso(): string {
  // Deterministic-friendly: callers may pass fetchedAt; default to empty so tests don't depend on time.
  return "";
}

export function buildMethSeries(rawChart: unknown, fetchedAt = nowIso()): MetricSeries {
  const pct = parseYieldChart(rawChart);
  return { metric: "METH_APR", unit: "bps", fetchedAt, source: "defillama:yields/chart(meth)", points: pct.map((p) => ({ ts: p.ts, value: apyPctToBps(p.value) })) };
}

export function buildUsdySeries(rawChart: unknown, fetchedAt = nowIso()): MetricSeries {
  const pct = parseYieldChart(rawChart);
  return { metric: "USDY_APY", unit: "bps", fetchedAt, source: "defillama:yields/chart(usdy)", points: pct.map((p) => ({ ts: p.ts, value: apyPctToBps(p.value) })) };
}

export function buildAaveTvlSeries(rawProtocol: unknown, chain = "Mantle", fetchedAt = nowIso()): MetricSeries {
  const pts = parseProtocolChainTvl(rawProtocol, chain);
  return { metric: "AAVE_TVL", unit: "usd", fetchedAt, source: "defillama:protocol/aave-v3", points: pts };
}

export function buildChainTvlSeries(rawChainTvl: unknown, fetchedAt = nowIso()): MetricSeries {
  const pts = parseChainTvl(rawChainTvl);
  return { metric: "AAVE_TVL", unit: "usd", fetchedAt, source: "defillama:v2/historicalChainTvl/Mantle(proxy)", points: pts };
}

export function buildFearGreedSeries(rawFng: unknown, fetchedAt = nowIso()): MetricSeries {
  const pts = parseFearGreed(rawFng);
  return { metric: "FEAR_GREED", unit: "index", fetchedAt, source: "alternative.me/fng", points: pts };
}
