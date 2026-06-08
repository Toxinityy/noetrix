import { describe, it, expect, afterEach } from "vitest";
import { rmSync, existsSync } from "node:fs";
import { saveSeries, loadSeries, dataDir } from "../src/cache.js";
import type { MetricSeries } from "../src/types.js";

const sample: MetricSeries = {
  metric: "METH_APR", unit: "bps", fetchedAt: "2026-06-09T00:00:00.000Z",
  points: [{ ts: 1738713600, value: 310 }, { ts: 1738800000, value: 320 }],
};

afterEach(() => {
  const f = `${dataDir()}/METH_APR.json`;
  if (existsSync(f)) rmSync(f);
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
