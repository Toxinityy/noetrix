import { aggregateSwarm, confidenceFromWidth, crpsScore } from "@predictor-index/forecasters";
import type { MetricKey } from "@predictor-index/market-data";
import { metricView } from "./view.js";
import { newRep, updateRep, repCalibration, type AgentRep } from "./reputation.js";
import { classifyStress, surpriseBps, DEFAULT_STRESS, type StressThresholds } from "./stress.js";
import type { AgentSpec } from "./roster.js";
import type { AgentStep, StepResult } from "./types.js";

export interface ReplayResult {
  metric: MetricKey;
  steps: StepResult[];
  reps: Record<string, AgentRep>;
}

/// Expanding-window replay. At step t each agent forecasts from series[0..t-1] (working unit) and
/// carries reputation from steps < t (no look-ahead). The swarm aggregates contributors in
/// accuracy-rank order. Reputation is updated AFTER the step's swarm/stress are recorded.
export function replayCategory(
  metric: MetricKey,
  series: number[], // working unit
  fgAligned: (number | null)[], // F&G per index (aligned to series), or all-null
  roster: AgentSpec[],
  disagreeScale: bigint,
  minHistory = 8,
  tsList?: number[],
  stress: StressThresholds = DEFAULT_STRESS,
): ReplayResult {
  const view = metricView(metric);
  const reps: Record<string, AgentRep> = {};
  for (const a of roster) reps[a.key] = newRep();
  const steps: StepResult[] = [];

  for (let t = minHistory; t < series.length; t++) {
    const hist = series.slice(0, t);
    const realizedWorking = series[t];
    const realized = view.toDomain(realizedWorking);
    const fgAtT = fgAligned[t] ?? null;
    const fgPrev = fgAligned[t - 1] ?? null; // sentiment forecasts from data available at t-1

    const agentSteps: AgentStep[] = [];
    for (const a of roster) {
      const band = a.forecast(hist, view, fgPrev, metric, tsList ? tsList[t] : t);
      const lo = view.toDomain(Math.min(band.lower, band.upper));
      const hi = view.toDomain(Math.max(band.lower, band.upper));
      const statedBps = confidenceFromWidth(band.lower, band.upper, view.workingMin, view.workingMax);
      const score = crpsScore(lo, hi, realized, view.domainMin, view.domainMax);
      agentSteps.push({
        agentKey: a.key,
        lo,
        hi,
        statedBps,
        score,
        fitted: band.fitted,
        accBefore: reps[a.key].acc,
        calBefore: repCalibration(reps[a.key]),
      });
    }

    // Contributors = fitted agents, ranked by accuracy-before desc (tiebreak: roster order).
    const order = agentSteps
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.fitted)
      .sort((x, y) => (y.s.accBefore > x.s.accBefore ? 1 : y.s.accBefore < x.s.accBefore ? -1 : x.i - y.i))
      .map((x) => x.s);

    const swarm = aggregateSwarm(
      order.map((s) => s.lo),
      order.map((s) => s.hi),
      order.map((s) => s.statedBps),
      order.map((s) => s.calBefore),
      { domainMin: view.domainMin, domainMax: view.domainMax, disagreeScale },
    );

    const surprise = surpriseBps(realized, swarm.ensemble, view.domainMin, view.domainMax);
    const stressOut = classifyStress(swarm.disagreementBps, surprise, fgAtT, stress);

    steps.push({ t, ts: tsList ? tsList[t] : t, realized, agents: agentSteps, swarm, stress: stressOut });

    // Update reputation for the NEXT step (this step already used prior reputation).
    for (const s of agentSteps) if (s.fitted) updateRep(reps[s.agentKey], s.statedBps, s.score);
  }

  return { metric, steps, reps };
}
