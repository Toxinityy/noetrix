"use client";

import { useQuery } from "@tanstack/react-query";
import { hasIndexer } from "@/lib/env";
import { getLeaderboard, getFeedHistory, type LeaderRow, type LiveFeedPoint } from "@/lib/indexer";
import { AGENTS, CATEGORIES, makeFeedHistory, type CategoryId } from "@/lib/mockData";

export type DataSource = "live" | "cached" | "mock";

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

interface FallbackFile {
  generatedAt: string;
  source: string;
  categories: Record<string, LeaderRow[]>;
}

/// Static fallback dataset (public/fallback-leaderboard.json), served when the live indexer is
/// unreachable. Loaded once, cached forever. Demo-safety per Prompt 13 Part B.
function useFallbackLeaderboard() {
  return useQuery({
    queryKey: ["fallback-leaderboard"],
    queryFn: async (): Promise<FallbackFile | null> => {
      const res = await fetch("/fallback-leaderboard.json");
      if (!res.ok) return null;
      return (await res.json()) as FallbackFile;
    },
    enabled: hasIndexer, // only needed as a safety net when we're attempting live fetches
    staleTime: Infinity,
    retry: false,
  });
}

/// Per-category leaderboard. Live from the indexer (30s refresh) when configured; on failure it
/// serves the static cached snapshot (source "cached"); without an indexer it uses curated mock data.
export function useLeaderboard(category: CategoryId): QueryView<LeaderRow[]> {
  const fallback = useFallbackLeaderboard();
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
  // Live failed/empty → static cached snapshot, else curated mock.
  const cached = fallback.data?.categories?.[category];
  if (cached && cached.length > 0) {
    return { data: cached, source: "cached", isLoading: false, isError: true };
  }
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
