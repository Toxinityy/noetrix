import type { DataSource } from "@/lib/hooks";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";
import { fmtBlock } from "@/lib/format";

export const DAY_BLOCKS = 43_200;

export function findLookbackPoint(
  history: LiveFeedPoint[],
  lookbackBlocks: number,
  // The nearest real point must be within this much of the target block to count as "≈24h ago".
  // Without it, a sparse/bursty series returns a point from an old cluster days away and mislabels
  // it as a 24h change (the feed-chart honesty bug). Default: half the lookback (≈12h..36h window).
  toleranceBlocks: number = Math.floor(lookbackBlocks / 2),
): LiveFeedPoint | null {
  const latest = history[history.length - 1];
  const earliest = history[0];
  if (!latest || !earliest) return null;

  const target = latest.block - lookbackBlocks;
  if (earliest.block > target) return null;

  const closest = history.reduce((best, point) =>
    Math.abs(point.block - target) < Math.abs(best.block - target) ? point : best,
  );
  // No genuine ~24h-ago point (nearest sits across a data gap) → caller shows "—", not a fake delta.
  if (Math.abs(closest.block - target) > toleranceBlocks) return null;
  return closest;
}

export function feedSourceLabel(source: DataSource): string {
  if (source === "live") return "Live indexer";
  if (source === "snapshot") return "On-chain snapshot";
  if (source === "cached") return "Cached snapshot";
  return "Demo data";
}

/** Shape returned by `GET /api/feed` — a live on-chain `CompositeFeed.read`. */
export interface OnChainFeedResponse {
  source?: string;
  value?: string;
  confidenceBps?: number;
  contributingAgents?: number;
  lastUpdatedBlock?: number;
}

/**
 * Map the on-chain `/api/feed` read into a single feed point usable as a headline
 * fallback when the indexer (history) is offline. Returns null unless it's a real
 * on-chain value with at least one contributor — so a zeroed/empty/errored feed
 * never masquerades as live data.
 */
export function onChainFeedSnapshot(
  json: OnChainFeedResponse | null | undefined,
): LiveFeedPoint | null {
  if (!json || json.source !== "chain") return null;
  const value = Number(json.value);
  const contributors = Number(json.contributingAgents ?? 0);
  if (!Number.isFinite(value) || contributors <= 0) return null;
  return {
    block: Number(json.lastUpdatedBlock ?? 0),
    value,
    confidence: Number(json.confidenceBps ?? 0),
    contributors,
  };
}

export function formatRawFeedFields(
  category: CategoryId,
  value: bigint,
  confidence: number,
  contributors: number,
  lastUpdatedBlock: number,
) {
  const valueText =
    category === "AAVE_MANTLE_TVL_24H"
      ? `${value.toLocaleString("en-US")} raw units`
      : `${value.toLocaleString("en-US")} bps = ${(Number(value) / 100).toFixed(2)}%`;

  return {
    value: valueText,
    confidence: `${confidence.toLocaleString("en-US")} bps = ${(confidence / 100).toFixed(2)}%`,
    contributors: `${contributors} ${contributors === 1 ? "agent" : "agents"}`,
    lastUpdatedBlock: `#${fmtBlock(lastUpdatedBlock)}`,
  };
}
