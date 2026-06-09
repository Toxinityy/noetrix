import type { StressOut } from "./types.js";

export interface StressThresholds {
  dHigh: number;
  dMed: number;
  surpriseHigh: number;
  surpriseMed: number;
  fearExtreme: number;
  fearMed: number;
  greedExtreme: number;
}

/// Default thresholds (bps for disagreement/surprise, 0–100 for F&G). Tunable per spec §4.
export const DEFAULT_STRESS: StressThresholds = {
  dHigh: 4000,
  dMed: 2000,
  surpriseHigh: 1500,
  surpriseMed: 600,
  fearExtreme: 25,
  fearMed: 45,
  greedExtreme: 75,
};

/// Model-independent forecast surprise: |realized - ensemble| as bps of the domain width.
export function surpriseBps(realized: bigint, ensemble: bigint, domainMin: bigint, domainMax: bigint): number {
  const width = domainMax - domainMin;
  if (width <= 0n) return 0;
  const gap = realized > ensemble ? realized - ensemble : ensemble - realized;
  return Number((gap * 10_000n) / width);
}

/// 3-source stress: ensemble disagreement (model consensus) + forecast surprise (model-independent) +
/// Fear & Greed (external market sentiment). Off-chain mirror of MarketStressMonitor (Plan 4).
export function classifyStress(
  disagreementBps: number,
  surprise: number,
  fg: number | null,
  th: StressThresholds,
): StressOut {
  const reasons: string[] = [];
  let stressed = false;
  let elevated = false;

  if (disagreementBps >= th.dHigh) { stressed = true; reasons.push("disagreement-high"); }
  else if (disagreementBps >= th.dMed) { elevated = true; reasons.push("disagreement-med"); }

  if (surprise >= th.surpriseHigh) { stressed = true; reasons.push("surprise-high"); }
  else if (surprise >= th.surpriseMed) { elevated = true; reasons.push("surprise-med"); }

  if (fg !== null) {
    if (fg <= th.fearExtreme) { stressed = true; reasons.push("extreme-fear"); }
    else if (fg <= th.fearMed) { elevated = true; reasons.push("fear"); }
    else if (fg >= th.greedExtreme) { elevated = true; reasons.push("greed"); }
  }

  const level = stressed ? "Stressed" : elevated ? "Elevated" : "Calm";
  return { level, reasons, surpriseBps: surprise, fearGreed: fg };
}

/// p-th percentile (nearest-rank) of a number list. Empty → 0.
export function percentileNum(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const b = xs.slice().sort((a, c) => a - c);
  return b[Math.min(b.length - 1, Math.max(0, Math.ceil((p / 100) * b.length) - 1))];
}

/// Tune disagreement + surprise thresholds from the TRAIN distribution so the stress signal is
/// DIFFERENTIAL ("unusually high vs this category's normal"), making Calm reachable. Fear & Greed
/// stays absolute (extreme fear is a real stress condition regardless of history).
export function tuneStressThresholds(
  trainDisagreement: number[],
  trainSurprise: number[],
  pctMed = 70,
  pctHigh = 90,
): StressThresholds {
  return {
    dMed: percentileNum(trainDisagreement, pctMed),
    dHigh: percentileNum(trainDisagreement, pctHigh),
    surpriseMed: percentileNum(trainSurprise, pctMed),
    surpriseHigh: percentileNum(trainSurprise, pctHigh),
    fearExtreme: 25,
    fearMed: 45,
    greedExtreme: 75,
  };
}
