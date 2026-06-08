import { describe, it, expect } from "vitest";
import { newRep, updateRep, repCalibration } from "../src/reputation.js";

describe("reputation (ScoringEngine mirror)", () => {
  it("EMA accuracy = (9*old + score)/10 (starts at 0)", () => {
    const rep = newRep();
    updateRep(rep, 8000, 1_000_000n); // perfect score in bucket 8
    expect(rep.acc).toBe(100_000n); // (9*0 + 1e6)/10
  });
  it("bucket index from stated confidence /1000, clamped to [0,9]", () => {
    const rep = newRep();
    updateRep(rep, 9999, 0n); // bucket 9
    expect(rep.counts[9]).toBe(1n);
    updateRep(rep, 50, 0n); // bucket 0
    expect(rep.counts[0]).toBe(1n);
  });
  it("calibration is 0 until 10 total observations (cold start)", () => {
    const rep = newRep();
    for (let i = 0; i < 9; i++) updateRep(rep, 5000, 0n);
    expect(repCalibration(rep)).toBe(0n);
    updateRep(rep, 5000, 0n); // 10th
    expect(repCalibration(rep) <= 0n).toBe(true);
  });
});
