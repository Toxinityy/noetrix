import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { saveSeries, loadSeries, dataDir } from "../src/cache.js";
import type { MetricSeries } from "../src/types.js";

const sample: MetricSeries = {
  metric: "METH_APR", unit: "bps", fetchedAt: "2026-06-09T00:00:00.000Z",
  points: [{ ts: 1738713600, value: 310 }, { ts: 1738800000, value: 320 }],
};

// Preserve real data files around tests so the absent-test is reliable and real snapshots survive.
let savedMeth: string | null = null;
let savedUsdy: string | null = null;
beforeEach(() => {
  const methF = `${dataDir()}/METH_APR.json`;
  savedMeth = existsSync(methF) ? readFileSync(methF, "utf8") : null;
  if (existsSync(methF)) rmSync(methF);
  const usdyF = `${dataDir()}/USDY_APY.json`;
  savedUsdy = existsSync(usdyF) ? readFileSync(usdyF, "utf8") : null;
  if (existsSync(usdyF)) rmSync(usdyF);
});
afterEach(() => {
  const methF = `${dataDir()}/METH_APR.json`;
  // remove any test-written METH_APR, then restore real snapshot if it existed
  if (existsSync(methF)) rmSync(methF);
  if (savedMeth !== null) writeFileSync(methF, savedMeth);
  const usdyF = `${dataDir()}/USDY_APY.json`;
  if (savedUsdy !== null) writeFileSync(usdyF, savedUsdy);
  else if (existsSync(usdyF)) rmSync(usdyF);
});

describe("cache", () => {
  it("round-trips a series through disk", () => {
    saveSeries(sample);
    const loaded = loadSeries("METH_APR");
    expect(loaded?.points.length).toBe(2);
    expect(loaded?.points[1].value).toBe(320);
  });
  it("loadSeries returns null when absent", () => {
    expect(loadSeries("USDY_APY")).toBeNull();
  });
});
