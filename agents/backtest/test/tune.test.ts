import { describe, it, expect } from "vitest";
import { percentileBig, tuneDisagreeScale, splitIndex } from "../src/tune.js";

describe("percentileBig", () => {
  it("returns the p-th percentile of a bigint list", () => {
    const xs = [10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n, 90n, 100n];
    expect(percentileBig(xs, 90)).toBe(90n);
    expect(percentileBig(xs, 50)).toBe(50n);
  });
  it("empty → 1n floor (avoids divide-by-zero scale)", () => {
    expect(percentileBig([], 90)).toBe(1n);
  });
});

describe("splitIndex", () => {
  it("70/30 split of a 100-length series", () => {
    expect(splitIndex(100, 0.7)).toBe(70);
  });
});

describe("tuneDisagreeScale", () => {
  it("derives a positive scale from observed dispersions", () => {
    const series = Array.from({ length: 40 }, (_, i) => 320 + (i % 5) * 4);
    const scale = tuneDisagreeScale("METH_APR", series, series.map(() => 50), 0.7);
    expect(scale > 0n).toBe(true);
  });
});
