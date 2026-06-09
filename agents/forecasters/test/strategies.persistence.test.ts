import { describe, it, expect } from "vitest";
import { persistence } from "../src/strategies/persistence.js";

describe("persistence", () => {
  it("mean = last value", () => {
    const b = persistence([10, 11, 12], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBe(12);
    expect(b.fitted).toBe(true);
  });
  it("band widens with recent volatility", () => {
    const calm = persistence([50, 50, 50, 50], { domainMin: 0, domainMax: 100 });
    const choppy = persistence([50, 60, 40, 55], { domainMin: 0, domainMax: 100 });
    expect(choppy.upper - choppy.lower).toBeGreaterThan(calm.upper - calm.lower);
  });
  it("empty series → unfitted", () => {
    const b = persistence([], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
  });
});
