import * as React from "react";

// ─── Shapes of the two committed backtest snapshots (public/*.json) ──────────
// Only the fields the summary needs are typed; both files carry more.

interface BtAgent {
  label: string;
  accuracy: number; // 0–1e6 (same scale as on-chain reputation)
}
interface BtCategory {
  metric: string;
  testSteps: number;
  agents: BtAgent[];
}
export interface BacktestSnapshot {
  generatedAt: string;
  categories: BtCategory[];
}

interface StratStrategy {
  key: string;
  label: string;
  final: number; // fractional total return (−0.092 = −9.2%)
}
export interface StrategySnapshot {
  generatedAt: string;
  windowDays: number;
  strategies: StratStrategy[];
  reading: string;
}

// ─── Derived headline summary — the single source the hero + link strips read ─

export interface PerfSummary {
  /** Flagship accuracy stat (mETH APR — largest test sample). */
  accuracy: { metric: string; testN: number; lo: number; hi: number };
  /** Per-metric accuracy winner — shows no single strategy wins everywhere. */
  winners: { metric: string; winner: string; acc: number }[];
  /** Ensemble-edge stat from the total-return backtest. */
  ensemble: {
    final: number;
    bestSingle: number;
    bestSingleLabel: string;
    holdMeth: number;
    windowDays: number;
  };
  reading: string;
}

export function friendlyMetric(metric: string): string {
  if (metric === "METH_APR") return "mETH APR";
  if (metric === "AAVE_TVL") return "Aave-Mantle TVL";
  if (metric === "USDY_APY") return "USDY APY";
  return metric;
}

/** 0–1e6 reputation score → 0–100 human scale. */
const toHuman = (acc: number) => acc / 1e4;

const finalOf = (s: StrategySnapshot, key: string) =>
  s.strategies.find((x) => x.key === key)?.final ?? 0;

/**
 * Fold the two snapshots into the headline numbers. Pure — the hero and both
 * link strips consume this so every surface shows the same figures.
 */
export function performanceSummary(bt: BacktestSnapshot, st: StrategySnapshot): PerfSummary {
  const flagship = bt.categories.find((c) => c.metric === "METH_APR") ?? bt.categories[0];
  const accs = (flagship?.agents ?? []).map((a) => toHuman(a.accuracy));
  const accuracy = {
    metric: friendlyMetric(flagship?.metric ?? "METH_APR"),
    testN: flagship?.testSteps ?? 0,
    lo: accs.length ? Math.min(...accs) : 0,
    hi: accs.length ? Math.max(...accs) : 0,
  };

  const winners = bt.categories.map((c) => {
    const top = c.agents.reduce((best, a) => (a.accuracy > best.accuracy ? a : best), c.agents[0]);
    return { metric: friendlyMetric(c.metric), winner: top?.label ?? "—", acc: toHuman(top?.accuracy ?? 0) };
  });

  const best = st.strategies.find((s) => s.key === "bestAgent");
  const ensemble = {
    final: finalOf(st, "ensemble"),
    bestSingle: best?.final ?? 0,
    bestSingleLabel: best?.label ?? "best single agent",
    holdMeth: finalOf(st, "allMeth"),
    windowDays: st.windowDays,
  };

  return { accuracy, winners, ensemble, reading: st.reading };
}

/** Fetch both committed snapshots and fold them; null until loaded, `failed` on error. */
export function usePerformanceSummary(): { summary: PerfSummary | null; failed: boolean } {
  const [summary, setSummary] = React.useState<PerfSummary | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/backtest-snapshot.json").then((r) => {
        if (!r.ok) throw new Error(`backtest ${r.status}`);
        return r.json() as Promise<BacktestSnapshot>;
      }),
      fetch("/strategy-backtest-snapshot.json").then((r) => {
        if (!r.ok) throw new Error(`strategy ${r.status}`);
        return r.json() as Promise<StrategySnapshot>;
      }),
    ])
      .then(([bt, st]) => {
        if (!cancelled) setSummary(performanceSummary(bt, st));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, failed };
}
