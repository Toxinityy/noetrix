import { describe, it, expect } from "vitest";
import { apyPctToBps, deriveMethRateSeries } from "../src/normalize.js";

describe("apyPctToBps", () => {
  it("10000 bps = 100% (matches MethAprResolver)", () => {
    expect(apyPctToBps(3.5)).toBe(350);
    expect(apyPctToBps(100)).toBe(10000);
    expect(apyPctToBps(5.05)).toBe(505);
  });
});

describe("deriveMethRateSeries", () => {
  it("rate grows so the 24h slope reproduces the apy (monotone up for positive apy)", () => {
    const rates = deriveMethRateSeries([3.65, 3.65, 3.65]); // ~0.01%/day
    expect(rates.length).toBe(3);
    expect(rates[0] > 1_000_000_000_000_000_000n).toBe(true); // grew above base
    expect(rates[2] > rates[1] && rates[1] > rates[0]).toBe(true);
  });
});
