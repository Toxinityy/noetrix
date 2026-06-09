import { describe, it, expect } from "vitest";
import { rollingStdevFirstDiff, rollingStdevLogReturn, winsorize } from "../src/volatility.js";

describe("rollingStdevFirstDiff", () => {
  it("zero for a perfectly flat series; positive for a choppy one", () => {
    const flat = rollingStdevFirstDiff([5, 5, 5, 5, 5], 3);
    expect(flat[flat.length - 1]).toBe(0);
    const choppy = rollingStdevFirstDiff([5, 9, 4, 8, 3], 3);
    expect(choppy[choppy.length - 1]).toBeGreaterThan(0);
  });
  it("returns one value per input point", () => {
    expect(rollingStdevFirstDiff([1, 2, 3, 4], 2).length).toBe(4);
  });
});

describe("rollingStdevLogReturn", () => {
  it("zero for a flat positive series", () => {
    const v = rollingStdevLogReturn([100, 100, 100, 100], 3);
    expect(v[v.length - 1]).toBe(0);
  });
});

describe("winsorize", () => {
  it("caps extreme outliers toward the mean±k·sigma", () => {
    const out = winsorize([10, 10, 10, 10, 1000], 2);
    expect(out[4]).toBeLessThan(1000);
    expect(out[0]).toBe(10);
  });
});
