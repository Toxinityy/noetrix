/// BigInt port of ScoringEngine._calibration — MUST match the Solidity op-for-op.
const BUCKET_COUNT = 10n;
const SCORE_SCALE_U = 1_000_000n; // 1e6
const SCORE_SCALE = 1_000_000n;

/// buckets[i] = EMA realized-accuracy for confidence bucket i (CAL_SCALE units, [0, 1e6]).
/// counts[i]  = number of resolved predictions in bucket i.
/// Returns the calibration penalty in [-1e6, 0]; 0 if total observations < 10 (cold start).
export function calibration(buckets: bigint[], counts: bigint[]): bigint {
  let total = 0n;
  for (let i = 0; i < 10; i++) total += counts[i];
  if (total < BUCKET_COUNT) return 0n;

  let sumWeightedSq = 0n;
  for (let i = 0; i < 10; i++) {
    const midpoint = BigInt(i) * 100_000n + 50_000n;
    const diff = midpoint - buckets[i];
    const sq = diff * diff;
    sumWeightedSq += sq * counts[i];
  }

  const denom = total * SCORE_SCALE_U;
  let cal = -((sumWeightedSq * 4n) / denom);
  if (cal < -SCORE_SCALE) cal = -SCORE_SCALE;
  if (cal > 0n) cal = 0n;
  return cal;
}
