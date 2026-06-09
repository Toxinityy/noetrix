import { describe, it, expect } from "vitest";
import { momentum } from "../src/strategies/momentum.js";

describe("momentum", () => {
  it("extrapolates an upward trend above the last value", () => {
    const b = momentum([10, 12, 14, 16, 18], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeGreaterThan(18);
    expect(b.fitted).toBe(true);
  });
  it("extrapolates a downward trend below the last value", () => {
    const b = momentum([30, 28, 26, 24, 22], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeLessThan(22);
  });
  it("short series → unfitted last-value", () => {
    const b = momentum([9], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(9);
  });
});
