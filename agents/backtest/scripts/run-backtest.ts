/// Run the backtest on the committed market-data snapshots → write a markdown report + the frontend
/// snapshot. Usage: pnpm --filter @predictor-index/backtest run:backtest
/// Requires agents/market-data/data/*.json (produced by the market-data `refresh` script).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSeries, type MetricKey } from "@predictor-index/market-data";
import { alignByDay } from "../src/align.js";
import { runOneCategory } from "../src/run.js";
import { renderReport } from "../src/report.js";
import { buildSnapshot } from "../src/snapshot.js";
import { buildCalibration } from "../src/calibration.js";
import type { DeepSeekCache } from "../src/roster.js";
import type { CategoryResult } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadDeepSeekCache(): DeepSeekCache {
  const f = join(here, "..", "data", "deepseek-cache.json");
  if (!existsSync(f)) {
    console.log("[info] no deepseek-cache.json — running the 6 statistical agents only (DeepSeek deferred).");
    return null;
  }
  return JSON.parse(readFileSync(f, "utf8")) as DeepSeekCache;
}

function main(stamp: string) {
  const fng = loadSeries("FEAR_GREED");
  const cache = loadDeepSeekCache();
  const categories: MetricKey[] = ["METH_APR", "AAVE_TVL", "USDY_APY"];
  const results: CategoryResult[] = [];
  for (const metric of categories) {
    const s = loadSeries(metric);
    if (!s || s.points.length < 16) {
      console.warn(`[skip] ${metric}: no/too-thin data (run market-data refresh first).`);
      continue;
    }
    const values = s.points.map((p) => p.value);
    const fgAligned = fng ? alignByDay(s.points, fng.points) : values.map(() => null);
    results.push(runOneCategory(metric, values, fgAligned, cache));
    console.log(`[ok] ${metric}: ${s.points.length} points`);
  }
  if (results.length === 0) {
    console.error("No categories had usable data. Run: pnpm --filter @predictor-index/market-data refresh");
    process.exitCode = 1;
    return;
  }
  const md = renderReport(results);
  const snap = buildSnapshot(results, stamp);

  const calib = buildCalibration(results, stamp);
  const calibDir = join(here, "..", "..", "..", "contracts", "config");
  if (!existsSync(calibDir)) mkdirSync(calibDir, { recursive: true });
  writeFileSync(join(calibDir, "swarm-calibration.json"), JSON.stringify(calib, null, 2) + "\n");
  console.log("[ok] wrote contracts/config/swarm-calibration.json");

  const reportDir = join(here, "..", "reports");
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, "backtest-report.md"), md);

  const fePublic = join(here, "..", "..", "..", "frontend", "public");
  if (existsSync(fePublic)) {
    writeFileSync(join(fePublic, "backtest-snapshot.json"), JSON.stringify(snap, null, 2) + "\n");
    console.log("[ok] wrote frontend/public/backtest-snapshot.json");
  } else {
    writeFileSync(join(reportDir, "backtest-snapshot.json"), JSON.stringify(snap, null, 2) + "\n");
    console.log("[warn] frontend/public missing — wrote snapshot to reports/ instead");
  }
  console.log("\n" + md);
}

main(new Date().toISOString());
