"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  ChevronDown,
  ExternalLink,
  Sparkles,
  Cpu,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddressChip } from "@/components/ui/AddressChip";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ForecastSummary } from "@/components/app/ForecastSummary";
import {
  CATEGORIES,
  PREDICTIONS,
  KIND_COLOR,
  KIND_GLYPH,
  DEEPSEEK_MODEL,
  type CategoryId,
  type Prediction,
  type Agent,
  getAgentById,
} from "@/lib/mockData";
import { fmtBlock, fmtBps, fmtScore } from "@/lib/format";
import { cn } from "@/lib/cn";

const RADAR_AXES = [
  { id: "accuracy", label: "Accuracy" },
  { id: "calibration", label: "Calibration" },
  { id: "volume", label: "Volume" },
  { id: "confidence", label: "Conf. quality" },
  { id: "recency", label: "Recency" },
];

export function AgentDetailClient({ agentId }: { agentId: number }) {
  const agent = getAgentById(agentId)!;
  const reducedMotion = useReducedMotion();
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const cat = CATEGORIES[categoryId];
  const rep = agent.reputation[categoryId];

  // React Compiler memoizes these derivations automatically; a manual useMemo here tripped
  // react-hooks/preserve-manual-memoization, so we compute them plainly in render.
  const predictions = PREDICTIONS.filter(
    (p) => p.agentId === agent.id && p.categoryId === categoryId,
  ).sort((a, b) => b.commitBlock - a.commitBlock);

  // Most recent prediction that carries a reasoning trace: surfaced as the page's visual peak.
  // Gate is semantic (does a trace exist?), not tied to the stale "CLAUDE" enum name.
  const featuredReasoning =
    predictions.find((p) => p.reasoning) ??
    PREDICTIONS.filter((p) => p.agentId === agent.id && p.reasoning).sort(
      (a, b) => b.commitBlock - a.commitBlock,
    )[0];
  const hasReasoning = !!featuredReasoning?.reasoning;

  const equity = agent.equityCurve;
  const equityCurrent = equity[equity.length - 1].value;
  const equityStart = equity[0].value;
  const equityDelta = ((equityCurrent - equityStart) / equityStart) * 100;

  const radarData = RADAR_AXES.map((axis) => ({
    axis: axis.label,
    value: radarValue(agent, categoryId, axis.id),
  }));

  const calibrationData = rep.bucketAccuracy.map((acc, i) => ({
    bucket: `${i * 10}-${i * 10 + 10}%`,
    midpoint: i * 10 + 5,
    realized: acc * 100,
    count: rep.bucketCount[i],
  }));

  const equityData = equity.map((p) => ({
    block: p.block,
    value: p.value,
  }));

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption: `${agent.reputation[c.id].resolvedCount} resolved`,
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <Link href="/leaderboard" className="hover:text-[var(--color-text)]">
          leaderboard
        </Link>
        <span className="text-[var(--color-accent)]">/</span>
        <span>agent #{agent.id.toString().padStart(4, "0")}</span>
      </div>

      {/* Honesty banner: this profile view is illustrative; the real, verifiable data lives on the
          leaderboard (committed snapshot) and on-chain. Avoids presenting demo reputation/equity/
          reasoning as live-verified (the hosted indexer that would back this page isn't up). */}
      <div
        role="status"
        className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md border border-[var(--color-warn)]/40 bg-[color:color-mix(in_srgb,var(--color-warn)_8%,var(--color-bg-elev-1))] px-4 py-2.5 text-xs"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warn)]">
          Illustrative profile
        </span>
        <span className="text-[var(--color-text-dim)]">
          Reputation history, equity curve, and the reasoning trace below are demo-shaped pending the
          hosted indexer. Live verified scores:
        </span>
        <Link href="/leaderboard" className="text-[var(--color-accent)] hover:underline">
          leaderboard
        </Link>
        <span className="text-[var(--color-text-muted)]">·</span>
        <Link href="/try" className="text-[var(--color-accent)] hover:underline">
          live feed
        </Link>
        <span className="text-[var(--color-text-muted)]">Every forecast is committed before the outcome and graded on-chain.</span>
      </div>

      {/* Identity card */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <IdentityCard agent={agent} />

        <Panel elevation={2}>
          <PanelHeader caption="Profile" title="System metadata" />
          <PanelBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <Field label="Token ID">
                <span className="font-mono tabular">
                  #{agent.id.toString().padStart(4, "0")}
                </span>
              </Field>
              <Field label="Standard">
                <StatusPill tone="accent">ERC-8004 · soulbound</StatusPill>
              </Field>
              <Field label="Controller">
                <AddressChip
                  address={agent.controller}
                  href={`https://sepolia.mantlescan.xyz/address/${agent.controller}`}
                />
              </Field>
              <Field label="Metadata URI">
                <a
                  href={ipfsHref(agent.metadataURI)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
                >
                  {agent.metadataURI.slice(0, 28)}…
                  <ExternalLink size={11} aria-hidden />
                </a>
              </Field>
              <Field label="Registered">
                <span className="font-mono tabular">
                  #{fmtBlock(agent.registeredBlock)}
                </span>
              </Field>
              <Field label="Class">
                <StatusPill tone="muted">{agent.kind}</StatusPill>
              </Field>
            </dl>
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                description
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-dim)]">
                {agent.description}
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* KPI row */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Sparkles size={14} />} label="composite accuracy">
          <span className="font-mono text-2xl text-[var(--color-accent)] tabular">
            {fmtScore(compositeAccuracy(agent), 3)}
          </span>
        </KpiCard>
        <KpiCard icon={<ShieldCheck size={14} />} label="composite calibration">
          <span className="font-mono text-2xl tabular text-[var(--color-warn)]">
            {fmtScore(compositeCalibration(agent), 3)}
          </span>
        </KpiCard>
        <KpiCard icon={<Activity size={14} />} label="equity curve">
          <span className="font-mono text-2xl tabular">
            <span className={equityDelta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
              {equityCurrent.toFixed(3)}x
            </span>{" "}
            <span className="text-xs text-[var(--color-text-muted)]">
              {equityDelta >= 0 ? "▲" : "▼"} {Math.abs(equityDelta).toFixed(1)}%
            </span>
          </span>
        </KpiCard>
        <KpiCard icon={<Cpu size={14} />} label="resolved predictions">
          <span className="font-mono text-2xl tabular">
            {agent.reputation.METH_APR_24H.resolvedCount +
              agent.reputation.AAVE_MANTLE_TVL_24H.resolvedCount}
          </span>
        </KpiCard>
      </div>

      {/* Featured reasoning: the visual peak. Lead with the narrative; the charts below are
          supporting evidence. Gated on whether a reasoning trace actually exists. */}
      {hasReasoning && featuredReasoning?.reasoning ? (
        <div className="mt-8">
          <FeaturedReasoning prediction={featuredReasoning} />
        </div>
      ) : null}

      {/* Category tabs */}
      <div className="mt-8">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as CategoryId)}
        />
      </div>

      {/* Reputation overview row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel elevation={1}>
          <PanelHeader caption="reputation" title={`Profile · ${cat.label}`} />
          <PanelBody className="pb-2 pt-3">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="78%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{
                      fill: "var(--color-text-muted)",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                    }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="value"
                    stroke="var(--color-accent)"
                    fill="var(--color-accent)"
                    fillOpacity={0.18}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4">
              <Stat
                label="Accuracy EMA"
                value={fmtScore(rep.accuracyScore, 3)}
                tone="accent"
              />
              <Stat
                label="Calibration"
                value={fmtScore(rep.calibrationScore, 3)}
                tone="warn"
              />
              <Stat label="Resolved" value={rep.resolvedCount} />
              <Stat
                label="Last update"
                value={`#${fmtBlock(rep.lastUpdatedBlock)}`}
              />
            </div>
          </PanelBody>
        </Panel>

        <Panel elevation={1}>
          <PanelHeader
            caption="performance"
            title="Equity curve · 72 epochs"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                deflated to stake × score-multiplier
              </span>
            }
          />
          <PanelBody className="pb-3 pt-2">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={equityData}
                  margin={{ top: 10, right: 8, left: 4, bottom: 8 }}
                >
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
                    tickFormatter={(v) => `${v.toFixed(2)}x`}
                    stroke="var(--color-border-strong)"
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border-strong)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                    labelFormatter={(v) => `block #${fmtBlock(Number(v))}`}
                    formatter={(v) => [`${Number(v).toFixed(3)}x`, "equity"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-accent)"
                    strokeWidth={1.6}
                    dot={false}
                    activeDot={{
                      r: 3,
                      fill: "var(--color-accent)",
                      stroke: "var(--color-bg)",
                      strokeWidth: 1,
                    }}
                    isAnimationActive={!reducedMotion}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Calibration breakdown */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel elevation={1}>
          <PanelHeader
            caption="calibration buckets"
            title="Stated confidence vs realized accuracy"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                10 buckets · α=0.1 EMA
              </span>
            }
          />
          <PanelBody className="pb-3 pt-2">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={calibrationData}
                  margin={{ top: 10, right: 8, left: 4, bottom: 8 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeDasharray="2 2"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="bucket"
                    tick={{
                      fill: "var(--color-text-muted)",
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                    }}
                    stroke="var(--color-border-strong)"
                    angle={-30}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fill: "var(--color-text-muted)",
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                    }}
                    tickFormatter={(v) => `${v}%`}
                    stroke="var(--color-border-strong)"
                    width={42}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border-strong)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                    formatter={(value, name) => {
                      const v = Number(value);
                      if (name === "realized") {
                        return [`${v.toFixed(1)}%`, "realized"];
                      }
                      if (name === "midpoint") {
                        return [`${v}%`, "midpoint"];
                      }
                      return [String(v), String(name)];
                    }}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { count?: number } | undefined;
                      return `${label} · n=${item?.count ?? 0}`;
                    }}
                  />
                  <Bar
                    dataKey="midpoint"
                    fill="var(--color-border-strong)"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="realized"
                    fill="var(--color-accent)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
              <LegendDot color="var(--color-border-strong)" label="bucket midpoint (ideal)" />
              <LegendDot color="var(--color-accent)" label="realized accuracy (EMA)" />
            </div>
          </PanelBody>
        </Panel>

        <Panel elevation={1}>
          <PanelHeader caption="staking" title="Stake on this agent" />
          <PanelBody>
            <div className="rounded border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <span>v2 feature</span>
                <StatusPill tone="warn">DISABLED</StatusPill>
              </div>
              <p className="mt-3 text-sm text-[var(--color-text-dim)]">
                Public staking on agent reputation ships in v2 (StakingPool). For this hackathon, only the
                agent&apos;s controller stakes on their own predictions. Subscribe to the composite feed instead.
              </p>
              <button
                disabled
                className="mt-4 w-full cursor-not-allowed rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] opacity-70"
              >
                Stake (v2)
              </button>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Predictions table with expandable rows */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          <span>history</span>
          <span className="text-[var(--color-accent)]">/</span>
          <span>{cat.label.toLowerCase()}</span>
        </div>
        <PredictionsTable predictions={predictions} agent={agent} />
      </div>
    </div>
  );
}

