import { describe, it, expect } from "vitest";
import { calibration } from "../src/scoring/calibration.js";

describe("calibration (ScoringEngine._calibration parity)", () => {
  it("cold start (total < 10) → 0", () => {
    const buckets = new Array(10).fill(0n);
    const counts = new Array(10).fill(0n);
    counts[0] = 9n;
    expect(calibration(buckets, counts)).toBe(0n);
  });
  it("perfect calibration (bucket = its midpoint) → 0", () => {
    const buckets = Array.from({ length: 10 }, (_, i) => BigInt(i * 100_000 + 50_000));
    const counts = new Array(10).fill(1n); // total = 10
    expect(calibration(buckets, counts)).toBe(0n);
  });
  it("bucket0 measured 0 vs midpoint 50000, count 10 → -10000", () => {
    // diff=50000, sq=2.5e9, sumWeightedSq=2.5e10, denom=10*1e6, cal=-((2.5e10*4)/1e7)=-10000
    const buckets = new Array(10).fill(0n);
    const counts = new Array(10).fill(0n);
    counts[0] = 10n;
    expect(calibration(buckets, counts)).toBe(-10_000n);
  });
});
