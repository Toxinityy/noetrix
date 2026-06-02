import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";

export const MIN_RESOLVED_QUALIFIED = 10;
export const SMART_MONEY_TOP_N = 8;

export type Direction = "higher" | "lower" | "in line";
export type UncertaintyLevel = "Low" | "Medium" | "High";

export interface AgentBand {
  agentId: number;
  name: string;
  accuracyScore: number; // -1e6..1e6
  resolvedCount: number;
  low: number;
  high: number;
}

export interface SmartMoneyDivergence {
  qualifiedCount: number;
  smartMoneyValue: number | null;
  crowdValue: number | null;
  delta: number;
  deltaPct: number;
  direction: Direction;
  enoughData: boolean;
}

/** Map a signed accuracy score (-1e6..1e6) to a positive weight in ~[0.01, 1]. */
function accuracyWeight(score: number): number {
  return Math.max(0.01, score / 1_000_000 / 2 + 0.5);
}

/** Accuracy-weighted midpoint of the top-N qualified agents' bands vs the crowd composite value. */
export function smartMoneyDivergence(
  bands: AgentBand[],
  crowdValue: number | null,
): SmartMoneyDivergence {
  const qualified = bands.filter(
    (b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low,
  );
  const ranked = [...qualified]
    .sort((a, b) => b.accuracyScore - a.accuracyScore)
    .slice(0, SMART_MONEY_TOP_N);
  if (ranked.length === 0 || crowdValue == null) {
    return {
      qualifiedCount: qualified.length,
      smartMoneyValue: null,
      crowdValue,
      delta: 0,
      deltaPct: 0,
      direction: "in line",
      enoughData: false,
    };
  }
  let acc = 0;
  let wsum = 0;
  for (const b of ranked) {
    const w = accuracyWeight(b.accuracyScore);
    acc += w * ((b.low + b.high) / 2);
    wsum += w;
  }
  const smartMoneyValue = acc / wsum;
  const delta = smartMoneyValue - crowdValue;
  const deltaPct = crowdValue !== 0 ? (delta / crowdValue) * 100 : 0;
  const direction: Direction =
    Math.abs(deltaPct) < 0.5 ? "in line" : delta > 0 ? "higher" : "lower";
  return {
    qualifiedCount: qualified.length,
    smartMoneyValue,
    crowdValue,
    delta,
    deltaPct,
    direction,
    enoughData: true,
  };
}

export interface UncertaintySignal {
  level: UncertaintyLevel;
  spreadPct: number;
  enoughData: boolean;
}

/** Dispersion of qualified band midpoints, as a % of the crowd value → an uncertainty level. */
export function uncertaintyLevel(
  bands: AgentBand[],
  crowdValue: number | null,
): UncertaintySignal {
  const q = bands.filter(
    (b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low,
  );
  if (q.length === 0 || !crowdValue) {
    return { level: "Medium", spreadPct: 0, enoughData: false };
  }
  const mids = q.map((b) => (b.low + b.high) / 2);
  const spreadPct = ((Math.max(...mids) - Math.min(...mids)) / crowdValue) * 100;
  const level: UncertaintyLevel =
    spreadPct < 2 ? "Low" : spreadPct < 6 ? "Medium" : "High";
  return { level, spreadPct, enoughData: true };
}

export interface NotableMove {
  deltaPct: number;
  isNotable: boolean;
  direction: "up" | "down" | "flat";
  current: number | null;
  prior: number | null;
}

/** Compare the latest composite value to one ~lookback points earlier (≈ 24h ago). */
export function notableMove(
  history: LiveFeedPoint[],
  lookback = 16,
  thresholdPct = 1,
): NotableMove {
  if (history.length === 0) {
    return { deltaPct: 0, isNotable: false, direction: "flat", current: null, prior: null };
  }
  const current = history[history.length - 1].value;
  const prior = history[Math.max(0, history.length - 1 - lookback)].value;
  const deltaPct = prior !== 0 ? ((current - prior) / prior) * 100 : 0;
  const direction = Math.abs(deltaPct) < 0.1 ? "flat" : deltaPct > 0 ? "up" : "down";
  return { deltaPct, isNotable: Math.abs(deltaPct) >= thresholdPct, direction, current, prior };
}

/** Accuracy leaders among qualified agents (snapshot; momentum needs history → v-next). */
export function topPerformers(rows: LeaderRow[], n = 3): LeaderRow[] {
  return rows
    .filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED)
    .sort((a, b) => b.accuracyScore - a.accuracyScore)
    .slice(0, n);
}

/** Pick the most newsworthy one-line headline for the landing teaser. `categoryFriendly` is plain English. */
export function topFinding(
  div: SmartMoneyDivergence,
  move: NotableMove,
  categoryFriendly: string,
): string {
  if (move.isNotable) {
    const verb = move.direction === "up" ? "jumped" : "dropped";
    return `${categoryFriendly} ${verb} ${Math.abs(move.deltaPct).toFixed(1)}% in the last day.`;
  }
  if (div.enoughData && div.direction !== "in line") {
    return `The most accurate AIs expect ${categoryFriendly} ${div.direction} than the crowd.`;
  }
  return `AI consensus for ${categoryFriendly} is holding steady.`;
}

// ─── Proof pure functions ──────────────────────────────────────────────────

/** Signed accuracy score (-1e6..1e6) → [0,1]. */
function accNorm(score: number): number {
  return Math.min(1, Math.max(0, (score + 1_000_000) / 2_000_000));
}

export interface TopVsCrowd {
  topMean: number;
  crowdMean: number;
  pctMoreAccurate: number;
  topN: number;
  enoughData: boolean;
}

/** Mean normalized accuracy of the top-N qualified agents vs the whole qualified crowd. */
export function topVsCrowdAccuracy(rows: LeaderRow[], topN = 3): TopVsCrowd {
  const q = rows.filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED);
  if (q.length === 0) {
    return { topMean: 0, crowdMean: 0, pctMoreAccurate: 0, topN, enoughData: false };
  }
  const sorted = [...q].sort((a, b) => b.accuracyScore - a.accuracyScore);
  const top = sorted.slice(0, topN);
  const topMean = top.reduce((s, r) => s + accNorm(r.accuracyScore), 0) / top.length;
  const crowdMean = q.reduce((s, r) => s + accNorm(r.accuracyScore), 0) / q.length;
  const pctMoreAccurate = crowdMean > 0 ? ((topMean - crowdMean) / crowdMean) * 100 : 0;
  return { topMean, crowdMean, pctMoreAccurate, topN, enoughData: true };
}

