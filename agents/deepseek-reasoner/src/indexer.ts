import { decodeAbiParameters, type Hex } from "viem";
import { categoryId } from "@predictor-index/sdk";

const RANGE_ABI = [{ type: "uint256" }, { type: "uint256" }] as const;

interface PredictionRow {
  id: string;
  categoryId: Hex;
  value: Hex | null;
  status: string;
  commitBlock: string;
  score: string | null;
}

interface FeedSnapshotRow {
  value: string;
  confidence: number;
  contributingAgents: string;
  snapshotBlock: string;
}

export interface PastPrediction {
  predictionId: string;
  block: bigint;
  low: bigint;
  high: bigint;
  score: bigint | null;
}

export interface FeedPoint {
  block: bigint;
  value: bigint;
  confidence: number;
  contributors: bigint;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[indexer] ${url} failed:`, (err as Error).message);
    return null;
  }
}

/// Count this agent's resolved predictions (drives SEED_MODE auto-flip). 0 on indexer outage so a
/// transient failure never falsely flips the agent out of seed mode.
export async function countResolved(indexerUrl: string, agentId: bigint): Promise<number> {
  const json = await getJson<{ predictions: PredictionRow[] }>(
    `${indexerUrl}/agent/${agentId}/predictions?status=Resolved&limit=200`,
  );
  return json?.predictions?.length ?? 0;
}

/// This agent's recent resolved predictions in a category (predicted band + CRPS score) for
/// self-reflection in the prompt context. Chronological ascending.
export async function fetchAgentHistory(
  indexerUrl: string,
  agentId: bigint,
  categoryLabel: string,
  limit = 10,
): Promise<PastPrediction[]> {
  const json = await getJson<{ predictions: PredictionRow[] }>(
    `${indexerUrl}/agent/${agentId}/predictions?status=Resolved&limit=200`,
  );
  if (!json) return [];
  const catId = categoryId(categoryLabel).toLowerCase();
  const out: PastPrediction[] = [];
  for (const r of json.predictions) {
    if (r.categoryId.toLowerCase() !== catId) continue;
    if (!r.value || r.value === "0x") continue;
    try {
      const [low, high] = decodeAbiParameters(RANGE_ABI, r.value) as [bigint, bigint];
      out.push({
        predictionId: r.id,
        block: BigInt(r.commitBlock),
        low,
        high,
        score: r.score != null ? BigInt(r.score) : null,
      });
    } catch {
      /* skip */
    }
  }
  out.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
  return out.slice(-limit);
}

/// Recent composite-feed snapshots for a category (the on-chain ensemble's recorded values over
/// time) — the closest available proxy for "last 7 days of category data". Chronological ascending.
export async function fetchFeedHistory(
  indexerUrl: string,
  categoryLabel: string,
  limit = 20,
): Promise<FeedPoint[]> {
  const json = await getJson<{ history: FeedSnapshotRow[] }>(
    `${indexerUrl}/feed/${categoryLabel}/history?limit=${limit}`,
  );
  if (!json) return [];
  return json.history
    .map((s) => ({
      block: BigInt(s.snapshotBlock),
      value: BigInt(s.value),
      confidence: s.confidence,
      contributors: BigInt(s.contributingAgents),
    }))
    .sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
}
