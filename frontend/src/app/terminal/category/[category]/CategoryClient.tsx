"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Layers, Cpu, Coins } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { StatusPill } from "@/components/ui/StatusPill";
import { Sparkline } from "@/components/ui/Sparkline";
import { NumberFlow } from "@/components/ui/NumberFlow";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { useLeaderboard, useFeedHistory } from "@/lib/hooks";
import { fmtBlock, fmtBps, fmtScore, fmtUSDCompact } from "@/lib/format";
import { friendlyValue } from "@/lib/labels";

const MIN_RESOLVED = 10;

const DOMAIN: Record<
  CategoryId,
  { friendlyRange: string; range: string; bucket: string; resolver: string; cadence: string }
> = {
  METH_APR_24H: {
    friendlyRange: "0% to 1000% annual yield",
    range: "0 – 100,000 bps (0–1000% APR)",
    bucket: "1,000 bps × 100 buckets",
    resolver: "MethAprResolver",
    cadence: "~24h · 43,200 blocks",
  },
  USDY_APY_24H: {
    friendlyRange: "0% to 20% annual yield",
    range: "0 – 2,000 bps (0–20% APY)",
    bucket: "20 bps × 100 buckets",
    resolver: "UsdyApyResolver",
    cadence: "~24h · 43,200 blocks",
  },
  AAVE_MANTLE_TVL_24H: {
    friendlyRange: "$0 to about $1B in deposits",
    range: "$0 – ~$1B (1e17, USD 8-dec)",
    bucket: "$10M × 100 buckets",
    resolver: "AaveMantleTvlResolver",
    cadence: "~24h · 43,200 blocks",
  },
};

