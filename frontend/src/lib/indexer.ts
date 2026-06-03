import { decodeAbiParameters, type Hex } from "viem";
import { env } from "@/lib/env";
import type { AgentKind, CategoryId } from "@/lib/mockData";

const RANGE_ABI = [{ type: "uint256" }, { type: "uint256" }] as const;

// ─── Normalized shapes (live + mock both produced as these) ─────────────────────

export interface LeaderRow {
  id: number;
  name: string;
  kind: AgentKind;
  accuracyScore: number;
  calibrationScore: number;
  resolvedCount: number;
  lastUpdatedBlock: number;
  controller?: string;
}

export interface LivePrediction {
  id: number;
  categoryId: CategoryId | string;
  status: string;
  value?: { low: number; high: number };
  confidence?: number;
  contentHash: string;
  stake: number;
  commitBlock: number;
  resolutionBlock: number;
  score?: number;
}

export interface LiveFeedPoint {
  block: number;
  value: number;
  confidence: number;
  contributors: number;
}

export interface LiveAgent {
  id: number;
  controller: string;
  metadataURI: string;
  registeredBlock: number;
  totalPredictions: number;
  totalResolved: number;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${env.indexerUrl}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`indexer ${res.status} on ${path}`);
  return (await res.json()) as T;
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

/// Infer a display kind from the agent's metadata/name when the indexer has no explicit kind.
function inferKind(name: string): AgentKind {
  const n = name.toLowerCase();
  if (n.includes("deepseek") || n.includes("reasoner") || n.includes("claude") || n.includes("haiku") || n.includes("opus")) return "CLAUDE";
  if (n.includes("arima")) return "ARIMA";
  if (n.includes("ensemble")) return "ENSEMBLE";
  return "QUANT";
}

interface RepRow {
  agentId: string;
  accuracyScore: string;
  calibrationScore: string;
  resolvedCount: string;
  lastUpdatedBlock: string;
}

export async function getLeaderboard(category: CategoryId, limit = 50): Promise<LeaderRow[]> {
  const json = await get<{ leaderboard: RepRow[] }>(
    `/leaderboard?category=${category}&limit=${limit}`,
  );
  return (json.leaderboard ?? []).map((r) => {
    const id = num(r.agentId);
    const name = `agent #${id}`;
    return {
      id,
      name,
      kind: inferKind(name),
      accuracyScore: num(r.accuracyScore),
      calibrationScore: num(r.calibrationScore),
      resolvedCount: num(r.resolvedCount),
      lastUpdatedBlock: num(r.lastUpdatedBlock),
    };
  });
}

export async function getAgent(id: number): Promise<{ agent: LiveAgent; reputations: Record<string, RepRow> }> {
  const json = await get<{
    agent: { id: string; controller: string; metadataURI: string; registeredAt: string; totalPredictions: number; totalResolved: number };
    reputations: (RepRow & { categoryId: string })[];
  }>(`/agent/${id}`);
  const reputations: Record<string, RepRow> = {};
  for (const r of json.reputations ?? []) reputations[r.categoryId.toLowerCase()] = r;
  return {
    agent: {
      id: num(json.agent.id),
      controller: json.agent.controller,
      metadataURI: json.agent.metadataURI,
      registeredBlock: num(json.agent.registeredAt),
      totalPredictions: json.agent.totalPredictions,
      totalResolved: json.agent.totalResolved,
    },
    reputations,
  };
}

interface PredRow {
  id: string;
  categoryId: string;
  status: string;
  value: Hex | null;
  confidence: number | null;
  contentHash: string;
  stake: string;
  commitBlock: string;
  resolutionBlock: string;
  score: string | null;
}

export async function getAgentPredictions(id: number, limit = 50): Promise<LivePrediction[]> {
  const json = await get<{ predictions: PredRow[] }>(`/agent/${id}/predictions?limit=${limit}`);
  return (json.predictions ?? []).map((p) => {
    let value: { low: number; high: number } | undefined;
    if (p.value && p.value !== "0x") {
      try {
        const [low, high] = decodeAbiParameters(RANGE_ABI, p.value) as [bigint, bigint];
        value = { low: Number(low), high: Number(high) };
      } catch {
        /* leave undefined */
      }
    }
    return {
      id: num(p.id),
      categoryId: p.categoryId,
      status: p.status,
      value,
      confidence: p.confidence ?? undefined,
      contentHash: p.contentHash,
      stake: num(p.stake) / 1e18,
      commitBlock: num(p.commitBlock),
      resolutionBlock: num(p.resolutionBlock),
      score: p.score != null ? num(p.score) : undefined,
    };
  });
}

interface SnapRow {
  value: string;
  confidence: number;
  contributingAgents: string;
  snapshotBlock: string;
}

export async function getFeedHistory(category: CategoryId, limit = 96): Promise<LiveFeedPoint[]> {
  const json = await get<{ history: SnapRow[] }>(`/feed/${category}/history?limit=${limit}`);
  return (json.history ?? [])
    .map((s) => ({
      block: num(s.snapshotBlock),
      value: num(s.value),
      confidence: s.confidence,
      contributors: num(s.contributingAgents),
    }))
    .sort((a, b) => a.block - b.block);
}