function IdentityCard({ agent }: { agent: Agent }) {
  return (
    <Panel elevation={2} className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(700px 400px at 0% 0%, rgba(51, 234, 179, 0.10), transparent 60%)",
        }}
      />
      <div className="relative z-10 flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-start gap-3">
          <div
            className="relative grid place-items-center rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)]"
            style={{ width: 96, height: 96 }}
          >
            <span
              className="font-mono text-2xl uppercase tabular"
              style={{ color: kindColor(agent.kind) }}
            >
              {kindShort(agent.kind)}
            </span>
            <span className="absolute -top-2 -left-2 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              #{agent.id.toString().padStart(4, "0")}
            </span>
          </div>
          <StatusPill tone="accent" dot>
            ERC-8004
          </StatusPill>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            <span>agent identity</span>
          </div>
          <h1 className="mt-1 font-mono text-[clamp(24px,2.6vw,30px)] leading-tight text-[var(--color-text)]">
            {agent.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.badges.map((b) => (
              <StatusPill key={b} tone="muted">
                {b}
              </StatusPill>
            ))}
          </div>
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--color-text-dim)]">
            {agent.description}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function PredictionsTable({
  predictions,
  agent,
}: {
  predictions: Prediction[];
  agent: Agent;
}) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const reducedMotion = useReducedMotion();

  const toggle = (id: number) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const fmt = (p: Prediction) => CATEGORIES[p.categoryId].unitFormatter;

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]">
      <div className="overflow-x-auto">
      <div className="grid min-w-[760px] grid-cols-[40px_120px_1fr_140px_120px_120px_120px] gap-0 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        <div></div>
        <div>Status</div>
        <div>Range · Outcome</div>
        <div className="text-right">Confidence</div>
        <div className="text-right">Score</div>
        <div className="text-right">Resolution</div>
        <div className="text-right">Stake</div>
      </div>
      <ul className="min-w-[760px]">
        {predictions.map((p) => {
          const isOpen = expanded.has(p.id);
          const formatter = fmt(p);
          const statusTone =
            p.status === "Resolved"
              ? p.score && p.score > 0
                ? "up"
                : "down"
              : p.status === "Revealed"
                ? "accent"
                : p.status === "Committed"
                  ? "warn"
                  : "muted";
          return (
            <li
              key={p.id}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-expanded={isOpen}
                className={cn(
                  "grid w-full grid-cols-[40px_120px_1fr_140px_120px_120px_120px] items-center gap-0 px-4 py-3 text-left text-sm transition-colors",
                  "cursor-pointer hover:bg-[var(--color-bg-elev-2)]",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-sm border border-[var(--color-border)] text-[var(--color-accent)] transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                >
                  <ChevronDown size={11} />
                </span>
                <span>
                  <StatusPill tone={statusTone as "up"} dot>
                    {p.status}
                  </StatusPill>
                </span>
                <span className="font-mono text-[12px] text-[var(--color-text-dim)] tabular">
                  <span className="text-[var(--color-text)]">
                    [{formatter(p.value.low)} → {formatter(p.value.high)}]
                  </span>
                  {p.outcome !== undefined ? (
                    <>
                      {" · "}
                      <span
                        className={
                          isInRange(p)
                            ? "text-[var(--color-up)]"
                            : "text-[var(--color-down)]"
                        }
                      >
                        outcome {formatter(p.outcome)}
                      </span>
                    </>
                  ) : null}
                </span>
                <span className="text-right font-mono text-[12px] tabular text-[var(--color-text)]">
                  {fmtBps(p.confidence, 1)}
                </span>
                <span className="text-right font-mono text-[12px] tabular">
                  {p.score !== undefined ? (
                    <span
                      className={
                        p.score >= 0
                          ? "text-[var(--color-up)]"
                          : "text-[var(--color-down)]"
                      }
                    >
                      {fmtScore(p.score, 3)}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">n/a</span>
                  )}
                </span>
                <span className="text-right font-mono text-[11px] tabular text-[var(--color-text-muted)]">
                  #{fmtBlock(p.resolutionBlock)}
                </span>
                <span className="text-right font-mono text-[12px] tabular text-[var(--color-text-dim)]">
                  {p.stake.toFixed(2)} MNT
                </span>
              </button>

              {isOpen ? (
                <div className="bg-[var(--color-bg)] px-5 pt-4">
                  <ForecastSummary
                    summary={p.reasoning?.summary}
                    confidenceRationale={p.reasoning?.confidenceRationale}
                    predictionId={p.id}
                    agentKind={agent.kind}
                    category={p.categoryId}
                    low={p.value.low}
                    high={p.value.high}
                    confidence={p.confidence}
                    accuracyScore={agent.reputation[p.categoryId].accuracyScore}
                  />
                </div>
              ) : null}

              {isOpen && p.reasoning ? (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-[var(--color-bg)] px-5 py-6"
                >
                  <ReasoningTrace prediction={p} />
                </motion.div>
              ) : null}
            </li>
          );
        })}
        {predictions.length === 0 ? (
          <li className="px-4 py-6">
            <EmptyState
              title="No predictions in this category yet"
              body="This agent hasn't committed for the selected category. Switch tabs or check back once the next epoch closes."
            />
          </li>
        ) : null}
      </ul>
      </div>
    </div>
  );
}

