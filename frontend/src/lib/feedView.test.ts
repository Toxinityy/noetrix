import { describe, expect, it } from "vitest";
import { findLookbackPoint, feedSourceLabel, formatRawFeedFields } from "./feedView";

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
});

describe("feedSourceLabel", () => {
  it("does not call mock or snapshot data live", () => {
    expect(feedSourceLabel("live")).toBe("Live indexer");
    expect(feedSourceLabel("snapshot")).toBe("On-chain snapshot");
    expect(feedSourceLabel("cached")).toBe("Cached snapshot");
    expect(feedSourceLabel("mock")).toBe("Demo data");
  });
});

describe("formatRawFeedFields", () => {
  it("explains basis-point values in human units", () => {
    expect(formatRawFeedFields("METH_APR_24H", 899n, 3531, 2, 39_868_877)).toEqual({
      value: "899 bps = 8.99%",
      confidence: "3,531 bps = 35.31%",
      contributors: "2 agents",
      lastUpdatedBlock: "#39,868,877",
    });
  });
});
