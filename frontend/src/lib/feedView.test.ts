import { describe, expect, it } from "vitest";
import { findLookbackPoint, feedSourceLabel, formatRawFeedFields, onChainFeedSnapshot } from "./feedView";

describe("findLookbackPoint", () => {
  it("selects the point closest to a 24-hour block lookback", () => {
    const history = [
      { block: 100_000, value: 350, confidence: 8000, contributors: 3 },
      { block: 120_000, value: 360, confidence: 8100, contributors: 4 },
      { block: 143_200, value: 380, confidence: 8200, contributors: 5 },
    ];

    expect(findLookbackPoint(history, 43_200)?.block).toBe(100_000);
  });

  it("returns null when history does not cover the requested lookback", () => {
    const history = [
      { block: 140_000, value: 370, confidence: 8100, contributors: 4 },
      { block: 143_200, value: 380, confidence: 8200, contributors: 5 },
    ];

    expect(findLookbackPoint(history, 43_200)).toBeNull();
  });

  it("returns null when the nearest point sits across a data gap (not a real 24h-ago point)", () => {
    // Old cluster far below the 24h target, then a jump to recent — the closest point (the latest,
    // 43_200 off the target) is outside tolerance, so it's not a genuine 24h change.
    const history = [
      { block: 10_000, value: 300, confidence: 8000, contributors: 3 },
      { block: 143_200, value: 380, confidence: 8200, contributors: 5 },
    ];

    expect(findLookbackPoint(history, 43_200)).toBeNull();
  });

  it("accepts a point within tolerance of the 24h target (≈24h ago counts)", () => {
    // Target = 100_000; nearest real point at 95_000 is 5k off (< 21.6k tolerance) and older than
    // the target, so it's a genuine ≈24h-ago point.
    const history = [
      { block: 95_000, value: 355, confidence: 8000, contributors: 3 },
      { block: 143_200, value: 380, confidence: 8200, contributors: 5 },
    ];

    expect(findLookbackPoint(history, 43_200)?.block).toBe(95_000);
  });
});

describe("feedSourceLabel", () => {
  it("does not call mock or snapshot data live", () => {
    expect(feedSourceLabel("live")).toBe("Live indexer");
    expect(feedSourceLabel("snapshot")).toBe("On-chain snapshot");
    expect(feedSourceLabel("cached")).toBe("Cached snapshot");
    expect(feedSourceLabel("mock")).toBe("Demo data");
  });
});

describe("onChainFeedSnapshot", () => {
  it("maps a real on-chain /api/feed read into a single feed point", () => {
    expect(
      onChainFeedSnapshot({
        source: "chain",
        value: "245",
        confidenceBps: 5060,
        contributingAgents: 7,
        lastUpdatedBlock: 39_919_665,
      }),
    ).toEqual({ block: 39_919_665, value: 245, confidence: 5060, contributors: 7 });
  });

  it("returns null for an empty feed (no contributors) so zeros never look live", () => {
    expect(
      onChainFeedSnapshot({ source: "chain", value: "0", confidenceBps: 0, contributingAgents: 0, lastUpdatedBlock: 0 }),
    ).toBeNull();
  });

  it("returns null for error/non-chain responses or missing data", () => {
    expect(onChainFeedSnapshot(null)).toBeNull();
    expect(onChainFeedSnapshot(undefined)).toBeNull();
    expect(onChainFeedSnapshot({ error: "on-chain read failed" } as never)).toBeNull();
    expect(onChainFeedSnapshot({ source: "chain", value: "not-a-number", contributingAgents: 3 })).toBeNull();
  });
});

describe("formatRawFeedFields", () => {
  it("explains basis-point values in human units", () => {
    expect(formatRawFeedFields("METH_APR_24H", BigInt(899), 3531, 2, 39_868_877)).toEqual({
      value: "899 bps = 8.99%",
      confidence: "3,531 bps = 35.31%",
      contributors: "2 agents",
      lastUpdatedBlock: "#39,868,877",
    });
  });
});
