import { describe, it, expect } from "vitest";
import {
  smartMoneyDivergence,
  uncertaintyLevel,
  notableMove,
  topPerformers,
  topFinding,
  topVsCrowdAccuracy,
  signalTrackRecord,
  anomalyTimeline,
  biggestDisagreement,
  type AgentBand,
} from "@/lib/insights";
import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";

const band = (o: Partial<AgentBand>): AgentBand => ({
  agentId: 1, name: "a", accuracyScore: 500_000, resolvedCount: 20, low: 3700, high: 3900, ...o,
});

describe("smartMoneyDivergence", () => {
  it("flags 'higher' when accuracy-weighted smart-money midpoint exceeds the crowd", () => {
    const bands = [band({ agentId: 1, low: 4000, high: 4200, accuracyScore: 900_000 })];
    const d = smartMoneyDivergence(bands, 3800);
    expect(d.enoughData).toBe(true);
    expect(d.direction).toBe("higher");
    expect(d.smartMoneyValue).toBeGreaterThan(3800);
  });
  it("ignores agents below the qualified threshold", () => {
    const d = smartMoneyDivergence([band({ resolvedCount: 5 })], 3800);
    expect(d.enoughData).toBe(false);
    expect(d.smartMoneyValue).toBeNull();
  });
  it("returns enoughData=false when crowd value is null", () => {
    expect(smartMoneyDivergence([band({})], null).enoughData).toBe(false);
  });
});

describe("uncertaintyLevel", () => {
  it("is Low when qualified bands cluster tightly", () => {
    const bands = [band({ agentId: 1, low: 3790, high: 3810 }), band({ agentId: 2, low: 3795, high: 3805 })];
    expect(uncertaintyLevel(bands, 3800).level).toBe("Low");
  });
  it("is High when midpoints are far apart", () => {
    const bands = [band({ agentId: 1, low: 3000, high: 3100 }), band({ agentId: 2, low: 4500, high: 4600 })];
    expect(uncertaintyLevel(bands, 3800).level).toBe("High");
  });
});

describe("notableMove", () => {
  const pt = (value: number, block: number): LiveFeedPoint => ({ block, value, confidence: 7000, contributors: 5 });
  it("flags a move above threshold", () => {
    const hist = [pt(3800, 1), pt(3800, 2), pt(3990, 3)];
    const m = notableMove(hist, 2, 1);
    expect(m.isNotable).toBe(true);
    expect(m.direction).toBe("up");
  });
  it("is not notable for a tiny move", () => {
    const hist = [pt(3800, 1), pt(3801, 2)];
    expect(notableMove(hist, 1, 1).isNotable).toBe(false);
  });
});

describe("topPerformers", () => {
  const row = (id: number, acc: number, resolved: number): LeaderRow => ({
    id, name: `agent #${id}`, kind: "CLAUDE", accuracyScore: acc, calibrationScore: -1, resolvedCount: resolved, lastUpdatedBlock: 1,
  });
  it("filters below-threshold and sorts by accuracy desc", () => {
    const rows = [row(1, 100, 5), row(2, 800, 20), row(3, 500, 15)];
    const top = topPerformers(rows, 2);
    expect(top.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("topFinding", () => {
  it("prefers a notable move headline", () => {
    const div = smartMoneyDivergence([], null);
    const m = { deltaPct: 2.4, isNotable: true, direction: "up" as const, current: 100, prior: 97 };
    expect(topFinding(div, m, "mETH staking yield")).toContain("jumped");
  });
});

describe("topVsCrowdAccuracy", () => {
  const r = (id: number, acc: number, resolved: number): LeaderRow => ({
    id, name: `agent #${id}`, kind: "CLAUDE", accuracyScore: acc, calibrationScore: -1, resolvedCount: resolved, lastUpdatedBlock: 1,
  });
  it("reports top-N as more accurate than the crowd mean", () => {
    const rows = [r(1, 900_000, 20), r(2, 100_000, 20), r(3, -200_000, 20)];
    const t = topVsCrowdAccuracy(rows, 1);
    expect(t.enoughData).toBe(true);
    expect(t.pctMoreAccurate).toBeGreaterThan(0);
  });
  it("needs qualified agents", () => {
    expect(topVsCrowdAccuracy([r(1, 900_000, 5)], 1).enoughData).toBe(false);
  });
});

describe("signalTrackRecord", () => {
  const p = (low: number, high: number, outcome: number | null, status = "Resolved", qualified = true) =>
    ({ low, high, outcome, status, qualified });
  it("counts outcomes that land inside the band as hits", () => {
    const t = signalTrackRecord([p(10, 20, 15), p(10, 20, 25), p(10, 20, 12)]);
    expect(t.total).toBe(3);
    expect(t.hits).toBe(2);
    expect(t.ratePct).toBeCloseTo(66.7, 0);
  });
  it("ignores unresolved, unqualified, and outcome-less rows", () => {
    const t = signalTrackRecord([p(10, 20, 15, "Revealed"), p(10, 20, 15, "Resolved", false), p(10, 20, null)]);
    expect(t.total).toBe(0);
    expect(t.enoughData).toBe(false);
  });
});

describe("anomalyTimeline", () => {
  const pt = (value: number, block: number): LiveFeedPoint => ({ block, value, confidence: 7000, contributors: 5 });
  it("flags moves over threshold across the lookback", () => {
    const hist = [pt(100, 1), pt(100, 2), pt(110, 3)];
    const a = anomalyTimeline(hist, 2, 5);
    expect(a).toHaveLength(1);
    expect(a[0].direction).toBe("up");
    expect(a[0].deltaPct).toBeCloseTo(10, 5);
  });
  it("ignores sub-threshold moves", () => {
    expect(anomalyTimeline([pt(100, 1), pt(101, 2)], 1, 5)).toHaveLength(0);
  });
});

describe("biggestDisagreement", () => {
  const b = (id: number, low: number, high: number): AgentBand => ({
    agentId: id, name: `a${id}`, accuracyScore: 500_000, resolvedCount: 20, low, high,
  });
  it("finds the high/low band pair and spread vs crowd", () => {
    const d = biggestDisagreement([b(1, 3000, 3100), b(2, 4500, 4600)], 3800);
    expect(d.enoughData).toBe(true);
    expect(d.highAgent?.agentId).toBe(2);
    expect(d.lowAgent?.agentId).toBe(1);
    expect(d.spreadPct).toBeGreaterThan(0);
  });
  it("needs at least two qualified bands", () => {
    expect(biggestDisagreement([b(1, 3000, 3100)], 3800).enoughData).toBe(false);
  });
});
