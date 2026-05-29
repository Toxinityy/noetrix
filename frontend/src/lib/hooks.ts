"use client";

import { useQuery } from "@tanstack/react-query";
import { hasIndexer } from "@/lib/env";
import { getLeaderboard, getFeedHistory, type LeaderRow, type LiveFeedPoint } from "@/lib/indexer";
import { AGENTS, CATEGORIES, makeFeedHistory, type CategoryId } from "@/lib/mockData";

export type DataSource = "live" | "mock";

export interface QueryView<T> {
  data: T;
  source: DataSource;
  isLoading: boolean;
  isError: boolean;
}

const REFRESH_MS = 30_000;

function mockLeaderRows(category: CategoryId): LeaderRow[] {
  return AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    accuracyScore: a.reputation[category].accuracyScore,
    calibrationScore: a.reputation[category].calibrationScore,
    resolvedCount: a.reputation[category].resolvedCount,
    lastUpdatedBlock: a.reputation[category].lastUpdatedBlock,
    controller: a.controller,
  }));
}

function mockFeedPoints(category: CategoryId): LiveFeedPoint[] {
  return makeFeedHistory(category, 96).map((p) => ({
    block: p.block,
    value: p.value,
    confidence: p.confidence,
    contributors: p.contributors,
  }));
}

/// Per-category leaderboard. Live from the indexer (30s refresh) when configured; otherwise the
/// curated mock set. On a live error it falls back to mock so the page still renders.
export function useLeaderboard(category: CategoryId): QueryView<LeaderRow[]> {
  const q = useQuery({
    queryKey: ["leaderboard", category],
    queryFn: () => getLeaderboard(category),
    enabled: hasIndexer,
    refetchInterval: REFRESH_MS,
  });

  if (!hasIndexer) {
    return { data: mockLeaderRows(category), source: "mock", isLoading: false, isError: false };
  }
  if (q.data && q.data.length > 0) {
    return { data: q.data, source: "live", isLoading: false, isError: false };
  }
  if (q.isLoading) {
    return { data: [], source: "live", isLoading: true, isError: false };
  }
  // Empty live result or error → mock fallback (flag error so the UI can hint).
  return { data: mockLeaderRows(category), source: "mock", isLoading: false, isError: q.isError };
}

export function useFeedHistory(category: CategoryId): QueryView<LiveFeedPoint[]> {
  const q = useQuery({
    queryKey: ["feed-history", category],
    queryFn: () => getFeedHistory(category),
    enabled: hasIndexer,
    refetchInterval: REFRESH_MS,
  });

  if (!hasIndexer) {
    return { data: mockFeedPoints(category), source: "mock", isLoading: false, isError: false };
  }
  if (q.data && q.data.length > 0) {
    return { data: q.data, source: "live", isLoading: false, isError: false };
  }
  if (q.isLoading) {
    return { data: [], source: "live", isLoading: true, isError: false };
  }
  return { data: mockFeedPoints(category), source: "mock", isLoading: false, isError: q.isError };
}

export { CATEGORIES };
