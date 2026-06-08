import { calibration } from "@predictor-index/forecasters";

const ALPHA_NUM = 1n;
const ALPHA_DEN = 10n;
const SCORE_SCALE = 1_000_000n;
const CONF_PER_BUCKET = 1000;

export interface AgentRep {
  acc: bigint; // EMA accuracy, score units [-1e6, 1e6]
  buckets: bigint[]; // 10 EMA realized-accuracy buckets [0, 1e6]
  counts: bigint[]; // 10 observation counts
}

export function newRep(): AgentRep {
  return { acc: 0n, buckets: new Array(10).fill(0n), counts: new Array(10).fill(0n) };
}

/// One resolution update, mirroring ScoringEngine._applyReputation exactly (BigInt, integer floor).
export function updateRep(rep: AgentRep, statedBps: number, score: bigint): void {
  let idx = Math.floor(statedBps / CONF_PER_BUCKET);
  if (idx > 9) idx = 9;
  if (idx < 0) idx = 0;
  const realizedScaled = (score + SCORE_SCALE) / 2n; // map [-1e6,1e6] → [0,1e6]
  rep.buckets[idx] = ((ALPHA_DEN - ALPHA_NUM) * rep.buckets[idx] + ALPHA_NUM * realizedScaled) / ALPHA_DEN;
  rep.counts[idx] += 1n;
  rep.acc = ((ALPHA_DEN - ALPHA_NUM) * rep.acc + ALPHA_NUM * score) / ALPHA_DEN;
}

/// Current calibration (delegates to the parity-tested forecasters port; 0 until 10 observations).
export function repCalibration(rep: AgentRep): bigint {
  return calibration(rep.buckets, rep.counts);
}

export function repResolved(rep: AgentRep): number {
  return rep.counts.reduce((a, b) => a + Number(b), 0);
}
