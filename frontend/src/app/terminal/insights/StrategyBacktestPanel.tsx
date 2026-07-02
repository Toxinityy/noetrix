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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineChart as LineIcon } from "lucide-react";

// ─── Shape of strategy-backtest-snapshot.json (agents/backtest gen:strategy) ──
interface Strategy {
  key: string;
  label: string;
  cumulative: { ts: number; value: number }[]; // fractional cumulative return (0.02 = +2%)
  final: number;
  maxDD: number;
  vol: number; // annualized
  sharpe: number;
}
interface StrategySnapshot {
  generatedAt: string;
  windowDays: number;
  startTs: number;
  endTs: number;
  bestAgentKey: string;
  bestAgentLabel: string;
  strategies: Strategy[];
  reading: string;
}

// Line styling per strategy key. Ensemble is the accent hero; risk-on baselines are red-toned,
// safe baselines green-toned, passive muted.
const STYLE: Record<string, { color: string; width: number; dash?: string }> = {
  ensemble: { color: "var(--color-accent)", width: 2.4 },
  bestAgent: { color: "var(--color-warn)", width: 1.5 },
  passive5050: { color: "var(--color-text-muted)", width: 1.2, dash: "4 3" },
  allMeth: { color: "var(--color-down)", width: 1.2 },
  allUsdy: { color: "var(--color-up)", width: 1.2, dash: "4 3" },
};
const styleFor = (k: string) => STYLE[k] ?? { color: "var(--color-text-dim)", width: 1.2 };

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const tone = (x: number) => (x >= 0 ? "var(--color-up)" : "var(--color-down)");
const mmdd = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export function StrategyBacktestPanel() {
  const [snap, setSnap] = React.useState<StrategySnapshot | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/strategy-backtest-snapshot.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<StrategySnapshot>;
      })
      .then((d) => {
        if (!cancelled) setSnap(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge the 5 cumulative series into one row-per-ts array (they share the same window/step grid).
  const chartData = React.useMemo(() => {
    if (!snap || snap.strategies.length === 0) return [];
    const n = snap.strategies[0].cumulative.length;
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < n; i++) {
      const row: Record<string, number> = { ts: snap.strategies[0].cumulative[i].ts };
      for (const s of snap.strategies) row[s.key] = (s.cumulative[i]?.value ?? 0) * 100;
      rows.push(row);
    }
    return rows;
  }, [snap]);

  return (
    <Panel elevation={2} className="mt-8">
      <PanelHeader
        caption="Strategy backtest · total return"
        title="Does the ensemble beat the individuals?"
        right={
          snap ? (
            <StatusPill tone="muted">{snap.windowDays} days · real data</StatusPill>
          ) : null
        }
      />
      <PanelBody>
        {failed ? (
          <EmptyState
            icon={<LineIcon size={14} />}
            title="Backtest snapshot unavailable"
            body="Run 'pnpm --filter @predictor-index/backtest gen:strategy' to generate it."
          />
        ) : snap === null ? (
          <div className="h-72 animate-pulse rounded-md bg-[var(--color-bg-elev-1)]" aria-hidden />
        ) : (
          <div className="space-y-5">
            {/* Legend + final-return stat row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {snap.strategies.map((s) => (
                <div
                  key={s.key}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: styleFor(s.key).color }}
                      aria-hidden
                    />
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-lg" style={{ color: tone(s.final) }}>
                    {pct(s.final)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                    max DD {pct(s.maxDD)} ·{" "}
                    {s.vol < 0.01 ? "riskless" : `Sharpe ${s.sharpe.toFixed(2)}`}
                  </div>
                </div>
              ))}
            </div>

            {/* Cumulative-return chart */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="linear"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={mmdd}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    stroke="var(--color-border-strong)"
                  />
                  <YAxis
                    tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    stroke="var(--color-border-strong)"
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border-strong)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                    }}
                    labelFormatter={(v) => new Date(Number(v) * 1000).toISOString().slice(0, 10)}
                    formatter={(val, key) => {
                      const s = snap.strategies.find((x) => x.key === key);
                      return [`${Number(val).toFixed(1)}%`, s?.label ?? String(key)];
                    }}
                  />
                  {snap.strategies.map((s) => {
                    const st = styleFor(s.key);
                    return (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        stroke={st.color}
                        strokeWidth={st.width}
                        strokeDasharray={st.dash}
                        dot={false}
                        isAnimationActive={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Honest reading */}
            <div className="rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-4 py-3 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
              <span className="text-[var(--color-accent)]">Reading the result:</span> {snap.reading}
            </div>

            {/* Methodology / separation caption */}
            <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
              Backtest · real DefiLlama yields + ETH price · out-of-sample (signal params tuned on the
              train split only). mETH return = ETH price change + staking accrual; USDY = its on-chain
              yield. The allocation rule is pre-registered and identical for the ensemble and every single
              agent — only the driving signal differs. This is a strategy simulation, separate from the
              live on-chain leaderboard. Snapshot generated{" "}
              {new Date(snap.generatedAt).toLocaleDateString("en-US")}.
            </p>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
