import type { CategoryResult } from "./types.js";
import { correlationMatrix } from "./metrics.js";

export interface BacktestSnapshot {
  generatedAt: string;
  categories: Array<{
    metric: string;
    disagreeScale: string;
    trainSteps: number;
    testSteps: number;
    agents: Array<{ agentKey: string; label: string; accuracy: number; calibration: number; resolved: number; meanScore: number }>;
    correlation: { keys: string[]; matrix: number[][] };
    stressTimeline: Array<{ ts: number; level: string; disagreementBps: number; surpriseBps: number; fearGreed: number | null; confidenceBps: number }>;
  }>;
}

/// Build the committed snapshot the frontend reads (BigInts serialized as strings/Numbers safely:
/// confidence/disagreement/surprise are bounded ≤10000, F&G ≤100 → safe Numbers; ensemble is omitted
/// from the timeline to avoid >2^53 TVL values, scale stays a string).
export function buildSnapshot(results: CategoryResult[], generatedAt: string): BacktestSnapshot {
  return {
    generatedAt,
    categories: results.map((r) => {
      const errByAgent: Record<string, number[]> = {};
      for (const a of r.agents) errByAgent[a.label] = [];
      for (const s of r.steps) {
        for (const ag of s.agents) {
          if (!ag.fitted) continue;
          const label = r.agents.find((x) => x.agentKey === ag.agentKey)?.label ?? ag.agentKey;
          const mid = (ag.lo + ag.hi) / 2n;
          (errByAgent[label] ||= []).push(Number(s.realized - mid));
        }
      }
      return {
        metric: r.metric,
        disagreeScale: r.disagreeScale,
        trainSteps: r.trainSteps,
        testSteps: r.testSteps,
        agents: r.agents,
        correlation: correlationMatrix(errByAgent),
        stressTimeline: r.steps.map((s) => ({
          ts: s.ts,
          level: s.stress.level,
          disagreementBps: s.swarm.disagreementBps,
          surpriseBps: s.stress.surpriseBps,
          fearGreed: s.stress.fearGreed,
          confidenceBps: s.swarm.confidenceBps,
        })),
      };
    }),
  };
}
