import {
  WEIGHT_SCALE,
  CAL_SCALE,
  CAL_FLOOR,
  AGREE_FLOOR,
  MIN_SWARM,
  SINGLE_SOURCE_CEILING_BPS,
  MAX_CONFIDENCE_BPS,
} from "./types.js";
import { rankWeights } from "./math/rankWeights.js";
import { isqrt } from "./math/isqrt.js";

export interface SwarmParams {
  domainMin: bigint;
  domainMax: bigint;
  /// Per-category absolute spread (metric units) mapping to full disagreement (d = 1.0).
  disagreeScale: bigint;
  minSwarm?: number;
  singleSourceCeilingBps?: number;
  agreeFloor?: bigint;
}

export interface SwarmResult {
  ensemble: bigint;
  confidenceBps: number;
  disagreementBps: number;
  contributors: number;
}

function clamp(v: bigint, lo: bigint, hi: bigint): bigint {
  return v < lo ? lo : v > hi ? hi : v;
}

/// Raw swarm disagreement = midpoint scatter (isqrt of rank-weighted variance) + half the rank-weighted
/// mean band width. Pre-normalization (no disagreeScale). Exported so the backtest can tune the
/// per-category disagreeScale from the observed distribution. Bands are clamped to domain first.
export function rawDisagreement(lo: bigint[], hi: bigint[], domainMin: bigint, domainMax: bigint): bigint {
  const n = lo.length;
  if (n === 0) return 0n;
  const mid: bigint[] = [];
  const width: bigint[] = [];
  for (let i = 0; i < n; i++) {
    const a = clamp(lo[i], domainMin, domainMax);
    const b = clamp(hi[i], domainMin, domainMax);
    mid.push((a + b) / 2n);
    // Floor width at 0 for inverted bands (b < a) so dRaw can't go negative — matches the Solidity
    // uint256 path (CompositeFeed._clampAndWeigh), where an inverted band yields width 0.
    width.push(b >= a ? b - a : 0n);
  }
  const w = rankWeights(n);
  let ensemble = 0n;
  for (let i = 0; i < n; i++) ensemble += (w[i] * mid[i]) / WEIGHT_SCALE;
  let V = 0n;
  for (let i = 0; i < n; i++) {
    const dev = mid[i] - ensemble;
    V += (w[i] * (dev * dev)) / WEIGHT_SCALE;
  }
  const D = isqrt(V);
  let Wbar = 0n;
  for (let i = 0; i < n; i++) Wbar += (w[i] * width[i]) / WEIGHT_SCALE;
  return D + Wbar / 2n;
}

/// Mirror of CompositeFeed.sol._aggregate (Plan 3 implements the Solidity side to match this), in scaled-integer BigInt.
/// Contributors are passed in RANK ORDER (best first). lo/hi are the band; stated is bps; cal is the
/// agent's calibrationScore in CAL_SCALE (≤ 0). All four arrays share length n.
export function aggregateSwarm(
  lo: bigint[],
  hi: bigint[],
  stated: number[],
  cal: bigint[],
  p: SwarmParams,
): SwarmResult {
  const n = lo.length;
  if (n === 0) return { ensemble: 0n, confidenceBps: 0, disagreementBps: 0, contributors: 0 };

  const minSwarm = p.minSwarm ?? MIN_SWARM;
  const ceiling = p.singleSourceCeilingBps ?? SINGLE_SOURCE_CEILING_BPS;
  const agreeFloor = p.agreeFloor ?? AGREE_FLOOR;
  const MAX = BigInt(MAX_CONFIDENCE_BPS);

  // Clamp bands to domain; midpoints (needed for the ensemble value).
  const mid: bigint[] = [];
  for (let i = 0; i < n; i++) {
    const a = clamp(lo[i], p.domainMin, p.domainMax);
    const b = clamp(hi[i], p.domainMin, p.domainMax);
    mid.push((a + b) / 2n);
  }

  const w = rankWeights(n); // BigInt, WEIGHT_SCALE-scaled, sum ≈ WEIGHT_SCALE

  // Ensemble value + rank-weighted stated confidence in one pass.
  let ensemble = 0n;
  let weightedStated = 0n;
  for (let i = 0; i < n; i++) {
    ensemble += (w[i] * mid[i]) / WEIGHT_SCALE;
    weightedStated += w[i] * BigInt(stated[i]);
  }

  // Calibration multiplier (existing CompositeFeed derivation): mean of clipped calibrations + 1.
  let sumClipped = 0n;
  for (let i = 0; i < n; i++) {
    let c = cal[i] < CAL_FLOOR ? CAL_FLOOR : cal[i];
    if (c > 0n) c = 0n;
    sumClipped += c;
  }
  const calMult = CAL_SCALE + sumClipped / BigInt(n); // ∈ [CAL_SCALE/2, CAL_SCALE]

  // Legacy path (disagreeScale == 0): agreement + quorum disabled, fully backward-compatible.
  // MUST match CompositeFeed.aggregatePreview's disagreeScale==0 branch exactly (no agreement
  // haircut, no quorum cap, disagreement 0). Production always sets a positive per-category scale.
  if (p.disagreeScale === 0n) {
    let legacy = (weightedStated * calMult) / (WEIGHT_SCALE * CAL_SCALE);
    if (legacy > MAX) legacy = MAX;
    return { ensemble, confidenceBps: Number(legacy), disagreementBps: 0, contributors: n };
  }

  // Dispersion (midpoint scatter + half mean band width) → normalized disagreement d ∈ [0, CAL_SCALE].
  const dRaw = rawDisagreement(lo, hi, p.domainMin, p.domainMax);
  let d = (dRaw * CAL_SCALE) / p.disagreeScale;
  if (d > CAL_SCALE) d = CAL_SCALE;

  // Agreement multiplier g = max(AGREE_FLOOR, CAL_SCALE - d); combine with calibration via MIN.
  let g = CAL_SCALE - d;
  if (g < agreeFloor) g = agreeFloor;
  const mult = calMult < g ? calMult : g;

  let finalConf = (weightedStated * mult) / (WEIGHT_SCALE * CAL_SCALE);
  if (finalConf > MAX) finalConf = MAX;

  // Quorum cap: a sub-MIN_SWARM swarm cannot claim full consensus confidence.
  let confidenceBps = Number(finalConf);
  if (n < minSwarm && confidenceBps > ceiling) confidenceBps = ceiling;

  const disagreementBps = Number((d * MAX) / CAL_SCALE);
  return { ensemble, confidenceBps, disagreementBps, contributors: n };
}
