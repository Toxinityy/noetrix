import { describe, it, expect } from "vitest";
import { leaderRowsFromSnapshot, bandsFromSnapshot, feedFromSnapshot, type SnapCategory } from "@/lib/snapshot";

const cat: SnapCategory = {
  reputations: [
    { agentId: 1, accuracyScore: 900_000, calibrationScore: -10, resolvedCount: 20 },
    { agentId: 2, accuracyScore: 100_000, calibrationScore: -50, resolvedCount: 12 },
  ],
  predictions: [
    { id: 1, agentId: 1, status: "Resolved", low: 3700, high: 3900, confidence: 6000, score: 990000, outcome: 3800, commitBlock: 10, resolutionBlock: 360 },
    { id: 2, agentId: 1, status: "Revealed", low: 3750, high: 3950, confidence: 6000, score: null, outcome: null, commitBlock: 20, resolutionBlock: 370 },
    { id: 3, agentId: 2, status: "Revealed", low: 4000, high: 4200, confidence: 5000, score: null, outcome: null, commitBlock: 15, resolutionBlock: 365 },
  ],
  feedHistory: [
    { block: 100, value: 3800, confidence: 6000, contributors: 2 },
    { block: 200, value: 3820, confidence: 6100, contributors: 2 },
  ],
  risk: "Normal",
};

describe("leaderRowsFromSnapshot", () => {
  it("maps reputations to LeaderRow sorted by accuracy desc", () => {
    const rows = leaderRowsFromSnapshot(cat);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows[0].accuracyScore).toBe(900_000);
  });
});

describe("bandsFromSnapshot", () => {
  it("takes each agent's latest revealed/resolved band joined with reputation", () => {
    const bands = bandsFromSnapshot(cat);
    const a1 = bands.find((b) => b.agentId === 1);
    expect(a1?.low).toBe(3750); // latest by commitBlock (pred 2 over pred 1)
    expect(a1?.resolvedCount).toBe(20);
  });
});

describe("feedFromSnapshot", () => {
  it("maps + sorts feed points by block", () => {
    expect(feedFromSnapshot(cat).map((p) => p.block)).toEqual([100, 200]);
  });
});
