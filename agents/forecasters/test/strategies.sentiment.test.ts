import { describe, it, expect } from "vitest";
import { sentiment } from "../src/strategies/sentiment.js";

describe("sentiment (fear & greed tilt)", () => {
  const opts = { domainMin: 0, domainMax: 100 };
  it("greed tilts the forecast above last; fear tilts below", () => {
    const greed = sentiment([50, 50, 50], opts, 90); // extreme greed
    const fear = sentiment([50, 50, 50], opts, 10); // extreme fear
    expect(greed.mean).toBeGreaterThan(50);
    expect(fear.mean).toBeLessThan(50);
  });
  it("fear widens the band vs neutral", () => {
    const neutral = sentiment([50, 50, 50], opts, 50);
    const fear = sentiment([50, 50, 50], opts, 10);
    expect(fear.upper - fear.lower).toBeGreaterThan(neutral.upper - neutral.lower);
  });
  it("neutral (50) → mean ≈ last", () => {
    const b = sentiment([42, 42, 42], opts, 50);
    expect(b.mean).toBeCloseTo(42, 6);
  });
  it("missing fg → unfitted last-value", () => {
    const b = sentiment([42, 42], opts, undefined);
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(42);
  });
});
