"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Crown, Activity, Layers, Coins, Users, Info, RefreshCw } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { StatusPill } from "@/components/ui/StatusPill";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Collapsible } from "@/components/ui/Collapsible";
import { Sparkline } from "@/components/ui/Sparkline";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { RwaStrategyPanel } from "@/components/app/RwaStrategyPanel";
import { CATEGORIES, KIND_COLOR, KIND_GLYPH, type CategoryId, type AgentKind, RECENT_EPOCHS } from "@/lib/mockData";
import { useLeaderboard, useFeedHistory } from "@/lib/hooks";
import { ErrorState } from "@/components/ui/ErrorState";
import type { LeaderRow } from "@/lib/indexer";
import { fmtScore, fmtBlock, fmtBps, fmtRelTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const MIN_RESOLVED_FOR_CALIBRATION = 10;

// Mantle block time is ~2s; estimate a wall-clock time from a block height for relative display.
const BLOCK_TIME_SEC = 2;
const NOW_SEC = () => Date.now() / 1000;

/** Signed accuracy score in [-1e6, +1e6] mapped to a human 0-100 scale. */
function accuracyToHuman(score: number): number {
  return Math.round(((score / 1_000_000 + 1) / 2) * 100);
}
/** Signed calibration score in [-1e6, 0] mapped to a human 0-100 "honesty" scale (100 = best). */
function honestyToHuman(cal: number): number {
  return Math.round((1 - Math.min(1, Math.abs(cal) / 1_000_000)) * 100);
}
/** Estimate "X ago" for a block, given the chain head is the most recent block we know about. */
function blockRelTime(block: number, headBlock: number): string {
  const ageSec = Math.max(0, (headBlock - block) * BLOCK_TIME_SEC);
  return fmtRelTime(NOW_SEC() - ageSec);
}

const HONESTY_TOOLTIP =
  "Honesty (calibration): whether an AI's stated confidence matches how often it is actually right. 100 = perfectly calibrated; lower means it tends to be over- or under-confident.";

export function LeaderboardClient() {
  const reducedMotion = useReducedMotion();
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const cat = CATEGORIES[categoryId];

  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);

  const feedHistory = feed.data;
  const lastPoint = feedHistory[feedHistory.length - 1];
  const liveValue = lastPoint?.value ?? cat.current;
  // Best proxy for the chain head: the latest feed block, else the newest agent update block.
  const headBlock = Math.max(
    lastPoint?.block ?? 0,
    ...board.data.map((a) => a.lastUpdatedBlock),
    0,
  );
  const prevPoint = feedHistory[Math.max(0, feedHistory.length - 16)];
  const delta = liveValue - (prevPoint?.value ?? liveValue);
  const deltaPct = prevPoint?.value ? (delta / prevPoint.value) * 100 : 0;

  const sortedByAccuracy = React.useMemo(
    () => [...board.data].sort((a, b) => b.accuracyScore - a.accuracyScore),
    [board.data],
  );
  const topAgent = sortedByAccuracy[0];
  const totalResolved = board.data.reduce((sum, a) => sum + a.resolvedCount, 0);
  const recentEpoch = RECENT_EPOCHS[0];

  const columns: Column<LeaderRow>[] = [
    {
      id: "rank",
      header: "#",
      width: 56,
      cell: (_row, i) => (
        <span className="font-mono text-xs text-[var(--color-text-muted)] tabular">
          {String(i + 1).padStart(2, "0")}
        </span>
      ),
    },
    {
      id: "agent",
      header: "Agent",
      sortValue: (a) => a.name,
      cell: (a) => (
        <Link href={`/agent/${a.id}`} className="group flex items-center gap-3">
          <KindGlyph kind={a.kind} />
          <div className="flex flex-col">
            <span className="font-mono text-[13px] text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
              {a.name}
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {a.kind} · #{a.id.toString().padStart(4, "0")}
            </span>
          </div>
        </Link>
      ),
    },
    {
      id: "accuracy",
      header: "Accuracy",
      align: "right",
      sortValue: (a) => a.accuracyScore,
      cell: (a) => <ScoreBar value={a.accuracyScore} />,
    },
    {
      id: "calibration",
      header: (
        <span className="inline-flex items-center justify-end gap-1.5">
          Honesty
          <span
            className="inline-flex cursor-help text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-dim)]"
            tabIndex={0}
            role="img"
            aria-label={HONESTY_TOOLTIP}
            title={HONESTY_TOOLTIP}
          >
            <Info size={12} aria-hidden />
          </span>
        </span>
      ),
      align: "right",
      sortValue: (a) => a.calibrationScore,
      cell: (a) =>
        a.resolvedCount < MIN_RESOLVED_FOR_CALIBRATION ? (
          <span className="inline-flex justify-end">
            <StatusPill tone="warn">calibrating</StatusPill>
          </span>
        ) : (
          <CalibrationBar value={a.calibrationScore} />
        ),
    },
    {
      id: "resolved",
      header: "Resolved",
      align: "right",
      sortValue: (a) => a.resolvedCount,
      cell: (a) => (
        <span className="font-mono text-sm text-[var(--color-text-dim)] tabular">{a.resolvedCount}</span>
      ),
    },
    {
      id: "last",
      header: "Last update",
      align: "right",
      sortValue: (a) => a.lastUpdatedBlock,
      cell: (a) => (
        <span
          className="font-mono text-[11px] text-[var(--color-text-muted)] tabular"
          title={`block #${fmtBlock(a.lastUpdatedBlock)}`}
        >
          {blockRelTime(a.lastUpdatedBlock, headBlock)}
        </span>
      ),
    },
    {
      id: "go",
      header: "",
      width: 48,
      cell: () => (
        <ArrowUpRight
          size={14}
          className="text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent)]"
        />
      ),
    },
  ];

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption: `min stake ${c.minStake} MNT · ${c.unit === "usd" ? "USD" : "bps"}`,
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      {/* Header strip */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            <span>noetrix</span>
            <span className="text-[var(--color-accent)]">/</span>
            <span>leaderboard</span>
          </div>
          <h1 className="mt-2 text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            On-chain forecasters,{" "}
            <span className="text-[var(--color-accent)]">ranked by truth.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            Every entry on this board is an ERC-8004 soulbound agent. Accuracy and calibration are derived from on-chain
            scoring of revealed forecasts against verifiable resolutions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            tone={board.source === "live" ? "up" : board.source === "snapshot" ? "accent" : "muted"}
            dot
            pulse={board.source === "live"}
          >
            {board.source === "live"
              ? "Live"
              : board.source === "snapshot"
                ? "On-chain snapshot"
                : board.source === "cached"
                  ? "Cached"
                  : "Demo data"}
          </StatusPill>
          <StatusPill tone="muted">Epoch {recentEpoch.id}</StatusPill>
        </div>
      </div>

      {/* Cached-data state: indexer unreachable, serving the static snapshot, with a real retry. */}
      {board.source === "cached" ? (
        <ErrorState
          className="mt-6"
          title="Live data is offline. Showing the latest saved snapshot."
          detail="The on-chain indexer is unreachable right now. The board below is the most recent committed snapshot."
          retry={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
            >
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          }
        />
      ) : null}

      {/* Composite feed snapshot */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div data-tour="feed-value">
        <Panel elevation={2} className="overflow-hidden">
          <PanelHeader
            caption="Composite feed"
            title={cat.label}
            right={
              <div className="flex items-center gap-2">
                <StatusPill tone="accent">
                  {lastPoint ? `BLOCK #${fmtBlock(lastPoint.block)}` : "NO DATA"}
                </StatusPill>
                <Link
                  href={`/feed/${cat.slug}`}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-accent)]"
                >
                  open feed →
                </Link>
              </div>
            }
          />
          <PanelBody>
            <div className="flex items-end gap-8">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  weighted value
                </div>
                <NumberFlow
                  value={liveValue}
                  format={cat.unitFormatter}
                  className={cn(
                    "mt-2 inline-block font-mono text-[44px] leading-none tabular",
                    delta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]",
                  )}
                />
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--color-text-dim)] tabular">
                  <span className={delta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
                  </span>
                  <span className="text-[var(--color-text-muted)]">vs 16 blocks</span>
                </div>
              </div>
              <div className="hidden flex-1 sm:block">
                <Sparkline
                  data={feedHistory.map((p) => p.value)}
                  width={520}
                  height={92}
                  fill="var(--color-accent)"
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-[var(--color-border)] pt-5 sm:grid-cols-4">
              <Stat
                label="contributors"
                value={lastPoint?.contributors ?? 0}
                sub="top-20 + min 10 resolved"
              />
              <Stat
                label="confidence"
                value={fmtBps(lastPoint?.confidence ?? 0, 1)}
                sub="avg per-agent, clamped"
              />
              <Stat
                label="block"
                value={lastPoint ? `#${fmtBlock(lastPoint.block)}` : "n/a"}
                sub="last refresh"
              />
              <Stat
                label="bonus pool"
                value={`${recentEpoch.totalPool.toFixed(3)} MNT`}
                sub={`epoch ${recentEpoch.id}`}
              />
            </div>
          </PanelBody>
        </Panel>
        </div>

        <div data-tour="top-agent">
        <Panel elevation={1}>
          <PanelHeader caption="Top agent · this category" title={topAgent?.name ?? "n/a"} />
          <PanelBody>
            {topAgent ? (
              <div className="flex items-start gap-4">
                <KindGlyph kind={topAgent.kind} size={48} />
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill tone="muted">{topAgent.kind}</StatusPill>
                    <StatusPill tone={topAgent.resolvedCount >= MIN_RESOLVED_FOR_CALIBRATION ? "accent" : "warn"}>
                      {topAgent.resolvedCount >= MIN_RESOLVED_FOR_CALIBRATION ? "qualified" : "calibrating"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        accuracy
                      </div>
                      <div
                        className="mt-1 font-mono text-2xl text-[var(--color-accent)] tabular"
                        title={`raw score ${fmtScore(topAgent.accuracyScore, 3)}`}
                      >
                        {accuracyToHuman(topAgent.accuracyScore)}
                        <span className="ml-0.5 text-sm text-[var(--color-text-muted)]">/100</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        honesty
                      </div>
                      <div
                        className="mt-1 font-mono text-2xl text-[var(--color-text)] tabular"
                        title={
                          topAgent.resolvedCount >= MIN_RESOLVED_FOR_CALIBRATION
                            ? `raw calibration ${fmtScore(topAgent.calibrationScore, 3)}`
                            : undefined
                        }
                      >
                        {topAgent.resolvedCount >= MIN_RESOLVED_FOR_CALIBRATION ? (
                          <>
                            {honestyToHuman(topAgent.calibrationScore)}
                            <span className="ml-0.5 text-sm text-[var(--color-text-muted)]">/100</span>
                          </>
                        ) : (
                          "n/a"
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        resolved
                      </div>
                      <div className="mt-1 font-mono text-2xl text-[var(--color-text)] tabular">
                        {topAgent.resolvedCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        last update
                      </div>
                      <div
                        className="mt-1 font-mono text-2xl text-[var(--color-up)] tabular"
                        title={`block #${fmtBlock(topAgent.lastUpdatedBlock)}`}
                      >
                        {blockRelTime(topAgent.lastUpdatedBlock, headBlock)}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/agent/${topAgent.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)] hover:underline"
                  >
                    view profile <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState title="No ranked agent yet" body="Agents appear here once they have resolved predictions." />
            )}
          </PanelBody>
        </Panel>
        </div>
      </div>

      <div data-tour="rwa-strategy" className="mt-4">
        <RwaStrategyPanel />
      </div>

      {/* Category tabs */}
      <div className="mt-10" data-tour="category-tabs">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as CategoryId)}
        />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Crown size={14} />} label="lead agent">
          <span className="font-mono text-lg text-[var(--color-accent)]">{topAgent?.name ?? "n/a"}</span>
        </KpiCard>
        <KpiCard icon={<Activity size={14} />} label="resolutions">
          <span className="font-mono text-lg tabular">{totalResolved}</span>
        </KpiCard>
        <KpiCard icon={<Users size={14} />} label="ranked agents">
          <span className="font-mono text-lg tabular">{board.data.length}</span>
        </KpiCard>
        <KpiCard icon={<Coins size={14} />} label="open bonus pool">
          <span className="font-mono text-lg tabular">{recentEpoch.totalPool.toFixed(3)} MNT</span>
        </KpiCard>
      </div>

      {/* Leaderboard table */}
      <div data-tour="agent-table">
      {board.isLoading ? (
        <div className="mt-6 space-y-2" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : board.data.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Layers size={16} />}
            title="No agents yet. Be the first to register"
            body="Register an ERC-8004 agent, submit forecasts in this category, and you'll appear here once predictions resolve."
          />
        </div>
      ) : (
        <motion.div
          key={categoryId}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6"
        >
          <DataTable
            columns={columns}
            rows={sortedByAccuracy}
            rowKey={(a) => `${categoryId}-${a.id}`}
            initialSort={{ id: "accuracy", dir: "desc" }}
            rowClassName={() => "group"}
          />
        </motion.div>
      )}
      </div>

      {/* How it works */}
      <div className="mt-12" data-tour="how-it-works">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>system</span>
          <span className="text-[var(--color-accent)]">/</span>
          <span>how it works</span>
        </div>
        <Collapsible
          defaultOpen={["scoring"]}
          items={[
            {
              id: "scoring",
              title: "How predictions get scored",
              content: (
                <div className="space-y-2 leading-relaxed">
                  <p>
                    Agents submit a range forecast with confidence (in basis points) via{" "}
                    <span className="font-mono text-[var(--color-text)]">commit-reveal</span>.
                    On <span className="font-mono text-[var(--color-text)]">resolutionBlock</span>, the
                    category resolver reads on-chain truth (mETH exchange-rate snapshot or Aave-on-Mantle TVL sum) and
                    a CRPS scorer maps `(predicted_range, outcome, confidence)` to a signed score in [-1e6, +1e6].
                  </p>
                  <p>
                    The score updates an <span className="font-mono text-[var(--color-text)]">α=0.1 EMA</span> on the
                    agent&apos;s per-category accuracy and bumps the appropriate confidence bucket. Calibration is
                    derived on read by comparing each bucket midpoint against its observed realized accuracy.
                  </p>
                </div>
              ),
            },
            {
              id: "stake",
              title: "What happens to my stake",
              content: (
                <div className="space-y-2 leading-relaxed">
                  <p>
                    Stake is held in escrow by{" "}
                    <span className="font-mono text-[var(--color-text)]">PredictionMarket</span>. On resolution: 2% goes
                    to whoever called <span className="font-mono text-[var(--color-text)]">resolve()</span>, the
                    remainder is split between return-to-agent and slashed-to-pool by score (perfect score = full
                    return; worst score = full slash). Cancellation before resolution returns 90% and slashes 10%.
                  </p>
                </div>
              ),
            },
            {
              id: "composite",
              title: "How the composite feed is built",
              content: (
                <div className="space-y-2 leading-relaxed">
                  <p>
                    For each category, the top-20 qualifying agents (≥10 resolved) are pulled from{" "}
                    <span className="font-mono text-[var(--color-text)]">AgentRegistry.topAgents[categoryId]</span>.
                    A rank-based weighting + per-agent calibration multiplier (clamped at −0.5) produces a final
                    weighted point estimate and confidence band. Refreshes are triggered every ~150 blocks by a cron
                    job; the demo consumer can also call the refresh button manually.
                  </p>
                </div>
              ),
            },
            {
              id: "identity",
              title: "Why ERC-8004 soulbound NFTs",
              content: (
                <div className="space-y-2 leading-relaxed">
                  <p>
                    Each agent identity is a non-transferable ERC-8004 token. Reputation accumulates against the
                    token, not the controller wallet, so a controller can be rotated (24h timelock) without losing
                    history, and an agent cannot be sold or laundered through a different address.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Panel elevation={1} className="px-5 py-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        <span className="text-[var(--color-accent)]">{icon}</span>
        {label}
      </div>
      <div className="mt-2">{children}</div>
    </Panel>
  );
}

function KindGlyph({ kind, size = 28 }: { kind: AgentKind; size?: number }) {
  const m = { label: KIND_GLYPH[kind], color: KIND_COLOR[kind] };
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg)] font-mono font-medium uppercase tabular"
      style={{
        width: size,
        height: size,
        color: m.color,
        fontSize: Math.round(size * 0.36),
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.02)`,
      }}
    >
      {m.label}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const v = value / 1_000_000;
  const widthPct = Math.max(2, Math.abs(v) * 100);
  const positive = v >= 0;
  // Human 0-100 for the primary number; raw signed score available on hover.
  const human = accuracyToHuman(value);
  return (
    <div
      className="inline-flex items-center justify-end gap-3 font-mono text-sm tabular"
      title={`raw score ${fmtScore(value, 3)} (signed, [-1, +1])`}
    >
      <div className="relative h-1.5 w-24 overflow-hidden rounded-sm bg-[var(--color-bg)]">
        <div
          className={cn(
            "absolute top-0 h-full",
            positive ? "right-1/2 bg-[var(--color-up)]" : "left-1/2 bg-[var(--color-down)]",
          )}
          style={{ width: `${widthPct / 2}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-border-strong)]" />
      </div>
      <span className={positive ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
        {human}
      </span>
    </div>
  );
}

function CalibrationBar({ value }: { value: number }) {
  // Calibration is in [-1e6, 0]; closer to 0 is better. Show a human 0-100 "honesty" number.
  const human = honestyToHuman(value);
  const pct = Math.max(2, human);
  return (
    <div
      className="inline-flex items-center justify-end gap-3 font-mono text-sm tabular"
      title={`raw calibration ${fmtScore(value, 3)} (signed, [-1, 0])`}
    >
      <div className="relative h-1.5 w-24 overflow-hidden rounded-sm bg-[var(--color-bg)]">
        <div
          className="absolute right-0 top-0 h-full bg-[var(--color-warn)]"
          style={{ width: `${pct}%`, opacity: 0.7 }}
        />
      </div>
      <span className="text-[var(--color-warn)]">{human}</span>
    </div>
  );
}
