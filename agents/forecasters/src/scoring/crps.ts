/// BigInt port of RangeCrpsScorer.sol — MUST match the Solidity op-for-op.
const N = 100n;
const SCORE_MAX = 1_000_000n;
const SCORE_MIN = -1_000_000n;
const SCALE = 1_000_000n;

function bucketIdx(v: bigint, domainMin: bigint, domainMax: bigint, w: bigint): bigint {
  if (v <= domainMin) return 0n;
  if (v >= domainMax) return N - 1n;
  let idx = (v - domainMin) / w;
  if (idx >= N) idx = N - 1n;
  return idx;
}

function deduction(a2: bigint, b2: bigint, y2: bigint, D: bigint): bigint {
  if (y2 < a2) {
    const numerator = 3n * (a2 - y2) + (b2 - a2);
    return (SCALE * numerator) / (3n * D);
  }
  if (y2 > b2) {
    const numerator = 3n * (y2 - b2) + (b2 - a2);
    return (SCALE * numerator) / (3n * D);
  }
  const dya = y2 - a2;
  const dby = b2 - y2;
  const dba = b2 - a2;
  const num = dya * dya * dya + dby * dby * dby;
  const denom = 3n * dba * dba * D;
  return (SCALE * num) / denom;
}

/// Returns the CRPS score in [-1e6, +1e6] for a uniform[low,high] band vs a point outcome,
/// over [domainMin, domainMax] split into 100 buckets. Mirrors RangeCrpsScorer.score.
export function crpsScore(
  lowRaw: bigint,
  highRaw: bigint,
  actualRaw: bigint,
  domainMin: bigint,
  domainMax: bigint,
): bigint {
  if (domainMax <= domainMin) throw new Error("crps: invalid domain");
  const D = domainMax - domainMin;
  const w = D / N;
  if (w === 0n) throw new Error("crps: zero bucket width");

  let lo = lowRaw;
  let hi = highRaw;
  if (lo > hi) {
    const t = lo;
    lo = hi;
    hi = t;
  }

  const a2 = 2n * (domainMin + bucketIdx(lo, domainMin, domainMax, w) * w);
  const b2 = 2n * (domainMin + (bucketIdx(hi, domainMin, domainMax, w) + 1n) * w);
  const y2 = 2n * domainMin + (2n * bucketIdx(actualRaw, domainMin, domainMax, w) + 1n) * w;

  const ded = deduction(a2, b2, y2, D);
  let sc: bigint;
  if (ded >= 2n * SCALE) sc = SCORE_MIN;
  else sc = SCORE_MAX - ded;
  if (sc > SCORE_MAX) sc = SCORE_MAX;
  if (sc < SCORE_MIN) sc = SCORE_MIN;
  return sc;
}