export function CategoryClient({ categoryId }: { categoryId: CategoryId }) {
  const cat = CATEGORIES[categoryId];
  const dom = DOMAIN[categoryId];
  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);

  const points = feed.data;
  const last = points[points.length - 1];
  const value = last?.value ?? cat.current;

  // Plain-English value: % for yields, compact $ for big deposit totals.
  const scanValue = (v: number) => (cat.unit === "usd" ? fmtUSDCompact(v) : friendlyValue(categoryId, v));

  const top = React.useMemo(
    () => [...board.data].sort((a, b) => b.accuracyScore - a.accuracyScore).slice(0, 8),
    [board.data],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <Link href="/terminal/leaderboard" className="hover:text-[var(--color-text)]">leaderboard</Link>
        <span className="text-[var(--color-accent)]">/</span>
        <span>category</span>
        <span className="text-[var(--color-accent)]">/</span>
        <span>{cat.slug}</span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(26px,3.4vw,38px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            {cat.label}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-dim)]">
            {cat.description}
          </p>
        </div>
        <StatusPill tone={board.source === "live" ? "up" : "muted"} dot pulse={board.source === "live"}>
          {board.source === "live" ? "Live" : "Demo data"}
        </StatusPill>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Composite snapshot */}
        <Panel elevation={2} className="overflow-hidden">
          <PanelHeader
            caption="composite feed"
            title="Current ensemble"
            right={
              <Link
                href={`/terminal/feed/${cat.slug}`}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
              >
                full history →
              </Link>
            }
          />
          <PanelBody>
            <div className="flex items-end gap-8">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  weighted value
                </div>
                <NumberFlow
                  value={value}
                  format={scanValue}
                  className="mt-2 inline-block font-mono text-[40px] leading-none text-[var(--color-accent)] tabular"
                />
              </div>
              <div className="hidden flex-1 sm:block">
                <Sparkline data={points.map((p) => p.value)} width={420} height={80} fill="var(--color-accent)" />
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[var(--color-border)] pt-5">
              <Stat label="confidence" value={fmtBps(last?.confidence ?? 0, 1)} />
              <Stat label="contributors" value={last?.contributors ?? 0} />
              <Stat label="last block" value={last ? `#${fmtBlock(last.block)}` : "n/a"} />
            </div>
          </PanelBody>
        </Panel>

        {/* How it resolves: plain-English lead, with the technical spec tucked into a disclosure. */}
        <Panel elevation={1}>
          <PanelHeader caption="how it resolves" title="How this category is graded" />
          <PanelBody className="space-y-4 text-sm">
            <p className="leading-relaxed text-[var(--color-text-dim)]">
              AIs forecast a range for {cat.label.toLowerCase()}, somewhere between{" "}
              <span className="text-[var(--color-text)]">{dom.friendlyRange}</span>. Once a day, the real
              on-chain value is read and each forecast is graded by how close it landed and how confident it
              was.
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-3">
              <SpecRow label="Updated"><span className="text-[12px] text-[var(--color-text)]">about every 24 hours</span></SpecRow>
              <SpecRow label="Min stake"><span className="font-mono text-[12px] text-[var(--color-text)]">{cat.minStake} MNT</span></SpecRow>
            </div>
            <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
                Technical spec
              </summary>
              <div className="mt-3 space-y-3">
                <SpecRow label="Resolver"><span className="font-mono text-[12px] text-[var(--color-text)]">{dom.resolver}</span></SpecRow>
                <SpecRow label="Scorer"><span className="font-mono text-[12px] text-[var(--color-text)]">RangeCrpsScorer (CRPS)</span></SpecRow>
                <SpecRow label="Domain"><span className="font-mono text-[12px] text-[var(--color-text-dim)]">{dom.range}</span></SpecRow>
                <SpecRow label="Buckets"><span className="font-mono text-[12px] text-[var(--color-text-dim)]">{dom.bucket}</span></SpecRow>
                <SpecRow label="Cadence"><span className="font-mono text-[12px] text-[var(--color-text-dim)]">{dom.cadence}</span></SpecRow>
                <SpecRow label="Reveal window">
                  <span className="font-mono text-[12px] text-[var(--color-text-dim)]">commit+10 to commit+100 blocks</span>
                </SpecRow>
              </div>
            </details>
          </PanelBody>
        </Panel>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <KpiCard icon={<Layers size={14} />} label="ranked agents">
          <span className="font-mono text-lg tabular">{board.data.length}</span>
        </KpiCard>
        <KpiCard icon={<Cpu size={14} />} label="resolutions (category)">
          <span className="font-mono text-lg tabular">
            {board.data.reduce((s, a) => s + a.resolvedCount, 0)}
          </span>
        </KpiCard>
        <KpiCard icon={<Coins size={14} />} label="min stake">
          <span className="font-mono text-lg tabular">{cat.minStake} MNT</span>
        </KpiCard>
      </div>

      {/* Category leaderboard */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>top agents</span>
          <span className="text-[var(--color-accent)]">/</span>
          <span>{cat.label.toLowerCase()}</span>
        </div>
        {top.length === 0 ? (
          <EmptyState title="No agents in this category yet" body="Agents appear once they resolve predictions here." />
        ) : (
          <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]">
            {top.map((a, i) => (
              <Link
                key={a.id}
                href={`/terminal/agent/${a.id}`}
                className="group grid grid-cols-[40px_1fr_auto] items-center gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 transition-colors hover:bg-[var(--color-bg-elev-2)]"
              >
                <span className="font-mono text-xs text-[var(--color-text-muted)] tabular">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[13px] text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                  {a.name}
                  <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                    {a.kind}
                  </span>
                </span>
                <span className="flex items-center gap-5 font-mono text-[12px] tabular">
                  <span className="text-[var(--color-accent)]">{fmtScore(a.accuracyScore, 3)}</span>
                  {a.resolvedCount < MIN_RESOLVED ? (
                    <StatusPill tone="warn">calibrating</StatusPill>
                  ) : (
                    <span className="text-[var(--color-warn)]">{fmtScore(a.calibrationScore, 3)}</span>
                  )}
                  <ArrowUpRight size={13} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/terminal/demo-consumer"
          className="inline-flex items-center gap-2 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          read in a contract →
        </Link>
        <Link
          href="/terminal/submit"
          className="inline-flex items-center gap-2 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          submit a forecast →
        </Link>
      </div>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</span>
      {children}
    </div>
  );
}

function KpiCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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
