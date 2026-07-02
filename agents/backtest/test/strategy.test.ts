import { describe, expect, it } from "vitest";
import { allocMeth, simulate } from "../src/strategy.js";

describe("allocMeth", () => {
  it("is confidence-monotone and clamped", () => {
    expect(allocMeth(0, "Calm")).toBeCloseTo(0.2, 5); // floor
    expect(allocMeth(10000, "Calm")).toBeCloseTo(0.95, 5); // cap
    expect(allocMeth(5000, "Calm")).toBeGreaterThan(allocMeth(2000, "Calm"));
  });
  it("rotates to safety under stress", () => {
    expect(allocMeth(10000, "Stressed")).toBeLessThanOrEqual(0.15);
    expect(allocMeth(10000, "Elevated")).toBeLessThanOrEqual(0.5);
    expect(allocMeth(10000, "Elevated")).toBeGreaterThan(allocMeth(10000, "Stressed"));
  });
});

describe("simulate", () => {
  it("100% mETH compounds the mETH returns", () => {
    const r = simulate([1, 1], [0.1, -0.5], [0.001, 0.001]);
    // (1.1)(0.5) - 1 = -0.45
    expect(r.final).toBeCloseTo(-0.45, 6);
    expect(r.maxDD).toBeLessThan(0);
  });
  it("100% USDY has ~zero drawdown and positive final", () => {
    const r = simulate([0, 0, 0], [-0.9, -0.9, -0.9], [0.001, 0.001, 0.001]);
    expect(r.final).toBeGreaterThan(0);
    expect(r.maxDD).toBeCloseTo(0, 6);
  });
});
