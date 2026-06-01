"use client";

import { useQuery } from "@tanstack/react-query";
import { hasIndexer } from "@/lib/env";
import { getLeaderboard, getFeedHistory, getAgentPredictions, type LeaderRow, type LiveFeedPoint } from "@/lib/indexer";
import { AGENTS, CATEGORIES, PREDICTIONS, makeFeedHistory, type CategoryId } from "@/lib/mockData";
import { categoryHash } from "@/lib/contracts";
import type { AgentBand } from "@/lib/insights";
import { MIN_RESOLVED_QUALIFIED, SMART_MONEY_TOP_N } from "@/lib/insights";

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

function mockBands(category: CategoryId): AgentBand[] {
  const out: AgentBand[] = [];
  for (const a of AGENTS) {
    const latest = PREDICTIONS.filter(
      (p) => p.agentId === a.id && p.categoryId === category && p.status === "Revealed",
    ).sort((p, q) => q.commitBlock - p.commitBlock)[0];
    if (!latest) continue;
    out.push({
      agentId: a.id,
      name: a.name,
      accuracyScore: a.reputation[category].accuracyScore,
      resolvedCount: a.reputation[category].resolvedCount,
      low: latest.value.low,
      high: latest.value.high,
    });
  }
  return out;
}

/// Latest revealed band per qualified agent in a category, for the smart-money centerpiece.
/// Mock path uses curated PREDICTIONS; live path fetches the top-8 leaderboard agents' predictions.
export function useSmartMoneyBands(category: CategoryId): QueryView<AgentBand[]> {
  const q = useQuery({
    queryKey: ["smart-money-bands", category],
    enabled: hasIndexer,
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<AgentBand[]> => {
      const board = await getLeaderboard(category, 50);
      const top = board
        .filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED)
        .sort((a, b) => b.accuracyScore - a.accuracyScore)
        .slice(0, SMART_MONEY_TOP_N);
      const wantHash = categoryHash(category).toLowerCase();
      const perAgent = await Promise.all(
        top.map(async (r) => {
          const preds = await getAgentPredictions(r.id, 50);
          const latest = preds
            .filter(
              (p) =>
                p.value !== undefined &&
                String(p.categoryId).toLowerCase() === wantHash &&
                (p.status === "Revealed" || p.status === "Resolved"),
            )
            .sort((a, b) => b.commitBlock - a.commitBlock)[0];
          if (!latest || !latest.value) return null;
          const band: AgentBand = {
            agentId: r.id,
            name: r.name,
            accuracyScore: r.accuracyScore,
            resolvedCount: r.resolvedCount,
            low: latest.value.low,
            high: latest.value.high,
          };
          return band;
        }),
      );
      return perAgent.filter((b): b is AgentBand => b !== null);
    },
  });

  if (!hasIndexer) {
    return { data: mockBands(category), source: "mock", isLoading: false, isError: false };
  }
  if (q.data && q.data.length > 0) {
    return { data: q.data, source: "live", isLoading: false, isError: false };
  }
  if (q.isLoading) {
    return { data: [], source: "live", isLoading: true, isError: false };
  }
  // Live empty/failed → mock so the centerpiece still renders (demo-shaped).
  return { data: mockBands(category), source: "mock", isLoading: false, isError: q.isError };
}

export { CATEGORIES };
