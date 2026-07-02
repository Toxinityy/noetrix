import { describe, it, expect } from "vitest";
import { performanceSummary, type BacktestSnapshot, type StrategySnapshot } from "./performance";
import realBacktest from "../../public/backtest-snapshot.json";
import realStrategy from "../../public/strategy-backtest-snapshot.json";

// Synthetic fixture — deterministic, tests the folding logic independent of the real numbers.
const bt: BacktestSnapshot = {
  generatedAt: "2026-07-03",
  categories: [
    {
      metric: "METH_APR",
      testSteps: 272,
      agents: [
        { label: "Naive", accuracy: 943_000 },
        { label: "EWMA-Vol", accuracy: 960_000 }, // winner
        { label: "ARIMA", accuracy: 952_000 },
      ],
    },
    {
      metric: "AAVE_TVL",
      testSteps: 34,
      agents: [
        { label: "Naive", accuracy: 986_000 }, // winner
        { label: "EWMA-Vol", accuracy: 913_000 },
      ],
    },
  ],
};
const st: StrategySnapshot = {
  generatedAt: "2026-07-03",
  windowDays: 154,
  reading: "the ensemble de-risks as agents disagree.",
  strategies: [
    { key: "ensemble", label: "Noetrix Ensemble", final: -0.092 },
    { key: "bestAgent", label: "Best single (EWMA-Vol)", final: -0.376 },
    { key: "allMeth", label: "100% mETH", final: -0.442 },
  ],
};

describe("performanceSummary", () => {
  const s = performanceSummary(bt, st);

  it("flags the mETH accuracy spread from the largest test sample", () => {
    expect(s.accuracy.metric).toBe("mETH APR");
    expect(s.accuracy.testN).toBe(272);
    expect(s.accuracy.lo).toBeCloseTo(94.3, 1);
    expect(s.accuracy.hi).toBeCloseTo(96.0, 1);
  });

  it("names the per-metric winner (no single strategy wins everywhere)", () => {
    expect(s.winners.map((w) => w.winner)).toEqual(["EWMA-Vol", "Naive"]);
  });

  it("computes the ensemble edge", () => {
    expect(s.ensemble.final).toBeCloseTo(-0.092, 3);
    expect(s.ensemble.bestSingle).toBeCloseTo(-0.376, 3);
    expect(s.ensemble.holdMeth).toBeCloseTo(-0.442, 3);
    expect(s.ensemble.windowDays).toBe(154);
    // The headline claim: the ensemble beat the best single agent.
    expect(s.ensemble.final).toBeGreaterThan(s.ensemble.bestSingle);
  });
});

describe("performanceSummary on the real committed snapshots (shape smoke)", () => {
  const s = performanceSummary(realBacktest as BacktestSnapshot, realStrategy as StrategySnapshot);
  it("reads valid ranges from the real files", () => {
    expect(s.accuracy.testN).toBeGreaterThan(0);
    expect(s.accuracy.lo).toBeGreaterThanOrEqual(0);
    expect(s.accuracy.hi).toBeLessThanOrEqual(100);
    expect(s.accuracy.lo).toBeLessThanOrEqual(s.accuracy.hi);
    expect(s.winners.length).toBe((realBacktest as BacktestSnapshot).categories.length);
    expect(Number.isFinite(s.ensemble.final)).toBe(true);
    expect(s.reading.length).toBeGreaterThan(0);
  });
});
