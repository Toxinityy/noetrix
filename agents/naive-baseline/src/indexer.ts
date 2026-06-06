import { decodeAbiParameters, type Hex } from "viem";
import { categoryId } from "@predictor-index/sdk";

interface PredictionRow {
  id: string;
  categoryId: Hex;
  value: Hex | null;
  status: string;
  commitBlock: string;
  score: string | null;
}

const RANGE_ABI = [{ type: "uint256" }, { type: "uint256" }] as const;

async function fetchResolved(indexerUrl: string, agentId: bigint): Promise<PredictionRow[]> {
  const url = `${indexerUrl}/agent/${agentId}/predictions?status=Resolved&limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`indexer ${res.status} on ${url}`);
  const json = (await res.json()) as { predictions: PredictionRow[] };
  return json.predictions ?? [];
}

/// Count this agent's resolved predictions (drives the SEED_MODE auto-flip on count >= 50).
/// Returns 0 if the indexer is unreachable so a transient outage never falsely flips the agent.
export async function countResolved(indexerUrl: string, agentId: bigint): Promise<number> {
  try {
    return (await fetchResolved(indexerUrl, agentId)).length;
  } catch (err) {
    console.warn(`[indexer] countResolved failed (treating as 0):`, (err as Error).message);
    return 0;
  }
}

/// Pull this agent's resolved-prediction history for a category as a chronological level series
/// (range midpoints in domain units). Empty array if none / unreachable; caller seeds synthetically.
export async function fetchHistory(
  indexerUrl: string,
  agentId: bigint,
  categoryLabel: string,
): Promise<number[]> {
  let rows: PredictionRow[];
  try {
    rows = await fetchResolved(indexerUrl, agentId);
  } catch (err) {
    console.warn(`[indexer] fetchHistory failed (empty series):`, (err as Error).message);
    return [];
  }

  const catId = categoryId(categoryLabel);
  const series: { block: bigint; value: number }[] = [];
  for (const r of rows) {
    if (r.categoryId.toLowerCase() !== catId.toLowerCase()) continue;
    if (!r.value || r.value === "0x") continue;
    try {
      const [low, high] = decodeAbiParameters(RANGE_ABI, r.value) as [bigint, bigint];
      const mid = Number((low + high) / 2n);
      series.push({ block: BigInt(r.commitBlock), value: mid });
    } catch {
      /* skip undecodable */
    }
  }
  series.sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0));
  return series.map((s) => s.value);
}
