/// Live fetch of all real series → agents/market-data/data/*.json. Run with network access:
///   pnpm --filter @predictor-index/market-data refresh
/// Node's fetch handles the >10MB DefiLlama payloads that the WebFetch tool cannot. Each metric is
/// independent: a failure on one logs and continues so partial real data still lands.
import {
  fetchMethChart, fetchUsdyChart, fetchAaveProtocol, fetchChainTvl, fetchFearGreed,
} from "../src/fetchers.js";
import { buildMethSeries, buildUsdySeries, buildAaveTvlSeries, buildChainTvlSeries, buildFearGreedSeries } from "../src/series.js";
import { saveSeries } from "../src/cache.js";
import type { MetricSeries } from "../src/types.js";

async function tryOne(name: string, fn: () => Promise<MetricSeries>): Promise<boolean> {
  try {
    const s = await fn();
    saveSeries(s);
    console.log(`[ok] ${name}: ${s.points.length} points (${s.source})`);
    return true;
  } catch (e) {
    console.warn(`[skip] ${name}: ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  const stamp = new Date().toISOString();
  let ok = 0;
  ok += (await tryOne("METH_APR", async () => buildMethSeries(await fetchMethChart(), stamp))) ? 1 : 0;
  ok += (await tryOne("USDY_APY", async () => buildUsdySeries(await fetchUsdyChart(), stamp))) ? 1 : 0;
  ok += (await tryOne("AAVE_TVL", async () => {
    try {
      const s = buildAaveTvlSeries(await fetchAaveProtocol(), "Mantle", stamp);
      if (s.points.length > 0) return s;
    } catch (e) {
      console.warn(`  aave protocol failed (${(e as Error).message}), falling back to chain-level proxy`);
    }
    return buildChainTvlSeries(await fetchChainTvl(), stamp);
  })) ? 1 : 0;
  ok += (await tryOne("FEAR_GREED", async () => buildFearGreedSeries(await fetchFearGreed(), stamp))) ? 1 : 0;
  console.log(`refresh-data: ${ok}/4 metrics written to data/`);
  if (ok === 0) process.exitCode = 1;
}

main();
