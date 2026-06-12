import type { DataSource } from "@/lib/hooks";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";
import { fmtBlock } from "@/lib/format";

export const DAY_BLOCKS = 43_200;

export function findLookbackPoint(
  history: LiveFeedPoint[],
  lookbackBlocks: number,
): LiveFeedPoint | null {
  const latest = history[history.length - 1];
  const earliest = history[0];
  if (!latest || !earliest) return null;

  const target = latest.block - lookbackBlocks;
  if (earliest.block > target) return null;

  return history.reduce((closest, point) =>
    Math.abs(point.block - target) < Math.abs(closest.block - target) ? point : closest,
  );
}

export function feedSourceLabel(source: DataSource): string {
  if (source === "live") return "Live indexer";
  if (source === "snapshot") return "On-chain snapshot";
  if (source === "cached") return "Cached snapshot";
  return "Demo data";
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
