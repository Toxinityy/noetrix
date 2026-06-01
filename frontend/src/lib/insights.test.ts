import { describe, it, expect } from "vitest";
import {
  smartMoneyDivergence,
  uncertaintyLevel,
  notableMove,
  topPerformers,
  topFinding,
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