export interface TrackRecordInput {
  low: number;
  high: number;
  outcome: number | null;
  status: string;
  qualified: boolean;
}
export interface TrackRecord {
  hits: number;
  total: number;
  ratePct: number;
  enoughData: boolean;
}

/** Of resolved forecasts by qualified agents, how many had the real outcome land inside the band. */
export function signalTrackRecord(preds: TrackRecordInput[]): TrackRecord {
  const r = preds.filter((p) => p.status === "Resolved" && p.qualified && p.outcome != null);
  const hits = r.filter((p) => (p.outcome as number) >= p.low && (p.outcome as number) <= p.high).length;
  return { hits, total: r.length, ratePct: r.length ? (hits / r.length) * 100 : 0, enoughData: r.length > 0 };
}

export interface Anomaly {
  block: number;
  direction: "up" | "down";
  deltaPct: number;
  from: number;
  to: number;
}

/** Scan the feed series for moves ≥ thresholdPct across a `lookback` window. Newest last. */
export function anomalyTimeline(history: LiveFeedPoint[], lookback = 16, thresholdPct = 2): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = lookback; i < history.length; i++) {
    const to = history[i].value;
    const from = history[i - lookback].value;
    if (from === 0) continue;
    const deltaPct = ((to - from) / from) * 100;
    if (Math.abs(deltaPct) >= thresholdPct) {
      out.push({ block: history[i].block, direction: deltaPct > 0 ? "up" : "down", deltaPct, from, to });
    }
  }
  return out;
}

export interface Disagreement {
  spreadPct: number;
  highAgent: AgentBand | null;
  lowAgent: AgentBand | null;
  enoughData: boolean;
}

/** The qualified agents whose band midpoints sit farthest apart, as a % of the crowd value. */
export function biggestDisagreement(bands: AgentBand[], crowdValue: number | null): Disagreement {
  const q = bands.filter((b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low);
  if (q.length < 2 || !crowdValue) {
    return { spreadPct: 0, highAgent: null, lowAgent: null, enoughData: false };
  }
  const withMid = q.map((b) => ({ b, mid: (b.low + b.high) / 2 }));
  const hi = withMid.reduce((m, x) => (x.mid > m.mid ? x : m));
  const lo = withMid.reduce((m, x) => (x.mid < m.mid ? x : m));
  const spreadPct = (Math.abs(hi.mid - lo.mid) / crowdValue) * 100;
  return { spreadPct, highAgent: hi.b, lowAgent: lo.b, enoughData: true };
}
