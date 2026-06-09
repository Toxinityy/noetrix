import { describe, it, expect } from "vitest";
import { arima } from "../src/strategies/arima.js";

describe("arima(1,1,1)", () => {
  it("short series → unfitted last-value fallback", () => {
    const b = arima([5, 6], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(6);
    expect(b.lower).toBe(6);
    expect(b.upper).toBe(6);
  });
  it("trending series → forecast continues upward, band non-degenerate", () => {
    const b = arima([10, 12, 14, 16, 18, 20, 22, 24], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(true);
    expect(b.mean).toBeGreaterThan(24);
    expect(b.upper).toBeGreaterThan(b.lower);
  });
});
