import { describe, expect, it } from "vitest";
import { dashboardCategoryFeedStatus, dashboardProtocolMetrics, dashboardSystemStatus } from "@/app/terminal/dashboard/DashboardClient";
import type { InsightsData } from "@/lib/hooks";
import type { CategoryId } from "@/lib/mockData";

function data(overrides: Partial<InsightsData> = {}): InsightsData {
  return {
    source: "live",
    board: [
      { id: 1, name: "ARIMA Baseline", kind: "ARIMA", accuracyScore: 340000, calibrationScore: 0, resolvedCount: 12, lastUpdatedBlock: 100, controller: "0x1" },
      { id: 2, name: "DeepSeek Reasoner", kind: "CLAUDE", accuracyScore: 220000, calibrationScore: 0, resolvedCount: 8, lastUpdatedBlock: 101, controller: "0x2" },
    ],
    feed: [{ block: 120, value: 3081, confidence: 7600, contributors: 2 }],
    bands: [],
    crowdValue: 3081,
    category: {
      predictions: [
        { id: 1, agentId: 1, status: "Resolved", low: 3000, high: 3150, confidence: 5000, score: 900000, commitBlock: 10, resolutionBlock: 30, outcome: 3081 },
      ],
      reputations: [],
      feedHistory: [],
      risk: "Normal",
    },
    allocation: null,
    generatedAt: "2026-06-08T00:00:00.000Z",
    block: 120,
    isLoading: false,
    ...overrides,
  };
}

describe("terminal dashboard derived facts", () => {
  it("summarizes category feed status from factual snapshot data", () => {
    const status = dashboardCategoryFeedStatus("METH_APR_24H", data());

    expect(status.categoryId).toBe<CategoryId>("METH_APR_24H");
    expect(status.value).toBe(3081);
    expect(status.confidence).toBe(7600);
    expect(status.contributors).toBe(2);
    expect(status.block).toBe(120);
    expect(status.source).toBe("live");
  });

  it("counts resolved forecasts, listed agents, qualified agents, and active categories", () => {
    const metrics = dashboardProtocolMetrics([data(), data({ block: 130 })]);

    expect(metrics.resolvedForecasts).toBe(2);
    expect(metrics.listedAgents).toBe(2);
    expect(metrics.qualifiedAgents).toBe(1);
    expect(metrics.activeCategories).toBe(2);
    expect(metrics.block).toBe(130);
    expect(metrics.source).toBe("live");
  });

  it("reports network and configuration status factually", () => {
    const status = dashboardSystemStatus(data(), false, true);

    expect(status.network).toBe("Mantle Sepolia");
    expect(status.indexer).toBe("no live indexer configured");
    expect(status.snapshot).toBe("snapshot 2026-06-08T00:00:00.000Z @ block 120");
    expect(status.subscriptionGate).toBe("subscription gate configured");
  });
});
