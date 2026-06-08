import { describe, it, expect } from "vitest";
import { aggregateSwarm } from "../src/swarm.js";
import { SINGLE_SOURCE_CEILING_BPS } from "../src/types.js";

// METH-like domain for these cases
const P = { domainMin: 0n, domainMax: 100_000n, disagreeScale: 5_000n };

describe("aggregateSwarm", () => {
  it("n=0 → empty result", () => {
    const r = aggregateSwarm([], [], [], [], P);
    expect(r.contributors).toBe(0);
    expect(r.confidenceBps).toBe(0);
    expect(r.ensemble).toBe(0n);
  });

  it("n=1 → quorum cap: confidence ≤ single-source ceiling (NOT 100% 'consensus')", () => {
    // one tight, fully-calibrated agent that would otherwise report ~9600 bps
    const r = aggregateSwarm([48_000n], [52_000n], [9_600], [0n], P);
    expect(r.contributors).toBe(1);
    expect(r.confidenceBps).toBeLessThanOrEqual(SINGLE_SOURCE_CEILING_BPS);
  });

  it("identical tight midpoints (n=3) → near-zero disagreement, high agreement", () => {
    const lo = [49_000n, 49_000n, 49_000n];
    const hi = [51_000n, 51_000n, 51_000n];
    const stated = [9_800, 9_800, 9_800];
    const cal = [0n, 0n, 0n];
    const r = aggregateSwarm(lo, hi, stated, cal, P);
    expect(r.contributors).toBe(3);
    expect(r.disagreementBps).toBeLessThan(500); // tight
    expect(r.confidenceBps).toBeGreaterThan(7_000);
  });

  it("scattered midpoints (n=3) → high disagreement, confidence haircut", () => {
    const tightAgree = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    const scattered = aggregateSwarm(
      [10_000n, 49_000n, 88_000n], [12_000n, 51_000n, 90_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    expect(scattered.disagreementBps).toBeGreaterThan(tightAgree.disagreementBps);
    expect(scattered.confidenceBps).toBeLessThan(tightAgree.confidenceBps);
  });

  it("MIN-combine: a badly-calibrated swarm is haircut even when it agrees", () => {
    const agreeGoodCal = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    const agreeBadCal = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000],
      [-500_000n, -500_000n, -500_000n], P); // worst calibration
    expect(agreeBadCal.confidenceBps).toBeLessThan(agreeGoodCal.confidenceBps);
  });

  it("TVL domain (1e17) does not overflow and produces a finite result", () => {
    const big = { domainMin: 0n, domainMax: 100_000_000_000_000_000n, disagreeScale: 2_000_000_000_000_000n };
    const r = aggregateSwarm(
      [9_000_000_000_000_000n, 9_100_000_000_000_000n, 9_050_000_000_000_000n],
      [9_200_000_000_000_000n, 9_300_000_000_000_000n, 9_250_000_000_000_000n],
      [8_000, 8_000, 8_000], [0n, 0n, 0n], big);
    expect(r.contributors).toBe(3);
    expect(Number.isFinite(r.confidenceBps)).toBe(true);
    expect(r.confidenceBps).toBeGreaterThan(0);
  });
});
