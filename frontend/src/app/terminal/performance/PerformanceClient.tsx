"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, FlaskConical, ArrowUpRight } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { FRIENDLY_CATEGORY } from "@/lib/labels";
import { useInsightsData } from "@/lib/hooks";
import { usePerformanceSummary } from "@/lib/performance";
import { ProofStrip } from "@/components/performance/ProofStrip";
import { ReplayCard } from "@/components/performance/ReplayCard";
import { StrategyBacktestPanel } from "@/components/performance/StrategyBacktestPanel";
import { BacktestPanel } from "@/components/performance/BacktestPanel";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const tone = (x: number) => (x >= 0 ? "var(--color-up)" : "var(--color-down)");

export function PerformanceClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const data = useInsightsData(categoryId);
  const { summary } = usePerformanceSummary();
  const source = data.source;

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: FRIENDLY_CATEGORY[c.id],
    caption: c.unit === "usd" ? "in US$" : "annual yield %",
  }));

  const winnersSentence = summary
    ? `No single strategy wins everywhere — ${summary.winners
        .map((w) => `${w.winner} leads ${w.metric}`)
        .join(", ")}. The ensemble adapts between them, without knowing the regime in advance.`
    : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      {/* Eyebrow + headline */}
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <span>noetrix</span>
        <span className="text-[var(--color-accent)]">/</span>
        <span>performance</span>
      </div>
      <h1 className="mt-2 max-w-3xl text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
        Do the agents actually perform?{" "}
        <span className="text-[var(--color-accent)]">See for yourself.</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
        Two tiers, never blurred: a verifiable on-chain track record, and real-market-history backtests
        scored by the same engine. No backdating, no cherry-picking.
      </p>

      {/* HERO stat block — accuracy first, then the ensemble edge */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Forecast accuracy · out-of-sample
          </div>
          {summary ? (
            <>
              <div className="mt-1 font-mono text-[clamp(32px,5vw,44px)] leading-none text-[var(--color-accent)]">
                {Math.round(summary.accuracy.lo)}–{Math.round(summary.accuracy.hi)}
                <span className="text-[var(--color-text-muted)] text-lg"> / 100</span>
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                across {summary.accuracy.testN.toLocaleString("en-US")} held-out {summary.accuracy.metric}{" "}
                forecasts, on real market data
              </div>
            </>
          ) : (
            <Skeleton className="mt-2 h-14 w-40" />
          )}
        </div>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Ensemble vs the field · {summary ? `${summary.ensemble.windowDays} days` : "backtest"}
          </div>
          {summary ? (
            <>
              <div
                className="mt-1 font-mono text-[clamp(32px,5vw,44px)] leading-none"
                style={{ color: tone(summary.ensemble.final) }}
              >
                {pct(summary.ensemble.final)}
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-dim)]">
                the ensemble — vs{" "}
                <span style={{ color: tone(summary.ensemble.bestSingle) }}>
                  {pct(summary.ensemble.bestSingle)}
                </span>{" "}
                for the best single agent and{" "}
                <span style={{ color: tone(summary.ensemble.holdMeth) }}>
                  {pct(summary.ensemble.holdMeth)}
                </span>{" "}
                for holding mETH. It de-risks as its agents disagree.
              </div>
            </>
          ) : (
            <Skeleton className="mt-2 h-14 w-40" />
          )}
        </div>
      </div>

      {winnersSentence ? (
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-[var(--color-text-dim)]">
          <span className="text-[var(--color-accent)]">Why an ensemble:</span> {winnersSentence}
        </p>
      ) : null}

      {/* Tier legend — the whole page's honesty contract, up front */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-md border border-[var(--color-up)]/25 bg-[var(--color-up)]/5 p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-up)]" aria-hidden />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-up)]">
              On-chain · verifiable
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              Committed before the outcome, graded on-chain. A small, growing sample — every figure links
              to the explorer.
            </p>
          </div>
        </div>
        <div className="flex gap-3 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-4">
          <FlaskConical size={18} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Backtest · simulation
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
              Replays the strategies over real market history, out-of-sample, scored by the same CRPS
              engine. Not on-chain — a simulation, never a forecast.
            </p>
          </div>
        </div>
      </div>

      {/* ── LIVE tier ─────────────────────────────────────────────────────── */}
      <div className="mt-10 flex items-center gap-2">
        <ShieldCheck size={16} className="text-[var(--color-up)]" aria-hidden />
        <h2 className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-text)]">
          On-chain track record
        </h2>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {source === "mock"
            ? "· demo data"
            : data.block
              ? `· snapshot @ block #${data.block.toLocaleString("en-US")}`
              : ""}
        </span>
      </div>

      <div className="mt-4">
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      <div data-tour="alpha-proof">
        <ProofStrip data={data} />
      </div>
      <div data-tour="alpha-replay">
        <ReplayCard categoryId={categoryId} predictions={data.category?.predictions ?? []} />
      </div>

      {/* ── BACKTEST tier ─────────────────────────────────────────────────── */}
      <div className="mt-12 flex items-center gap-2">
        <FlaskConical size={16} className="text-[var(--color-text-muted)]" aria-hidden />
        <h2 className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--color-text)]">
          Backtest · real history, out-of-sample
        </h2>
      </div>

      <StrategyBacktestPanel />
      <BacktestPanel />

      {/* Honesty ledger — what's live vs what's simulated, in one glance */}
      <div className="mt-12 overflow-hidden rounded-md border border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-5 py-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          What&apos;s live vs what&apos;s simulated
        </div>
        <ul className="divide-y divide-[var(--color-border)] text-[13px]">
          {[
            { what: "Leaderboard scores & resolved track record", tier: "live", note: "on-chain, verifiable" },
            { what: "Reasoning trace (agent 2)", tier: "live", note: "IPFS-pinned + hash-committed before the outcome" },
            { what: "Accuracy & total-return backtests", tier: "backtest", note: "real history, out-of-sample simulation, same CRPS scorer" },
            { what: "Backdated forecasts", tier: "never", note: "would break commit-before-outcome — we don't do it" },
          ].map((r) => (
            <li key={r.what} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
              <span className="min-w-[240px] flex-1 text-[var(--color-text)]">{r.what}</span>
              <StatusPill
                tone={r.tier === "live" ? "up" : r.tier === "backtest" ? "muted" : "down"}
              >
                {r.tier === "live" ? "LIVE" : r.tier === "backtest" ? "BACKTEST" : "NEVER"}
              </StatusPill>
              <span className="text-[12px] text-[var(--color-text-muted)]">{r.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        Want the live signals instead of the track record?{" "}
        <Link href="/terminal/insights" className="text-[var(--color-accent)] hover:underline">
          See what the agents are saying now
          <ArrowUpRight size={11} className="ml-0.5 inline" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
