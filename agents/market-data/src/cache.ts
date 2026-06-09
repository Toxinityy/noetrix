import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MetricKey, MetricSeries } from "./types.js";

/// Cache lives at agents/market-data/data (package root, committed for reproducible backtests).
/// Resolves correctly whether this module runs from source (`.../src`, via tsx/vitest) OR from the
/// compiled output (`.../dist/src`, when another package imports the built `loadSeries`). A naive
/// `../data` from `dist/src` would wrongly point at `dist/data`. An explicit `MARKET_DATA_DIR`
/// override wins when set.
export function dataDir(): string {
  if (process.env.MARKET_DATA_DIR) return process.env.MARKET_DATA_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  const root = here.replace(/[/\\](?:dist[/\\]src|src)$/, "");
  return join(root, "data");
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
