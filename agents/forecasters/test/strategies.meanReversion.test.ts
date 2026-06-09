import { describe, it, expect } from "vitest";
import { meanReversion } from "../src/strategies/meanReversion.js";

describe("meanReversion", () => {
  it("pulls a spiked last value back toward the moving mean", () => {
    // long run around 50, last spikes to 80 → forecast should sit between 80 and 50
    const series = [50, 50, 50, 50, 50, 50, 50, 50, 50, 80];
    const b = meanReversion(series, { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeLessThan(80);
    expect(b.mean).toBeGreaterThan(50);
    expect(b.fitted).toBe(true);
  });
  it("flat series → forecast ≈ last (no reversion pressure)", () => {
    const b = meanReversion([42, 42, 42, 42, 42], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeCloseTo(42, 6);
  });
  it("short series → unfitted last-value", () => {
    const b = meanReversion([7], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(7);
  });
});
