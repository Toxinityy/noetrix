import { describe, expect, it } from "vitest";
import {
  findLookbackPoint,
  feedSourceLabel,
  formatRawFeedFields,
  onChainFeedSnapshot,
  forecastMoves,
  windowFeedHistory,
  WEEK_BLOCKS,
} from "./feedView";

const pt = (block: number, value: number) => ({ block, value, confidence: 8000, contributors: 5 });

describe("forecastMoves", () => {
  it("collapses held-flat repeats to the value-change points and keeps the latest", () => {
    const history = [pt(1, 300), pt(2, 300), pt(3, 340), pt(4, 340), pt(5, 340)];
    // 300 (first), 340 (change at block 3), 340 (latest, block 5 — kept so the line reaches now)
    expect(forecastMoves(history).map((p) => p.block)).toEqual([1, 3, 5]);
  });

  it("keeps every point when each value differs", () => {
    const history = [pt(1, 300), pt(2, 310), pt(3, 305)];
    expect(forecastMoves(history)).toHaveLength(3);
  });
});

describe("windowFeedHistory", () => {
  it("drops points before a >1-day gap (stopped-bot outage)", () => {
    const history = [pt(1_000, 300), pt(2_000, 305), pt(1_000_000, 320), pt(1_010_000, 325)];
    // gap 2_000 → 1_000_000 exceeds a day → window starts at the recent cluster
    expect(windowFeedHistory(history).map((p) => p.block)).toEqual([1_000_000, 1_010_000]);
  });

  it("caps a dense contiguous run to the most recent 7 days", () => {
    const latest = 10_000_000;
    const history = [
      pt(latest - WEEK_BLOCKS - 5_000, 300), // older than 7d → trimmed
      pt(latest - 1_000, 320),
      pt(latest, 325),
    ];
    expect(windowFeedHistory(history).map((p) => p.block)).toEqual([latest - 1_000, latest]);
  });
});

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
      onChainFeedSnapshot("METH_APR_24H", {
        source: "chain",
        value: "245",
        confidenceBps: 5060,
        contributingAgents: 7,
        lastUpdatedBlock: 39_919_665,
      }),
    ).toEqual({ block: 39_919_665, value: 245, confidence: 5060, contributors: 7 });
  });

  it("scales 8-dec USD categories to whole USD (matching the snapshot path)", () => {
    // Live regression: raw 8-dec values rendered as "$13,587.9T" TVL / "$43.9M" MNT.
    expect(
      onChainFeedSnapshot("AAVE_MANTLE_TVL_24H", {
        source: "chain", value: "13587911822488898", confidenceBps: 8226, contributingAgents: 7, lastUpdatedBlock: 1,
      })?.value,
    ).toBeCloseTo(135_879_118.22, 1);
    expect(
      onChainFeedSnapshot("MNT_USD_SPOT", {
        source: "chain", value: "43940443", confidenceBps: 3378, contributingAgents: 1, lastUpdatedBlock: 1,
      })?.value,
    ).toBeCloseTo(0.4394, 4);
  });

  it("returns null for an empty feed (no contributors) so zeros never look live", () => {
    expect(
      onChainFeedSnapshot("METH_APR_24H", { source: "chain", value: "0", confidenceBps: 0, contributingAgents: 0, lastUpdatedBlock: 0 }),
    ).toBeNull();
  });

  it("returns null for error/non-chain responses or missing data", () => {
    expect(onChainFeedSnapshot("METH_APR_24H", null)).toBeNull();
    expect(onChainFeedSnapshot("METH_APR_24H", undefined)).toBeNull();
    expect(onChainFeedSnapshot("METH_APR_24H", { error: "on-chain read failed" } as never)).toBeNull();
    expect(onChainFeedSnapshot("METH_APR_24H", { source: "chain", value: "not-a-number", contributingAgents: 3 })).toBeNull();
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
