"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Database, Layers, Radio, ShieldCheck, Users } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { CATEGORIES, KIND_GLYPH, agentDisplayName, type CategoryId } from "@/lib/mockData";
import { env, hasIndexer, hasSubscriptionGate } from "@/lib/env";
import { fmtBlock, fmtBps, fmtScore, fmtUSDCompact } from "@/lib/format";
import { useInsightsData, useLeaderboard, type DataSource, type InsightsData } from "@/lib/hooks";
import { FRIENDLY_CATEGORY, friendlyValue } from "@/lib/labels";
import type { LeaderRow } from "@/lib/indexer";
import type { SnapPrediction } from "@/lib/snapshot";

// The dashboard only fetches insights for the three categories with a resolved on-chain track record.
// MNT_USD_SPOT is deployed but has no scored data yet, so it's excluded here — otherwise the
// meth/usdy/aave ternary below falls through and renders Aave's TVL as the "MNT/USD spot" value.
const ACTIVE_CATEGORY_IDS = (Object.keys(CATEGORIES) as CategoryId[]).filter((id) => id !== "MNT_USD_SPOT");
const QUALIFIED_RESOLVED = 10;

export interface DashboardFeedStatus {
  categoryId: CategoryId;
  label: string;
  value: number | null;
  confidence: number | null;
  contributors: number;
  block: number | null;
  source: DataSource;
  isSnapshotAvailable: boolean;
}

export interface DashboardProtocolMetrics {
  resolvedForecasts: number;
  listedAgents: number;
  qualifiedAgents: number;
  activeCategories: number;
  block: number | null;
  source: DataSource;
}

export interface DashboardSystemStatus {
  network: "Mantle Sepolia";
  indexer: "indexer configured" | "no live indexer configured";
  snapshot: string;
  subscriptionGate: "subscription gate configured" | "subscription gate not configured";
}

export function dashboardCategoryFeedStatus(categoryId: CategoryId, data: InsightsData): DashboardFeedStatus {
  const point = data.feed[data.feed.length - 1];
  return {
    categoryId,
    label: FRIENDLY_CATEGORY[categoryId] ?? CATEGORIES[categoryId].label,
    value: point?.value ?? data.crowdValue ?? null,
    confidence: point?.confidence ?? null,
    contributors: point?.contributors ?? 0,
    block: point?.block ?? data.block,
    source: data.source,
    isSnapshotAvailable: data.category !== null,
  };
}

export function dashboardProtocolMetrics(allData: InsightsData[]): DashboardProtocolMetrics {
  const agentIds = new Set<number>();
  const qualified = new Set<number>();
  let resolvedForecasts = 0;
  let block: number | null = null;
  let source: DataSource = "mock";

  for (const data of allData) {
    if (data.source === "live") source = "live";
    else if (source !== "live" && data.source === "snapshot") source = "snapshot";
    else if (source !== "live" && source !== "snapshot" && data.source === "cached") source = "cached";
    if (data.block != null) block = Math.max(block ?? 0, data.block);
    resolvedForecasts += data.category?.predictions.filter((p) => p.status === "Resolved").length ?? 0;
    for (const row of data.board) {
      agentIds.add(row.id);
      if (row.resolvedCount >= QUALIFIED_RESOLVED) qualified.add(row.id);
    }
  }

  return {
    resolvedForecasts,
    listedAgents: agentIds.size,
    qualifiedAgents: qualified.size,
    activeCategories: allData.length,
    block,
    source,
  };
}

export function dashboardSystemStatus(
  data: InsightsData,
  indexerConfigured: boolean,
  subscriptionGateConfigured: boolean,
): DashboardSystemStatus {
  return {
    network: "Mantle Sepolia",
    indexer: indexerConfigured ? "indexer configured" : "no live indexer configured",
    snapshot:
      data.generatedAt && data.block != null
        ? `snapshot ${data.generatedAt} @ block ${data.block}`
        : "snapshot unavailable",
    subscriptionGate: subscriptionGateConfigured
      ? "subscription gate configured"
      : "subscription gate not configured",
  };
}

function formatCategoryValue(categoryId: CategoryId, value: number | null): string {
  if (value == null) return "no value";
  // Compact USD ($140.0M) — full precision is unscannable at dashboard glance distance.
  return CATEGORIES[categoryId].unit === "usd" ? fmtUSDCompact(value) : fmtBps(value);
}

function sourceLabel(source: DataSource): string {
  if (source === "live") return "live data";
  if (source === "snapshot") return "on-chain snapshot";
  if (source === "cached") return "cached";
  return "mock fallback";
}

function topAgents(rows: LeaderRow[]): LeaderRow[] {
  return [...rows].sort((a, b) => b.accuracyScore - a.accuracyScore).slice(0, 5);
}

function latestResolved(predictions: SnapPrediction[] | undefined): SnapPrediction[] {
  return [...(predictions ?? [])]
    .filter((p) => p.status === "Resolved")
    .sort((a, b) => b.resolutionBlock - a.resolutionBlock)
    .slice(0, 6);
}

