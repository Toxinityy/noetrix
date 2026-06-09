import { describe, it, expect } from "vitest";
import { crpsScore } from "../src/scoring/crps.js";

// domain [0, 100000], N=100, w=1000
describe("crpsScore (RangeCrpsScorer parity)", () => {
  it("centered in-range band [40000,60000], outcome 50000 → 965000", () => {
    // case 3: a2=80000,b2=122000,y2=101000; dya=dby=21000,dba=42000
    // deduction = 1e6 * (2*21000^3) / (3*42000^2*100000) = 35000 → 1e6-35000
    expect(crpsScore(40000n, 60000n, 50000n, 0n, 100000n)).toBe(965000n);
  });
  it("outcome above band: [40000,60000], outcome 90000 → 270000", () => {
    // case 2: y2=181000>b2=122000; numerator=3*(181000-122000)+(122000-80000)=219000
    // deduction = 1e6*219000/(3*100000)=730000 → 1e6-730000
    expect(crpsScore(40000n, 60000n, 90000n, 0n, 100000n)).toBe(270000n);
  });
  it("inverted bounds auto-swap (same as ordered)", () => {
    expect(crpsScore(60000n, 40000n, 50000n, 0n, 100000n)).toBe(965000n);
  });
  it("very wide band is not catastrophically scored (bounded deduction)", () => {
    const s = crpsScore(0n, 100000n, 50000n, 0n, 100000n);
    expect(s).toBeGreaterThan(-1_000_000n);
    expect(s).toBeLessThanOrEqual(1_000_000n);
  });
});
