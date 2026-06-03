import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";
import type { AgentBand } from "@/lib/insights";
import type { AgentKind, CategoryId } from "@/lib/mockData";

// ─── Snapshot shapes (mirror gen-insights-snapshot.ts output) ──────────────────

export interface SnapPrediction {
  id: number;
  agentId: number;
  status: string; // "Committed" | "Revealed" | "Resolved" | "Cancelled" | "Forfeited"
  low: number;
  high: number;
  confidence: number;
  score: number | null;
  outcome: number | null;
  commitBlock: number;
  resolutionBlock: number;
}

export interface SnapReputation {
  agentId: number;
  accuracyScore: number;
  calibrationScore: number;
  resolvedCount: number;
}

export interface SnapCategory {
  reputations: SnapReputation[];
  predictions: SnapPrediction[];
  feedHistory: LiveFeedPoint[];
  risk: "Normal" | "Caution" | "Frozen" | null;
}

export interface InsightsSnapshot {
  generatedAt: string;
  chainId: number;
  block: number;
  source: "chain" | "mock";
  allocation: { methBps: number; usdyBps: number } | null;
  categories: Record<CategoryId, SnapCategory>;
}

function inferKind(name: string): AgentKind {
  const n = name.toLowerCase();
  if (n.includes("deepseek") || n.includes("claude") || n.includes("haiku") || n.includes("opus") || n.includes("reasoner")) return "CLAUDE";
  if (n.includes("arima")) return "ARIMA";
  if (n.includes("ensemble")) return "ENSEMBLE";
  return "QUANT";
}

/** Reputations → LeaderRow[] (accuracy desc). Live agents are "agent #N" (metadata not fetched). */
export function leaderRowsFromSnapshot(cat: SnapCategory): LeaderRow[] {
  return cat.reputations
    .map((r) => {
      const name = `agent #${r.agentId}`;
      return {
        id: r.agentId,
        name,
        kind: inferKind(name),
        accuracyScore: r.accuracyScore,
        calibrationScore: r.calibrationScore,
        resolvedCount: r.resolvedCount,
        lastUpdatedBlock: 0,
      };
    })
    .sort((a, b) => b.accuracyScore - a.accuracyScore);
}

/** Latest revealed/resolved band per agent, joined with that agent's reputation. */
export function bandsFromSnapshot(cat: SnapCategory): AgentBand[] {
  const repByAgent = new Map(cat.reputations.map((r) => [r.agentId, r]));
  const byAgent = new Map<number, SnapPrediction>();
  for (const p of cat.predictions) {
    if (p.status !== "Revealed" && p.status !== "Resolved") continue;
    const cur = byAgent.get(p.agentId);
    if (!cur || p.commitBlock > cur.commitBlock) byAgent.set(p.agentId, p);
  }
  const out: AgentBand[] = [];
  for (const [agentId, p] of byAgent) {
    const rep = repByAgent.get(agentId);
    out.push({
      agentId,
      name: `agent #${agentId}`,
      accuracyScore: rep?.accuracyScore ?? 0,
      resolvedCount: rep?.resolvedCount ?? 0,
      low: p.low,
      high: p.high,
    });
  }
  return out;
}

/** Feed history → LiveFeedPoint[] sorted ascending by block. */
export function feedFromSnapshot(cat: SnapCategory): LiveFeedPoint[] {
  return [...cat.feedHistory].sort((a, b) => a.block - b.block);
}
