"use client";

import * as React from "react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart2 } from "lucide-react";

// ─── Types matching the backtest-snapshot.json shape (Plan 3) ──────────────

interface BacktestAgent {
  agentKey: string;
  label: string;
  accuracy: number;   // 0–1e6 (same as on-chain reputation)
  calibration: number; // ≤0 (more-negative = worse)
  resolved: number;
  meanScore: number;
}

interface BacktestCorrelation {
  keys: string[];
  matrix: number[][];
}

interface StressEntry {
  ts: number;
  level: "Calm" | "Elevated" | "Stressed";
  disagreementBps: number;
  surpriseBps: number;
  fearGreed: number;
  confidenceBps: number;
}

interface BacktestCategory {
  metric: string;
  disagreeScale: string;
  trainSteps: number;
  testSteps: number;
  agents: BacktestAgent[];
  correlation: BacktestCorrelation;
  stressTimeline: StressEntry[];
}

interface BacktestSnapshot {
  generatedAt: string;
  categories: BacktestCategory[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Map the raw metric key to a friendly display name. */
function friendlyMetric(metric: string): string {
  if (metric === "METH_APR") return "mETH APR";
  if (metric === "AAVE_TVL") return "Aave-Mantle TVL";
  if (metric === "USDY_APY") return "USDY APY";
  return metric;
}

/** Format a 0–1e6 score as a 0–100% value (divide by 1e4). */
function fmtScore(v: number): string {
  return (v / 10000).toFixed(2) + "%";
}

/** Format calibration (≤0, closer to 0 is better). */
function fmtCalibration(v: number): string {
  // Show as negative bps, e.g. –26.62%
  return (v / 10000).toFixed(2) + "%";
}

/** Heat cell background colour for a correlation value in [–1, 1]. */
function heatColor(v: number): string {
  const clamped = Math.max(-1, Math.min(1, v));
  if (clamped >= 0) {
    // 0→neutral, 1→accent teal
    const pct = Math.round(clamped * 100);
    return `color-mix(in srgb, var(--color-accent) ${pct}%, var(--color-bg-elev-1))`;
  }
  // negative→down red
  const pct = Math.round(-clamped * 100);
  return `color-mix(in srgb, var(--color-down) ${pct}%, var(--color-bg-elev-1))`;
}

/** Count stress levels from the timeline. */
function countLevels(timeline: StressEntry[]): { calm: number; elevated: number; stressed: number } {
  let calm = 0;
  let elevated = 0;
  let stressed = 0;
  for (const e of timeline) {
    if (e.level === "Calm") calm++;
    else if (e.level === "Elevated") elevated++;
    else stressed++;
  }
  return { calm, elevated, stressed };
}

// ─── Sub-components ────────────────────────────────────────────────────────

/** Per-agent leaderboard table for one category. */
function AgentLeaderboard({ agents }: { agents: BacktestAgent[] }) {
  const sorted = [...agents].sort((a, b) => b.meanScore - a.meanScore);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-xs" aria-label="Backtest agent leaderboard">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            <th className="pb-2 text-left font-normal">Agent</th>
            <th className="pb-2 text-right font-normal">Accuracy</th>
            <th className="pb-2 text-right font-normal">Calibration</th>
            <th className="pb-2 text-right font-normal">Resolved</th>
            <th className="pb-2 text-right font-normal">Mean Score</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a, i) => (
            <tr key={a.agentKey} className="border-b border-[var(--color-border)]/50 last:border-0">
              <td className="py-1.5 font-mono text-[var(--color-text)]">
                {i === 0 && (
                  <span className="mr-1.5 text-[var(--color-accent)]" aria-hidden>★</span>
                )}
                {a.label}
              </td>
              <td className="py-1.5 text-right font-mono text-[var(--color-text-dim)]">
                {fmtScore(a.accuracy)}
              </td>
              <td className="py-1.5 text-right font-mono text-[var(--color-text-dim)]">
                {fmtCalibration(a.calibration)}
              </td>
              <td className="py-1.5 text-right font-mono text-[var(--color-text-muted)]">
                {a.resolved.toLocaleString("en-US")}
              </td>
              <td className="py-1.5 text-right font-mono text-[var(--color-text)]">
                {fmtScore(a.meanScore)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Compact correlation heatmap (keys × keys). */
function CorrelationHeatmap({ correlation }: { correlation: BacktestCorrelation }) {
  const { keys, matrix } = correlation;
  return (
    <div className="overflow-x-auto">
      <div aria-label="Correlation heatmap" role="table" className="inline-block min-w-max">
        {/* Header row */}
        <div role="row" className="flex">
          <div role="columnheader" className="w-28 shrink-0" />
          {keys.map((k) => (
            <div
              key={k}
              role="columnheader"
              className="w-16 shrink-0 px-0.5 pb-1 text-center font-mono text-[9px] text-[var(--color-text-muted)]"
              title={k}
            >
              {k.slice(0, 5)}
            </div>
          ))}
        </div>
        {/* Data rows */}
        {keys.map((rowKey, r) => (
          <div role="row" key={rowKey} className="flex items-center">
            <div
              role="rowheader"
              className="w-28 shrink-0 pr-2 font-mono text-[9px] text-[var(--color-text-muted)]"
              title={rowKey}
            >
              {rowKey.slice(0, 12)}
            </div>
            {keys.map((_, c) => {
              const v = matrix[r][c];
              return (
                <div
                  key={c}
                  role="cell"
                  aria-label={`${rowKey} vs ${keys[c]}: ${v.toFixed(2)}`}
                  className="flex h-8 w-16 shrink-0 items-center justify-center rounded-sm font-mono text-[9px] text-[var(--color-text)]"
                  style={{ background: heatColor(v) }}
                >
                  {v.toFixed(2)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bar-chart of Calm / Elevated / Stressed counts. */
function StressDistribution({ timeline }: { timeline: StressEntry[] }) {
  const total = timeline.length;
  if (total === 0) return <span className="text-xs text-[var(--color-text-dim)]">No stress data.</span>;
  const { calm, elevated, stressed } = countLevels(timeline);
  const bars: { label: string; count: number; tone: "up" | "warn" | "down" }[] = [
    { label: "Calm", count: calm, tone: "up" },
    { label: "Elevated", count: elevated, tone: "warn" },
    { label: "Stressed", count: stressed, tone: "down" },
  ];
  const colorMap: Record<"up" | "warn" | "down", string> = {
    up: "var(--color-up)",
    warn: "var(--color-warn)",
    down: "var(--color-down)",
  };
  return (
    <div className="flex flex-col gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <div
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: colorMap[b.tone], minWidth: "4.5rem" }}
          >
            {b.label}
          </div>
          <div className="relative h-3 flex-1 overflow-hidden rounded-sm bg-[var(--color-bg)]">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(b.count / total) * 100}%`,
                background: colorMap[b.tone],
                opacity: 0.7,
              }}
              aria-hidden
            />
          </div>
          <span className="font-mono text-[11px] text-[var(--color-text-dim)]">
            {b.count}
            <span className="text-[var(--color-text-muted)]">
              {" "}({((b.count / total) * 100).toFixed(0)}%)
            </span>
          </span>
        </div>
      ))}
      <p className="text-[10px] text-[var(--color-text-muted)]">
        Over {total.toLocaleString("en-US")} test steps
      </p>
    </div>
  );
}

/** Single category section inside the panel. */
function CategorySection({ cat }: { cat: BacktestCategory }) {
  return (
    <div className="space-y-5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4">
      {/* Category header */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-mono text-sm font-medium text-[var(--color-text)]">
          {friendlyMetric(cat.metric)}
        </h3>
        <StatusPill tone="muted">
          {cat.testSteps.toLocaleString("en-US")} test steps
        </StatusPill>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
          (trained on {cat.trainSteps.toLocaleString("en-US")})
        </span>
      </div>

      {/* 3-column grid: leaderboard | heatmap | stress */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Agent leaderboard */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Agent leaderboard (test period)
          </div>
          <AgentLeaderboard agents={cat.agents} />
        </div>

        {/* Diversity heatmap */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Diversity proof — forecast correlation
          </div>
          <CorrelationHeatmap correlation={cat.correlation} />
          <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
            Lower correlation = more diverse swarm = better ensemble.
          </p>
        </div>

        {/* Stress distribution */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Market stress distribution
          </div>
          <StressDistribution timeline={cat.stressTimeline} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * BacktestPanel — fetches /backtest-snapshot.json (committed public asset) and
 * renders, per category: the per-agent leaderboard, diversity heatmap, and
 * stress-distribution summary.
 */
export function BacktestPanel() {
  const [snapshot, setSnapshot] = React.useState<BacktestSnapshot | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/backtest-snapshot.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BacktestSnapshot>;
      })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Panel elevation={1} className="mt-8">
      <PanelHeader
        caption="Historical backtest"
        title="Backtest results — real market data"
        right={
          snapshot ? (
            <StatusPill tone="muted">
              {new Date(snapshot.generatedAt).toLocaleDateString("en-US")}
            </StatusPill>
          ) : null
        }
      />
      <PanelBody>
        {failed ? (
          <EmptyState
            icon={<BarChart2 size={14} />}
            title="Backtest snapshot unavailable"
            body="Run 'pnpm --filter @predictor-index/backtest run:backtest' to generate it."
          />
        ) : snapshot === null ? (
          <div className="space-y-3">
            {/* Loading skeleton rows */}
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-md bg-[var(--color-bg-elev-1)]"
                aria-hidden
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {snapshot.categories.map((cat) => (
              <CategorySection key={cat.metric} cat={cat} />
            ))}

            {/* Honesty caption */}
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-4 py-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              <span className="text-[var(--color-text-dim)]">Honest caveat:</span> these results use
              real DefiLlama data for the test periods. Recent Aave-on-Mantle and USDY windows were
              genuinely fearful (Fear&amp;Greed dipping into the 20s–30s). Agent correlations are
              moderate — simple models running on the same underlying series are partly correlated,
              especially Naive/Mean-Reversion/Momentum. The Sentiment (F&amp;G) agent has lower
              correlation with the others precisely because it uses a different signal source.
              These are indicative numbers for a hackathon demo; treat them as directional, not
              production-grade.
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
