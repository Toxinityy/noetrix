import type { MetricKey } from "./types.js";

export interface MetricConfig {
  key: MetricKey;
  /// On-chain category label (undefined for F&G, which has no category).
  categoryLabel?: string;
  workingUnit: "bps" | "usd" | "index";
  /// On-chain domain bounds (mirror agents/sdk categories.ts / RangeCrpsScorer config).
  domainMin: bigint;
  domainMax: bigint;
  /// Working-unit float → on-chain domain bigint. TVL does the 1e8 scale in BigInt to stay exact.
  toDomain: (working: number) => bigint;
  /// Volatility method appropriate to the series shape.
  volMethod: "firstDiff" | "logReturn";
}

const r = (x: number) => Math.round(x);

export const METRICS: Record<MetricKey, MetricConfig> = {
  METH_APR: {
    key: "METH_APR",
    categoryLabel: "METH_APR_24H",
    workingUnit: "bps",
    domainMin: 0n,
    domainMax: 2_000n,
    toDomain: (bps) => BigInt(r(bps)),
    volMethod: "firstDiff",
  },
  USDY_APY: {
    key: "USDY_APY",
    categoryLabel: "USDY_APY_24H",
    workingUnit: "bps",
    domainMin: 0n,
    domainMax: 2_000n,
    toDomain: (bps) => BigInt(r(bps)),
    volMethod: "firstDiff",
  },
  AAVE_TVL: {
    key: "AAVE_TVL",
    categoryLabel: "AAVE_MANTLE_TVL_24H",
    workingUnit: "usd",
    domainMin: 0n,
    domainMax: 100_000_000_000_000_000n, // 1e17 = $1B at 8 decimals
    toDomain: (usd) => BigInt(r(usd)) * 100_000_000n, // USD → 8-dec, scale in BigInt
    volMethod: "logReturn",
  },
  FEAR_GREED: {
    key: "FEAR_GREED",
    workingUnit: "index",
    domainMin: 0n,
    domainMax: 100n,
    toDomain: (v) => BigInt(r(v)),
    volMethod: "firstDiff",
  },
};
