import { describe, it, expect } from "vitest";
import { buildRoster } from "../src/roster.js";
import { metricView } from "../src/view.js";

const view = metricView("METH_APR");

describe("buildRoster", () => {
  it("includes the 6 statistical agents (deepseek omitted without a cache)", () => {
    const roster = buildRoster(null);
    expect(roster.map((a) => a.key).sort()).toEqual(
      ["arima", "ewmaVol", "meanReversion", "momentum", "persistence", "sentiment"].sort(),
    );
  });
  it("includes deepseek when a cache is provided", () => {
    const cache = { "METH_APR:1000": { lower: 300, upper: 360, confidence: 8000 } };
    const roster = buildRoster(cache);
    expect(roster.some((a) => a.key === "deepseek")).toBe(true);
  });
  it("each statistical agent produces a Band from a working-unit series", () => {
    const roster = buildRoster(null);
    const hist = [300, 310, 305, 315, 320, 318, 325, 330];
    for (const a of roster) {
      const band = a.forecast(hist, view, 50, "METH_APR", 1000);
      expect(typeof band.mean).toBe("number");
      expect(band.upper).toBeGreaterThanOrEqual(band.lower);
    }
  });
});
