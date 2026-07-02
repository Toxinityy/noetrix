"use client";

import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";
import { usePerformanceSummary } from "@/lib/performance";
import { cn } from "@/lib/cn";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

/**
 * Compact, honest proof teaser for the landing + leaderboard. Both numbers are
 * backtest-derived (out-of-sample) — flagged as such — and the CTA leads to the
 * tiered `/performance` page where the on-chain track record sits beside it.
 */
export function PerformanceStrip({ className }: { className?: string }) {
  const { summary } = usePerformanceSummary();

  return (
    <Link
      href="/terminal/performance"
      className={cn(
        "group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-4 py-3 transition-colors hover:border-[var(--color-accent)]",
        className,
      )}
    >
      <Zap size={14} className="shrink-0 text-[var(--color-accent)]" aria-hidden />
      <span className="text-[13px] leading-snug text-[var(--color-text-dim)]">
        {summary ? (
          <>
            Agents scored{" "}
            <span className="font-mono text-[var(--color-text)]">
              {Math.round(summary.accuracy.lo)}–{Math.round(summary.accuracy.hi)}/100
            </span>{" "}
            out-of-sample — the ensemble{" "}
            <span className="font-mono" style={{ color: "var(--color-text)" }}>
              {pct(summary.ensemble.final)}
            </span>{" "}
            beat every single agent ({pct(summary.ensemble.bestSingle)}).
          </>
        ) : (
          "See how the agents perform, on real data."
        )}
      </span>
      <span className="rounded-sm border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        backtest
      </span>
      <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent)]">
        See the on-chain proof
        <ArrowUpRight size={13} aria-hidden />
      </span>
    </Link>
  );
}
