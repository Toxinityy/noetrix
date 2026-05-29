"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Crown, Activity, Layers, Coins, Users } from "lucide-react";
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
import { CATEGORIES, type CategoryId, type AgentKind, RECENT_EPOCHS } from "@/lib/mockData";
import { useLeaderboard, useFeedHistory } from "@/lib/hooks";
import type { LeaderRow } from "@/lib/indexer";
import { fmtScore, fmtBlock, fmtBps } from "@/lib/format";
import { cn } from "@/lib/cn";

const MIN_RESOLVED_FOR_CALIBRATION = 10;

export function LeaderboardClient() {
  const reducedMotion = useReducedMotion();
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const cat = CATEGORIES[categoryId];

  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);

  const feedHistory = feed.data;
  const lastPoint = feedHistory[feedHistory.length - 1];
  const liveValue = lastPoint?.value ?? cat.current;
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
      header: "Calibration",
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
      header: "Last Update",
      align: "right",
      sortValue: (a) => a.lastUpdatedBlock,
      cell: (a) => (
        <span className="font-mono text-[11px] text-[var(--color-text-muted)] tabular">
          #{fmtBlock(a.lastUpdatedBlock)}
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
    caption: `min stake ${c.minStake} MNT · ${c.id === "METH_APR_24H" ? "bps" : "USD"}`,
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
          <StatusPill tone={board.source === "live" ? "up" : "muted"} dot pulse={board.source === "live"}>
            {board.source === "live" ? "Live" : "Demo data"}
          </StatusPill>
          <StatusPill tone="muted">Epoch {recentEpoch.id}</StatusPill>
        </div>
      </div>

      {/* Cached-data banner — indexer unreachable, serving the static snapshot */}
      {board.source === "cached" ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2.5 rounded-md border border-[var(--color-warn)]/40 bg-[color:color-mix(in_srgb,var(--color-warn)_8%,var(--color-bg-elev-1))] px-4 py-2.5"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[var(--color-warn)] shadow-[0_0_8px_var(--color-warn)]"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-warn)]">
            Showing cached data
          </span>
          <span className="text-xs text-[var(--color-text-dim)]">
            Live indexer unreachable — retrying automatically.
          </span>
        </div>
      ) : null}

      {/* Composite feed snapshot */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
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
                tone="accent"
              />
              <Stat
                label="block"
                value={lastPoint ? `#${fmtBlock(lastPoint.block)}` : "—"}
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

        <Panel elevation={1}>
          <PanelHeader caption="Top agent — this category" title={topAgent?.name ?? "—"} />
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
                      <div className="mt-1 font-mono text-2xl text-[var(--color-accent)] tabular">
                        {fmtScore(topAgent.accuracyScore, 3)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        calibration
                      </div>
                      <div className="mt-1 font-mono text-2xl text-[var(--color-text)] tabular">
                        {topAgent.resolvedCount >= MIN_RESOLVED_FOR_CALIBRATION
                          ? fmtScore(topAgent.calibrationScore, 3)
                          : "—"}
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
                      <div className="mt-1 font-mono text-2xl text-[var(--color-up)] tabular">
                        #{fmtBlock(topAgent.lastUpdatedBlock)}
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

      {/* Category tabs */}
      <div className="mt-10">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as CategoryId)}
        />
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Crown size={14} />} label="lead agent">
          <span className="font-mono text-lg text-[var(--color-accent)]">{topAgent?.name ?? "—"}</span>
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
            title="No agents yet — be the first to register"
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

      {/* How it works */}
      <div className="mt-12">
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
                    token, not the controller wallet — so a controller can be rotated (24h timelock) without losing
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
  const map: Record<AgentKind, { label: string; color: string }> = {
    CLAUDE: { label: "CL", color: "var(--color-accent)" },
    ARIMA: { label: "AR", color: "#9DC8FF" },
    QUANT: { label: "QU", color: "#F8D97A" },
    ENSEMBLE: { label: "EN", color: "#C7B6FF" },
  };
  const m = map[kind];
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
  return (
    <div className="inline-flex items-center justify-end gap-3 font-mono text-sm tabular">
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
        {fmtScore(value, 3)}
      </span>
    </div>
  );
}

function CalibrationBar({ value }: { value: number }) {
  // Calibration is in [-1e6, 0]; closer to 0 is better
  const pct = Math.min(100, (Math.abs(value) / 500_000) * 100);
  return (
    <div className="inline-flex items-center justify-end gap-3 font-mono text-sm tabular">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-sm bg-[var(--color-bg)]">
        <div
          className="absolute right-0 top-0 h-full bg-[var(--color-warn)]"
          style={{ width: `${pct}%`, opacity: 0.7 }}
        />
      </div>
      <span className="text-[var(--color-warn)]">{fmtScore(value, 3)}</span>
    </div>
  );
}
