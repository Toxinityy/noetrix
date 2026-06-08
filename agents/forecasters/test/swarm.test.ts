import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
    const r = aggregateSwarm([48_000n], [52_000n], [9_600], [0n], P);
    expect(r.contributors).toBe(1);
    expect(r.confidenceBps).toBeLessThanOrEqual(SINGLE_SOURCE_CEILING_BPS);
  });

  it("genuinely tight bands + identical midpoints (n=3) → near-zero disagreement, high confidence", () => {
    // width 400 over span 100000, disagreeScale 5000 → dRaw=200 → d=40000 → disagreementBps=400
    const lo = [49_800n, 49_800n, 49_800n];
    const hi = [50_200n, 50_200n, 50_200n];
    const r = aggregateSwarm(lo, hi, [9_800, 9_800, 9_800], [0n, 0n, 0n], P);
    expect(r.contributors).toBe(3);
    expect(r.disagreementBps).toBeLessThan(500);
    expect(r.confidenceBps).toBeGreaterThan(7_000);
  });

  it("ANTI-GAMING: identical midpoints but full-domain bands → high disagreement + confidence haircut", () => {
    // wide bands must NOT read as agreement. Wbar dominates → disagreement maxes, agreement floors.
    const tight = aggregateSwarm(
      [49_800n, 49_800n, 49_800n], [50_200n, 50_200n, 50_200n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    const wide = aggregateSwarm(
      [0n, 0n, 0n], [100_000n, 100_000n, 100_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    expect(wide.disagreementBps).toBeGreaterThan(5_000);
    expect(wide.disagreementBps).toBeGreaterThan(tight.disagreementBps);
    expect(wide.confidenceBps).toBeLessThan(tight.confidenceBps);
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
      [-500_000n, -500_000n, -500_000n], P);
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

describe("aggregateSwarm golden vectors (exact-match regression + Plan 3 parity anchor)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const vectors = JSON.parse(readFileSync(join(here, "vectors/swarm-vectors.json"), "utf8")) as Array<{
    name: string; lo: string[]; hi: string[]; stated: number[]; cal: string[];
    params: { domainMin: string; domainMax: string; disagreeScale: string };
    expected: { ensemble: string; confidenceBps: number; disagreementBps: number; contributors: number };
  }>;

  for (const v of vectors) {
    it(`vector ${v.name} matches exactly`, () => {
      const r = aggregateSwarm(
        v.lo.map(BigInt), v.hi.map(BigInt), v.stated, v.cal.map(BigInt),
        { domainMin: BigInt(v.params.domainMin), domainMax: BigInt(v.params.domainMax), disagreeScale: BigInt(v.params.disagreeScale) },
      );
      expect(r.ensemble.toString()).toBe(v.expected.ensemble);
      expect(r.confidenceBps).toBe(v.expected.confidenceBps);
      expect(r.disagreementBps).toBe(v.expected.disagreementBps);
      expect(r.contributors).toBe(v.expected.contributors);
    });
  }
});