function FeaturedReasoning({ prediction }: { prediction: Prediction }) {
  const r = prediction.reasoning!;
  const cat = CATEGORIES[prediction.categoryId];
  return (
    <Panel elevation={2} className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[var(--color-accent)] opacity-60"
      />
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-[var(--color-accent)]" aria-hidden />
            <h2 className="font-mono text-base uppercase tracking-[0.18em] text-[var(--color-text)]">
              Reasoning <span className="text-[var(--color-accent)]">→</span>
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {DEEPSEEK_MODEL}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone="muted">{cat.label}</StatusPill>
            <StatusPill tone="accent">conf {fmtBps(prediction.confidence, 1)}</StatusPill>
            {prediction.score !== undefined ? (
              <StatusPill tone={prediction.score >= 0 ? "up" : "down"}>
                score {fmtScore(prediction.score, 3)}
              </StatusPill>
            ) : (
              <StatusPill tone="warn">{prediction.status}</StatusPill>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-5">
            <ForecastSummary
              summary={r.summary}
              confidenceRationale={r.confidenceRationale}
              predictionId={prediction.id}
              agentKind="CLAUDE"
              category={prediction.categoryId}
              low={prediction.value.low}
              high={prediction.value.high}
              confidence={prediction.confidence}
              accuracyScore={0}
            />
          </div>
          <ol className="relative space-y-6 border-l-2 border-[var(--color-border-strong)] pl-7">
            {r.steps.map((s, i) => (
              <li key={i} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[34px] top-1 grid h-4 w-4 place-items-center rounded-full border border-[var(--color-accent)] bg-[var(--color-bg)] text-[8px] font-mono text-[var(--color-accent)]"
                >
                  {i + 1}
                </span>
                <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  {s.kind}
                </div>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-text)]">
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5">
            {r.citations.map((c) => (
              <a
                key={c.label}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
              >
                {c.label}
                <ExternalLink size={11} aria-hidden />
              </a>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              forecast payload · json
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">IPFS</span>
          </div>
          <pre className="max-h-[320px] overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            {r.rawJSON}
          </pre>
          <a
            href={ipfsHref(prediction.contentURI)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
          >
            {prediction.contentURI} <ExternalLink size={10} aria-hidden />
          </a>
        </div>
      </div>
    </Panel>
  );
}

function ReasoningTrace({ prediction }: { prediction: Prediction }) {
  const r = prediction.reasoning!;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          reasoning trace · {DEEPSEEK_MODEL}
        </div>
        <ol className="relative mt-4 space-y-4 border-l border-[var(--color-border-strong)] pl-6">
          {r.steps.map((s, i) => (
            <li key={i} className="relative">
              <span
                aria-hidden
                className="absolute -left-[27px] top-1 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
              />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {String(i + 1).padStart(2, "0")} · {s.kind}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--color-text)]">
                {s.text}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            citations
          </div>
          <ul className="mt-2 space-y-1.5">
            {r.citations.map((c) => (
              <li key={c.label}>
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)]"
                >
                  {c.label}
                  <ExternalLink size={11} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          ipfs payload
        </div>
        <pre className="mt-3 max-h-[260px] overflow-auto rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4 font-mono text-[11px] leading-relaxed text-[var(--color-text-dim)]">
          {r.rawJSON}
        </pre>
        <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <span className="truncate">{prediction.contentURI}</span>
          <a
            href={ipfsHref(prediction.contentURI)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
          >
            open in viewer <ExternalLink size={10} aria-hidden />
          </a>
        </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-text)]">{children}</dd>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.16em]">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function compositeAccuracy(a: Agent): number {
  const vals = Object.values(a.reputation).map((r) => r.accuracyScore);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}
function compositeCalibration(a: Agent): number {
  const vals = Object.values(a.reputation).map((r) => r.calibrationScore);
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function radarValue(a: Agent, catId: CategoryId, axis: string): number {
  const r = a.reputation[catId];
  switch (axis) {
    case "accuracy":
      return Math.max(0, Math.min(100, (r.accuracyScore / 1_000_000) * 100 + 50));
    case "calibration":
      return Math.max(0, Math.min(100, 100 + (r.calibrationScore / 500_000) * 100));
    case "volume":
      return Math.min(100, (r.resolvedCount / 100) * 100);
    case "confidence":
      // average of bucket counts weighted by accuracy
      {
        const total = r.bucketCount.reduce((s, v) => s + v, 0) || 1;
        const weighted = r.bucketAccuracy.reduce(
          (s, acc, i) => s + acc * r.bucketCount[i],
          0,
        );
        return Math.min(100, (weighted / total) * 100);
      }
    case "recency":
      return Math.min(100, ((12_488_200 - r.lastUpdatedBlock + 600) / 600) * 50 + 50);
    default:
      return 0;
  }
}

/// Resolve an ipfs:// URI to an HTTP gateway link (falls back to the raw value for http/other).
function ipfsHref(uri: string): string {
  return uri.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${uri.slice("ipfs://".length)}`
    : uri;
}

function isInRange(p: Prediction): boolean {
  if (p.outcome === undefined) return false;
  return p.outcome >= p.value.low && p.outcome <= p.value.high;
}

const kindShort = (k: Agent["kind"]) => KIND_GLYPH[k];
const kindColor = (k: Agent["kind"]) => KIND_COLOR[k];
