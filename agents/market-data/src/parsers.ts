import type { DailyPoint } from "./types.js";

function sortByTs(pts: DailyPoint[]): DailyPoint[] {
  return pts.slice().sort((a, b) => a.ts - b.ts);
}

/// DefiLlama yields /chart → {ts, value} in PERCENT (prefers apyBase, falls back to apy).
export function parseYieldChart(raw: unknown): DailyPoint[] {
  const data = (raw as { data?: Array<{ timestamp: string; apy?: number; apyBase?: number }> }).data ?? [];
  const pts: DailyPoint[] = [];
  for (const d of data) {
    const v = typeof d.apyBase === "number" ? d.apyBase : d.apy;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const ts = Math.floor(Date.parse(d.timestamp) / 1000);
    if (!Number.isFinite(ts)) continue;
    pts.push({ ts, value: v });
  }
  return sortByTs(pts);
}

/// alternative.me Fear & Greed → {ts, value} as a 0–100 index.
export function parseFearGreed(raw: unknown): DailyPoint[] {
  const data = (raw as { data?: Array<{ value: string; timestamp: string }> }).data ?? [];
  const pts: DailyPoint[] = [];
  for (const d of data) {
    const value = Number(d.value);
    const ts = Number(d.timestamp);
    if (!Number.isFinite(value) || !Number.isFinite(ts)) continue;
    pts.push({ ts, value });
  }
  return sortByTs(pts);
}

/// DefiLlama /protocol/{slug} → chainTvls[chain].tvl[] of {date, totalLiquidityUSD}.
export function parseProtocolChainTvl(raw: unknown, chain = "Mantle"): DailyPoint[] {
  const chainTvls = (raw as { chainTvls?: Record<string, { tvl?: Array<{ date: number; totalLiquidityUSD: number }> }> }).chainTvls ?? {};
  const tvl = chainTvls[chain]?.tvl ?? [];
  return sortByTs(tvl.map((d) => ({ ts: d.date, value: d.totalLiquidityUSD })));
}

/// DefiLlama /v2/historicalChainTvl/{chain} → [{date, tvl}] (NOTE: field is `tvl`, not totalLiquidityUSD).
export function parseChainTvl(raw: unknown): DailyPoint[] {
  const arr = (raw as Array<{ date: number; tvl: number }>) ?? [];
  return sortByTs(arr.map((d) => ({ ts: d.date, value: d.tvl })));
}

/// DefiLlama /pools → the Mantle Ondo USDY pool UUID (throws if absent so the caller can fall back).
export function pickUsdyPool(raw: unknown): string {
  const data = (raw as { data?: Array<{ pool: string; project: string; symbol: string; chain: string }> }).data ?? [];
  const match = data.find((p) => p.project === "ondo-yield-assets" && p.symbol === "USDY" && p.chain === "Mantle");
  if (!match) throw new Error("USDY Mantle pool not found in /pools");
  return match.pool;
}
