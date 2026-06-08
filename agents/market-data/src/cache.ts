import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MetricKey, MetricSeries } from "./types.js";

/// Cache lives at agents/market-data/data (sibling of src), committed for reproducible backtests.
export function dataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../src (or dist)
  return join(here, "..", "data");
}

export function saveSeries(series: MetricSeries): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${series.metric}.json`), JSON.stringify(series, null, 2) + "\n");
}

export function loadSeries(metric: MetricKey): MetricSeries | null {
  const f = join(dataDir(), `${metric}.json`);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8")) as MetricSeries;
}
