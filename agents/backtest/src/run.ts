import type { MetricKey } from "@predictor-index/market-data";
import { buildRoster, type DeepSeekCache } from "./roster.js";
import { replayCategory } from "./replay.js";
import { tuneDisagreeScale, splitIndex } from "./tune.js";
import { repCalibration, repResolved } from "./reputation.js";
import { mean } from "./metrics.js";
import type { AgentSummary, CategoryResult } from "./types.js";

/// Run one category end-to-end: tune the disagreeScale on the train split, replay the full series with
/// it, and summarize per-agent accuracy/calibration/score over the TEST split.
export function runOneCategory(
  metric: MetricKey,
  series: number[],
  fgAligned: (number | null)[],
  cache: DeepSeekCache,
  trainFrac = 0.7,
  minHistory = 8,
): CategoryResult {
  const scale = tuneDisagreeScale(metric, series, fgAligned, trainFrac, minHistory);
  const roster = buildRoster(cache);
  const replay = replayCategory(metric, series, fgAligned, roster, scale, minHistory);

  const trainEnd = splitIndex(series.length, trainFrac);
  const testSteps = replay.steps.filter((s) => s.t >= trainEnd);

  const agents: AgentSummary[] = roster.map((a) => {
    const rep = replay.reps[a.key];
    const testScores = testSteps
      .map((s) => s.agents.find((x) => x.agentKey === a.key))
      .filter((x) => x && x.fitted)
      .map((x) => Number(x!.score));
    return {
      agentKey: a.key,
      label: a.label,
      accuracy: Number(rep.acc),
      calibration: Number(repCalibration(rep)),
      resolved: repResolved(rep),
      meanScore: mean(testScores),
    };
  });

  return {
    metric,
    disagreeScale: scale.toString(),
    trainSteps: replay.steps.filter((s) => s.t < trainEnd).length,
    testSteps: testSteps.length,
    steps: replay.steps,
    agents,
  };
}