export function DashboardClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const meth = useInsightsData("METH_APR_24H");
  const usdy = useInsightsData("USDY_APY_24H");
  const aave = useInsightsData("AAVE_MANTLE_TVL_24H");
  const selectedInsights = categoryId === "METH_APR_24H" ? meth : categoryId === "USDY_APY_24H" ? usdy : aave;
  const selectedBoard = useLeaderboard(categoryId);

  const allData = [meth, usdy, aave];
  const statuses = ACTIVE_CATEGORY_IDS.map((id) =>
    dashboardCategoryFeedStatus(id, id === "METH_APR_24H" ? meth : id === "USDY_APY_24H" ? usdy : aave),
  );
  const metrics = dashboardProtocolMetrics(allData);
  const system = dashboardSystemStatus(selectedInsights, hasIndexer, hasSubscriptionGate);
  const resolved = latestResolved(selectedInsights.category?.predictions);
  const agents = topAgents(selectedBoard.data.length > 0 ? selectedBoard.data : selectedInsights.board);

  const tabs = ACTIVE_CATEGORY_IDS.map((id) => ({
    id,
    label: FRIENDLY_CATEGORY[id],
    caption: CATEGORIES[id].unit === "usd" ? "in US$" : "annual yield %",
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            <span>terminal</span>
            <span className="text-[var(--color-accent)]">/</span>
            <span>dashboard</span>
          </div>
          <h1 className="mt-2 text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            Protocol dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            Factual status from the configured indexer, committed chain snapshots, and public runtime configuration.
          </p>
        </div>
        {/* Lead with what the data IS, not which internal service is down — ops detail lives in
            the Runtime status panel below. */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={metrics.source === "live" ? "up" : "accent"} dot pulse={metrics.source === "live"}>
            {sourceLabel(metrics.source)}
          </StatusPill>
          <StatusPill tone="muted">Mantle Sepolia</StatusPill>
        </div>
      </div>

      {/* Hero metrics double as navigation — each card opens the surface that explains it. The 4th
          card shows the flagship consensus value (the product), not a raw block height. */}
      <div data-tour="dash-overview" className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard href="/terminal/leaderboard" icon={<Activity size={16} />} label="Resolved forecasts" value={metrics.resolvedForecasts.toString()} detail="graded on-chain · view leaderboard" />
        <MetricCard href="/terminal/leaderboard" icon={<Users size={16} />} label="Qualified / listed agents" value={`${metrics.qualifiedAgents} / ${metrics.listedAgents}`} detail={`qualified at ${QUALIFIED_RESOLVED}+ resolved`} />
        <MetricCard href="/terminal/insights" icon={<Layers size={16} />} label="Active categories" value={metrics.activeCategories.toString()} detail="mETH · USDY · Aave TVL" />
        <MetricCard href="/terminal/feed/meth-apr-24h" icon={<Radio size={16} />} label="mETH consensus" value={formatCategoryValue("METH_APR_24H", statuses[0].value)} detail="composite feed · seeded testnet oracle" />
      </div>

      {/* The interactive proof — judges/users can write to the live feed themselves. Promoted
          here because it's the strongest "this is real" moment and was buried in the nav. */}
      <Link
        href="/terminal/try"
        className="group mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--color-accent-soft)] bg-[color:color-mix(in_srgb,var(--color-accent)_6%,var(--color-bg-elev-1))] px-5 py-3.5 transition-colors hover:border-[var(--color-accent)]"
      >
        <div className="flex items-center gap-3">
          <Radio size={16} className="text-[var(--color-accent)]" aria-hidden />
          <span className="text-sm text-[var(--color-text)]">
            Don&apos;t trust the numbers? Write to the live feed yourself — one transaction, fully permissionless.
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent)] transition-transform group-hover:translate-x-0.5">
          try it live →
        </span>
      </Link>

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel elevation={2}>
          <PanelHeader
            caption="Category feed status"
            title="Active categories"
            right={<StatusPill tone="accent">{sourceLabel(metrics.source)}</StatusPill>}
          />
          <PanelBody className="grid gap-3 lg:grid-cols-3">
            {statuses.map((status) => (
              <div key={status.categoryId} className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                      {status.categoryId}
                    </div>
                    <div className="mt-1 text-sm font-medium text-[var(--color-text)]">{status.label}</div>
                  </div>
                  {/* Per-card pill only when this category deviates (no snapshot) — the shared
                      source already sits in the panel header. */}
                  {!status.isSnapshotAvailable ? <StatusPill tone="warn">no snapshot</StatusPill> : null}
                </div>
                <div className="mt-5 font-mono text-2xl text-[var(--color-text)] tabular">
                  {formatCategoryValue(status.categoryId, status.value)}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--color-text-muted)]">
                  <Fact label="confidence" value={status.confidence == null ? "n/a" : fmtBps(status.confidence, 1)} />
                  <Fact label="contributors" value={status.contributors.toString()} />
                  <Fact label="block" value={status.block == null ? "n/a" : `#${fmtBlock(status.block)}`} />
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>

        <Panel elevation={2}>
          <PanelHeader caption="Network / system" title="Runtime status" />
          <PanelBody className="space-y-3">
            <SystemRow icon={<Radio size={15} />} label="Network" value={`${system.network} · chain ${env.chainId}`} />
            <SystemRow icon={<Database size={15} />} label="Indexer" value={system.indexer} />
            <SystemRow
              icon={<Activity size={15} />}
              label="Snapshot"
              value={
                selectedInsights.generatedAt && selectedInsights.block != null
                  ? `${new Date(selectedInsights.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · block #${fmtBlock(selectedInsights.block)}`
                  : "unavailable"
              }
            />
            <SystemRow icon={<ShieldCheck size={15} />} label="Subscription gate" value={system.subscriptionGate} />
          </PanelBody>
        </Panel>
      </div>

      {/* The tabs scope ONLY the two panels below — labeled so users don't expect the overview
          above to react. */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>category detail</span>
          <span className="text-[var(--color-accent)]">↓</span>
        </div>
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel elevation={2}>
          <PanelHeader caption="Top agents" title={FRIENDLY_CATEGORY[categoryId]} right={<StatusPill tone={selectedBoard.source === "live" ? "up" : "accent"}>{sourceLabel(selectedBoard.source)}</StatusPill>} />
          <PanelBody>
            {agents.length === 0 ? (
              <EmptyState title="No listed agents" body="No leaderboard rows are available for this category." />
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {agents.map((agent, index) => (
                  <Link key={agent.id} href={`/terminal/agent/${agent.id}`} className="group grid grid-cols-[40px_1fr_auto] items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-[10px] text-[var(--color-accent)]">
                      {KIND_GLYPH[agent.kind]}
                    </div>
                    <div>
                      <div className="font-mono text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">{String(index + 1).padStart(2, "0")} · {agent.name}</div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        resolved {agent.resolvedCount} · last block #{fmtBlock(agent.lastUpdatedBlock)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">accuracy</div>
                      <div
                        className={`mt-0.5 font-mono text-sm tabular ${agent.accuracyScore >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}`}
                      >
                        {fmtScore(agent.accuracyScore)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/terminal/leaderboard"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent)] hover:underline"
            >
              full leaderboard →
            </Link>
          </PanelBody>
        </Panel>

        <Panel elevation={2}>
          <PanelHeader caption="Latest resolved predictions" title={FRIENDLY_CATEGORY[categoryId]} right={<StatusPill tone={resolved.length > 0 ? "accent" : "muted"}>{resolved.length} resolved</StatusPill>} />
          <PanelBody>
            {selectedInsights.isLoading ? (
              <EmptyState title="Snapshot loading" body="Waiting for the committed snapshot file." />
            ) : resolved.length === 0 ? (
              <EmptyState title="No resolved predictions yet" body="No resolved prediction rows are available in the current snapshot for this category." />
            ) : (
              <div>
                <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] md:hidden">
                  scroll →
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[720px] divide-y divide-[var(--color-border)]">
                    {resolved.map((prediction) => (
                      <div key={prediction.id} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <Cell label="prediction" value={`#${prediction.id}`} />
                        <Cell label="agent" value={agentDisplayName(prediction.agentId)} />
                        <Cell label="band" value={`${formatCategoryValue(categoryId, prediction.low)} – ${formatCategoryValue(categoryId, prediction.high)}`} />
                        <Cell label="outcome" value={prediction.outcome == null ? "n/a" : friendlyValue(categoryId, prediction.outcome)} />
                        <Cell
                          label="score / block"
                          value={`${prediction.score == null ? "n/a" : fmtScore(prediction.score)} · #${fmtBlock(prediction.resolutionBlock)}`}
                          align="right"
                          tone={prediction.score == null ? undefined : prediction.score >= 0 ? "up" : "down"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const card = (
    <Panel elevation={1} className={href ? "transition-colors group-hover:border-[var(--color-accent-soft)]" : undefined}>
      <PanelBody className="p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
          {icon}
          <span className="font-mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
        </div>
        <div className="mt-3 font-mono text-2xl text-[var(--color-text)] tabular">{value}</div>
        <div className="mt-1 truncate text-xs text-[var(--color-text-dim)]">{detail}</div>
      </PanelBody>
    </Panel>
  );
  if (!href) return card;
  return (
    <Link href={href} className="group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]">
      {card}
    </Link>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em]">{label}</div>
      <div className="mt-1 font-mono text-xs text-[var(--color-text-dim)] tabular">{value}</div>
    </div>
  );
}

function SystemRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[20px_130px_1fr] items-start gap-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <div className="mt-0.5 text-[var(--color-accent)]">{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</div>
      <div className="break-all font-mono text-xs text-[var(--color-text-dim)]">{value}</div>
    </div>
  );
}

function Cell({
  label,
  value,
  align = "left",
  tone,
}: {
  label: string;
  value: string;
  align?: "left" | "right";
  tone?: "up" | "down";
}) {
  const toneClass =
    tone === "up" ? "text-[var(--color-up)]" : tone === "down" ? "text-[var(--color-down)]" : "text-[var(--color-text-dim)]";
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 font-mono text-xs tabular ${toneClass}`}>{value}</div>
    </div>
  );
}
