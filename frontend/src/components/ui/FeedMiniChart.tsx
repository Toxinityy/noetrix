"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { LiveFeedPoint } from "@/lib/indexer";
import { DAY_BLOCKS, forecastMoves, windowFeedHistory } from "@/lib/feedView";
import { fmtBlock } from "@/lib/format";

/**
 * Compact composite-feed chart shared by the leaderboard + demo-consumer hero strips. Same line
 * treatment as the feed detail page (monotone line, dots on the real forecast-move points, smoothed
 * over held gaps), windowed to the recent 24 hours. Axes hidden — it's a decorative strip, not a detail view.
 */
export function FeedMiniChart({
  data,
  unitFormatter,
  reducedMotion,
  height = 92,
  spanBlocks = DAY_BLOCKS,
}: {
  data: LiveFeedPoint[];
  unitFormatter: (v: number) => string;
  reducedMotion?: boolean;
  height?: number;
  spanBlocks?: number;
}) {
  const points = React.useMemo(() => forecastMoves(windowFeedHistory(data, spanBlocks)), [data, spanBlocks]);
  if (points.length < 2) return null;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis dataKey="block" type="number" scale="linear" domain={["dataMin", "dataMax"]} hide />
          <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border-strong)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            labelFormatter={(v) => `block #${fmtBlock(Number(v))}`}
            formatter={(v) => [unitFormatter(Number(v)), "feed"]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={1.6}
            dot={{ r: 2.5, fill: "var(--color-accent)", stroke: "var(--color-bg)", strokeWidth: 1 }}
            activeDot={{ r: 4 }}
            isAnimationActive={!reducedMotion}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
