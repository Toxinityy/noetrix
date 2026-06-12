"use client";

import * as React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { motion, useReducedMotion } from "motion/react";
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
import { useFeedHistory, useLeaderboard } from "@/lib/hooks";
import type { LeaderRow } from "@/lib/indexer";
import { DAY_BLOCKS, feedSourceLabel, findLookbackPoint } from "@/lib/feedView";
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

  // Plain-English value: % for yields, compact $ for big USD totals (scannable headlines/axes).
  const scanValue = (v: number) => (cat.unit === "usd" ? fmtUSDCompact(v) : friendlyValue(categoryId, v));

  const latest = history[history.length - 1];
  const yesterday = findLookbackPoint(history, DAY_BLOCKS);
  const delta = latest && yesterday ? latest.value - yesterday.value : null;
  const deltaPct = delta !== null && yesterday?.value ? (delta / yesterday.value) * 100 : null;

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
    const totalRank = sorted.reduce((s, _, i) => s + 1 / (i + 1), 0) || 1;
    return sorted.map((row, i) => {
      const w = 1 / (i + 1) / totalRank;
      return {
        agent: row.a,
        weight: w,
        rank: i + 1,
        contribution: latest.value * w * (1 + ((row.s / 1_000_000) * 0.05)),
      };
    });
  }, [board.data, latest]);

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption: c.unit === "bps" ? "annual yield %" : "total deposits, US$",
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
          <StatusPill tone={feed.source === "live" ? "up" : "muted"} dot={feed.source === "live"} pulse={feed.source === "live"}>
            {feedSourceLabel(feed.source)}
          </StatusPill>
          <StatusPill tone="muted">This round</StatusPill>
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
          {latest ? (
            <NumberFlow
              value={latest.value}
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
            {latest ? fmtBps(latest.confidence, 1) : "—"}
          </div>
        </Panel>
        <Panel className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            contributors
          </div>
          <div className="mt-2 font-mono text-3xl tabular">{latest?.contributors ?? "—"}</div>
        </Panel>
      </div>

      <Panel elevation={1} className="mt-4 overflow-hidden">
        <PanelHeader
          caption="composite feed"
          title="Weighted value history"
          right={
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {history.length > 0 ? `${history.length} on-chain updates` : "history unavailable"}
            </span>
          }
        />
        <PanelBody className="pb-3 pt-2">
          {history.length > 0 ? <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={history}
                margin={{ top: 10, right: 8, left: 4, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border)"
                  strokeDasharray="2 2"
                  vertical={false}
                />
                <XAxis
                  dataKey="block"
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
                {yesterday && (
                  <ReferenceLine
                    y={yesterday.value}
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
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-accent)"
                  strokeWidth={1.6}
                  fill="url(#feedGrad)"
                  isAnimationActive={!reducedMotion}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div> : (
            <EmptyState
              title="Live feed history unavailable"
              body="The indexer is not connected, so Noetrix will not draw a made-up chart. The on-chain feed can still be read from Try."
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
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>contributors</span>
          <span className="text-[var(--color-accent)]">/</span>
          <span>top-20 qualifying</span>
        </div>
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
