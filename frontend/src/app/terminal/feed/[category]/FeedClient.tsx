"use client";

import * as React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { motion, useReducedMotion } from "motion/react";
import { useBlockNumber } from "wagmi";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { fmtBlock, fmtBps, fmtScore, fmtUSDCompact } from "@/lib/format";
import { friendlyValue } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useFeedHistory, useLeaderboard, useOnChainFeedSnapshot } from "@/lib/hooks";
import type { LeaderRow } from "@/lib/indexer";
import { DAY_BLOCKS, WEEK_BLOCKS, feedSourceLabel, findLookbackPoint, forecastMoves, windowFeedHistory } from "@/lib/feedView";
import { EmptyState } from "@/components/ui/EmptyState";

type Contributor = {
  agent: LeaderRow;
  weight: number; // 0..1
  contribution: number; // category-unit weighted
  rank: number;
};

export function FeedClient({ categoryId }: { categoryId: CategoryId }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const cat = CATEGORIES[categoryId];
  const feed = useFeedHistory(categoryId);
  const board = useLeaderboard(categoryId);
  // Never draw the curated wave on a page presented as a real feed.
  const history = feed.source === "mock" ? [] : feed.data;

  // User-selectable chart window: 24h or 7d.
  const [span, setSpan] = React.useState<"24h" | "7d">("24h");
  const spanBlocks = span === "7d" ? WEEK_BLOCKS : DAY_BLOCKS;

  // Window to the recent contiguous run, capped to the selected span (drops stopped-bot dead zones).
  const chartHistory = React.useMemo(() => windowFeedHistory(history, spanBlocks), [history, spanBlocks]);
  const trimmed = chartHistory.length < history.length;

  // Collapse held-flat repeats to the real forecast-move points (dots); smooth line spans the gaps.
  const predictionPoints = React.useMemo(() => forecastMoves(chartHistory), [chartHistory]);

  // Plain-English value: % for yields, compact $ for big USD totals (scannable headlines/axes).
  const scanValue = (v: number) => (cat.unit === "usd" ? fmtUSDCompact(v) : friendlyValue(categoryId, v));

  // Headline delta is always 24h (independent of the chart window toggle).
  const latest = history[history.length - 1];
  const dayAgo = findLookbackPoint(history, DAY_BLOCKS);
  const delta = latest && dayAgo ? latest.value - dayAgo.value : null;
  const deltaPct = delta !== null && dayAgo?.value ? (delta / dayAgo.value) * 100 : null;

  // When the indexer (history) is offline we still read the live composite value straight
  // from the chain, so the headline KPIs show real data instead of going blank. The chart,
  // 24h change, and contributor table stay indexer-only (no made-up series).
  const onChain = useOnChainFeedSnapshot(categoryId);
  const headline = latest ?? onChain;
  const usingOnChainFallback = !latest && !!onChain;

  // Freshness: how old is the newest feed point vs the chain head? "Live" only earns its pulse
  // when the feed is within ~2× the hourly refresh cadence; older than that renders as stale.
  const { data: headBlock } = useBlockNumber({ watch: true });
  const ageBlocks = headline && headBlock ? Number(headBlock) - headline.block : null;
  const STALE_AFTER_BLOCKS = 2 * 1800; // 2× the hourly refresh cadence on 2s blocks
  const feedStale = ageBlocks !== null && ageBlocks > STALE_AFTER_BLOCKS;
  const ageLabel =
    ageBlocks === null || ageBlocks < 0
      ? null
      : ageBlocks < 1800
        ? `updated ${Math.max(1, Math.round((ageBlocks * 2) / 60))}m ago`
        : `updated ${((ageBlocks * 2) / 3600).toFixed(1)}h ago`;

  const contributors: Contributor[] = React.useMemo(() => {
    if (!latest) return [];
    const sorted = [...board.data]
      .map((a) => ({
        a,
        s: a.accuracyScore + a.calibrationScore / 4,
        resolved: a.resolvedCount,
      }))
      .filter((x) => x.resolved >= 10)
      .sort((a, b) => b.s - a.s);
    // Reconcile with the on-chain composite: it aggregated `latest.contributors` agents this refresh,
    // so weight over exactly that many. Otherwise the table row-count contradicts the "contributors N"
    // KPI (e.g. KPI says 7, table lists all qualifiers). Fall back to all qualifiers if the count is 0.
    const n =
      latest.contributors > 0 ? Math.min(latest.contributors, sorted.length) : sorted.length;
    const top = sorted.slice(0, n);
    const totalRank = top.reduce((s, _, i) => s + 1 / (i + 1), 0) || 1;
    return top.map((row, i) => {
      const w = 1 / (i + 1) / totalRank;
      return {
        agent: row.a,
        weight: w,
        rank: i + 1,
        contribution: latest.value * w * (1 + (row.s / 1_000_000) * 0.05),
      };
    });
  }, [board.data, latest]);

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption:
      c.unit === "bps" ? "annual yield %" : c.id === "MNT_USD_SPOT" ? "spot price, US$" : "total deposits, US$",
  }));

  const columns: Column<Contributor>[] = [
    {
      id: "rank",
      header: "#",
      width: 56,
      cell: (c) => (
        <span className="font-mono text-xs text-[var(--color-text-muted)] tabular">
          {String(c.rank).padStart(2, "0")}
        </span>
      ),
    },
    {
      id: "agent",
      header: "Agent",
      sortValue: (c) => c.agent.name,
      cell: (c) => (
        <Link
          href={`/terminal/agent/${c.agent.id}`}
          className="font-mono text-[13px] text-[var(--color-text)] hover:text-[var(--color-accent)]"
        >
          {c.agent.name}
        </Link>
      ),
    },
    {
      id: "weight",
      header: "Weight",
      align: "right",
      sortValue: (c) => c.weight,
      cell: (c) => (
        <span className="inline-flex items-center justify-end gap-3 font-mono text-sm tabular">
          <div className="relative h-1.5 w-20 overflow-hidden rounded-sm bg-[var(--color-bg)]">
            <div
              className="absolute left-0 top-0 h-full bg-[var(--color-accent)]"
              style={{ width: `${Math.min(100, c.weight * 100 * 5)}%` }}
            />
          </div>
          <span>{(c.weight * 100).toFixed(2)}%</span>
        </span>
      ),
    },
    {
      id: "accuracy",
      header: "Accuracy",
      align: "right",
      sortValue: (c) => c.agent.accuracyScore,
      cell: (c) => (
        <span
          className={cn(
            "font-mono text-sm tabular",
            c.agent.accuracyScore >= 0
              ? "text-[var(--color-up)]"
              : "text-[var(--color-down)]",
          )}
        >
          {fmtScore(c.agent.accuracyScore, 3)}
        </span>
      ),
    },
    {
      id: "calibration",
      header: "Calibration",
      align: "right",
      sortValue: (c) => c.agent.calibrationScore,
      cell: (c) => (
        <span className="font-mono text-sm text-[var(--color-warn)] tabular">
          {fmtScore(c.agent.calibrationScore, 3)}
        </span>
      ),
    },
    {
      id: "contribution",
      header: "Weighted contribution",
      align: "right",
      sortValue: (c) => c.contribution,
      cell: (c) => (
        <span className="font-mono text-sm text-[var(--color-text)] tabular">
          {scanValue(c.contribution)}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <Link href="/terminal/leaderboard" className="hover:text-[var(--color-text)]">
          leaderboard
        </Link>
        <span className="text-[var(--color-accent)]">/</span>
        <span>feed</span>
        <span className="text-[var(--color-accent)]">/</span>
        <span>{cat.slug}</span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            {cat.label}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            {cat.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            tone={feedStale ? "warn" : feed.source === "live" || usingOnChainFallback ? "up" : "muted"}
            dot={feed.source === "live" || usingOnChainFallback}
            pulse={feed.source === "live" && !feedStale}
          >
            {usingOnChainFallback
              ? "On-chain (live read)"
              : feedStale && feed.source === "live"
                ? "Live · stale feed"
                : feedSourceLabel(feed.source)}
          </StatusPill>
          {ageLabel ? (
            <StatusPill tone={feedStale ? "warn" : "muted"}>{ageLabel}</StatusPill>
          ) : (
            <StatusPill tone="muted">This round</StatusPill>
          )}
        </div>
      </div>

      <div className="mt-8">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) =>
            router.push(`/terminal/feed/${CATEGORIES[v as CategoryId].slug}`)
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Panel className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            current value
          </div>
          {headline ? (
            <NumberFlow
              value={headline.value}
              format={scanValue}
              className="mt-2 inline-block font-mono text-3xl text-[var(--color-accent)] tabular"
            />
          ) : (
            <div className="mt-2 font-mono text-3xl text-[var(--color-text-muted)]">—</div>
          )}
        </Panel>
        <Panel className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            24h change
          </div>
          <div
            className={cn(
              "mt-2 font-mono text-3xl tabular",
              (delta ?? 0) >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]",
            )}
          >
            {deltaPct === null || delta === null
              ? "—"
              : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(2)}%`}
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            confidence
          </div>
          <div className="mt-2 font-mono text-3xl tabular text-[var(--color-text-dim)]">
            {headline ? fmtBps(headline.confidence, 1) : "—"}
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            contributors
          </div>
          <div className="mt-2 font-mono text-3xl tabular">{headline?.contributors ?? "—"}</div>
        </Panel>
      </div>

      <Panel elevation={1} className="mt-4 overflow-hidden">
        <PanelHeader
          caption="composite feed"
          title="Weighted value history"
          right={
            <div className="flex items-center gap-3">
              <div
                className="flex overflow-hidden rounded border border-[var(--color-border)] font-mono text-[10px] uppercase tracking-[0.14em]"
                role="group"
                aria-label="Chart timeframe"
              >
                {(["24h", "7d"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpan(s)}
                    aria-pressed={span === s}
                    className={cn(
                      "px-2 py-1 transition-colors focus-visible:outline-none",
                      span === s
                        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                {history.length > 0
                  ? trimmed
                    ? `${predictionPoints.length} forecast moves · since feed resumed`
                    : `${predictionPoints.length} forecast moves`
                  : "history unavailable"}
              </span>
            </div>
          }
        />
        <PanelBody className="pb-3 pt-2">
          {history.length > 0 ? <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={predictionPoints}
                margin={{ top: 10, right: 8, left: 4, bottom: 8 }}
              >
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="2 2"
                  vertical={false}
                />
                <XAxis
                  dataKey="block"
                  // Numeric (not category) axis: points are spaced by real block height, so a gap
                  // in the on-chain history renders as an actual gap instead of collapsing into a
                  // vertical cliff. Honest until the dense short-horizon feed backfills it.
                  type="number"
                  scale="linear"
                  domain={["dataMin", "dataMax"]}
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                  tickFormatter={(v) => `#${(v / 1_000_000).toFixed(2)}m`}
                  stroke="var(--color-border-strong)"
                />
                <YAxis
                  tick={{
                    fill: "var(--color-text-muted)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                  tickFormatter={(v) => scanValue(Number(v))}
                  stroke="var(--color-border-strong)"
                  width={64}
                  domain={["dataMin - 20", "dataMax + 20"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border-strong)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                  }}
                  labelFormatter={(v) => `block #${fmtBlock(Number(v))}`}
                  formatter={(v) => [scanValue(Number(v)), "feed"]}
                />
                {dayAgo && (
                  <ReferenceLine
                    y={dayAgo.value}
                    stroke="var(--color-border-strong)"
                    strokeDasharray="3 3"
                    label={{
                      value: "24h ago",
                      fill: "var(--color-text-muted)",
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      position: "insideTopRight",
                    }}
                  />
                )}
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
          </div> : (
            <EmptyState
              title="Live feed history unavailable"
              body={
                usingOnChainFallback
                  ? "Showing the latest value read straight from the on-chain feed above. The history chart needs the indexer, which is currently offline."
                  : "The indexer is not connected, so Noetrix will not draw a made-up chart. The on-chain feed can still be read from Try."
              }
            />
          )}
        </PanelBody>
      </Panel>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mt-8"
      >
        <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>feed weighting</span>
          <span className="text-[var(--color-accent)]">/</span>
          <span>qualifying agents</span>
        </div>
        <p className="mb-3 max-w-2xl text-xs text-[var(--color-text-dim)]">
          The rank-weights the composite feed used to blend forecasts this round, over the top
          qualifying agents (resolved ≥ 10)
          {contributors.length > 0
            ? ` — ${contributors.length} shown${
                contributors.length === headline?.contributors
                  ? ", matching the Contributors count above"
                  : ""
              }.`
            : "."}
        </p>
        <DataTable
          columns={columns}
          rows={contributors}
          rowKey={(c) => `${categoryId}-${c.agent.id}`}
          initialSort={{ id: "weight", dir: "desc" }}
        />
      </motion.div>
    </div>
  );
}
