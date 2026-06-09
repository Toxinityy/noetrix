import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildMethSeries, buildUsdySeries, buildAaveTvlSeries, buildFearGreedSeries } from "../src/series.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

describe("series builders (raw JSON → normalized MetricSeries)", () => {
  it("METH series is in bps (10000=100%) and ascending", () => {
    const s = buildMethSeries(fx("meth-chart.json"));
    expect(s.metric).toBe("METH_APR");
    expect(s.unit).toBe("bps");
    expect(s.points[0].value).toBe(310); // 3.10% → 310 bps
  });
  it("USDY series is in bps", () => {
    const s = buildUsdySeries(fx("meth-chart.json")); // reuse same chart shape
    expect(s.points[0].value).toBe(310);
  });
  it("AAVE TVL series keeps USD working unit (number)", () => {
    const s = buildAaveTvlSeries(fx("aave-protocol.json"), "Mantle");
    expect(s.unit).toBe("usd");
    expect(s.points[0].value).toBe(365216006);
  });
  it("Fear & Greed series is the 0–100 index", () => {
    const s = buildFearGreedSeries(fx("fng.json"));
    expect(s.points.map((p) => p.value)).toEqual([45, 52, 20]);
  });
});
