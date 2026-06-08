import type { MetricKey } from "@predictor-index/market-data";

export type StressLevel = "Calm" | "Elevated" | "Stressed";

export interface MetricView {
  metric: MetricKey;
  workingMin: number;
  workingMax: number;
  domainMin: bigint;
  domainMax: bigint;
  /// working-unit float → on-chain domain bigint
  toDomain: (working: number) => bigint;
}

/// One agent's forecast at one step (after conversion to domain units + scoring).
export interface AgentStep {
  agentKey: string;
  lo: bigint;
  hi: bigint;
  statedBps: number;
  score: bigint; // CRPS [-1e6, 1e6]
  fitted: boolean;
  /// accuracy + calibration the agent carried INTO this step (no look-ahead)
  accBefore: bigint;
  calBefore: bigint;
}

export interface SwarmOut {
  ensemble: bigint;
  confidenceBps: number;
  disagreementBps: number;
  contributors: number;
}

export interface StressOut {
  level: StressLevel;
  reasons: string[];
  surpriseBps: number;
  fearGreed: number | null;
}

export interface StepResult {
  t: number;
  ts: number;
  realized: bigint;
  agents: AgentStep[];
  swarm: SwarmOut;
  stress: StressOut;
}

export interface AgentSummary {
  agentKey: string;
  label: string;
  accuracy: number; // final EMA accuracy (score units)
  calibration: number; // final calibration [-1e6, 0]
  resolved: number;
  meanScore: number;
}

export interface CategoryResult {
  metric: MetricKey;
  disagreeScale: string; // bigint as string
  trainSteps: number;
  testSteps: number;
  steps: StepResult[];
  agents: AgentSummary[];
}
