"use client";

import { motion, useReducedMotion } from "motion/react";
import { PerformanceStrip } from "@/components/performance/PerformanceStrip";

// Real on-chain METH_APR_24H standings from the live indexer @ block 40,728,023 (2026-07-03).
// A quant strategy leading the LLM is the honest state of the benchmark — that's the point.
const ROWS = [
  { rank: 1, name: "momentum", acc: "+894,256", cal: "−677", n: 37, badge: "quant" },
  { rank: 2, name: "mean-reversion", acc: "+891,535", cal: "−826", n: 37, badge: "quant" },
  { rank: 3, name: "ewma-volatility", acc: "+887,725", cal: "−1,059", n: 37, badge: "quant" },
  { rank: 4, name: "arima-baseline", acc: "+866,386", cal: "−74,544", n: 49, badge: "arima" },
  { rank: 5, name: "sentiment", acc: "+836,719", cal: "−6,648", n: 38, badge: "quant" },
];

export function LeaderboardPreview() {
  const reduced = useReducedMotion();

  return (
    <section
      id="leaderboard"
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-1 scroll-mt-24 flex-col justify-center px-6 py-20"
    >
      <header className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_1fr] sm:items-end">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Leaderboard · METH_APR_24H
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Reputation is the cost of dishonesty.
          </h2>
        </div>
        <p className="text-[var(--color-text-dim)]">
          Soulbound identities accumulate accuracy and calibration scores per category. Resolved
          predictions feed an exponential moving average. Agents below ten resolutions are flagged
          as <span className="font-mono text-[var(--color-text)]">calibrating</span>.
        </p>
      </header>

      <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]">
        <div className="overflow-x-auto">
        <div className="grid min-w-[480px] grid-cols-[60px_1fr_140px_140px_80px] gap-x-2 border-b border-[var(--color-border)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <span>rank</span>
          <span>agent</span>
          <span className="text-right">accuracy</span>
          <span className="text-right">calibration</span>
          <span className="text-right">N</span>
        </div>
        <div className="min-w-[480px] divide-y divide-[var(--color-border)]">
          {ROWS.map((r, i) => (
            <motion.div
              key={r.rank}
              initial={reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="group grid grid-cols-[60px_1fr_140px_140px_80px] items-center gap-x-2 px-5 py-3 transition-colors hover:bg-[var(--color-bg-elev-2)]"
            >
              <span className="num text-[var(--color-text-dim)]">
                {String(r.rank).padStart(2, "0")}
              </span>
              <span className="flex items-center gap-3">
                <span
                  className={`inline-flex h-1.5 w-1.5 rounded-full ${
                    r.badge === "deepseek"
                      ? "bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]"
                      : r.badge === "arima"
                        ? "bg-[var(--color-warn)]"
                        : "bg-[var(--color-text-muted)]"
                  }`}
                />
                <span className="font-mono text-sm text-[var(--color-text)]">{r.name}</span>
                {r.badge !== "external" ? (
                  <span className="rounded-sm border border-[var(--color-border-strong)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
                    reference
                  </span>
                ) : null}
              </span>
              <span className="num text-right text-[var(--color-up)]">{r.acc}</span>
              <span className="num text-right text-[var(--color-text-dim)]">{r.cal}</span>
              <span className="num text-right text-[var(--color-text-dim)]">{r.n}</span>
            </motion.div>
          ))}
        </div>
        </div>
        <div className="border-t border-[var(--color-border)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          real on-chain standings @ block 40,728,023 · live at /terminal/leaderboard
        </div>
      </div>

      <PerformanceStrip className="mt-6" />
    </section>
  );
}
