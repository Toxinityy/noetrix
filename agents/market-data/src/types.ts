/// One daily observation in the metric's WORKING unit (bps for APR/APY, USD for TVL, 0–100 for F&G).
export interface DailyPoint {
  /// Unix seconds (UTC midnight).
  ts: number;
  value: number;
}

export type MetricKey = "METH_APR" | "AAVE_TVL" | "USDY_APY" | "FEAR_GREED";

export interface MetricSeries {
  metric: MetricKey;
  /// Working-unit ('bps' | 'usd' | 'index').
  unit: string;
  /// Sorted ascending by ts.
  points: DailyPoint[];
  /// ISO timestamp of when this series was fetched (provenance for the cache).
  fetchedAt: string;
  /// Optional source note (endpoint / fallback).
  source?: string;
}
