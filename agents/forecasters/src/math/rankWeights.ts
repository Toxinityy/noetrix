import { WEIGHT_SCALE } from "../types.js";

/// Linear decreasing rank weights, scaled by WEIGHT_SCALE, summing to ~WEIGHT_SCALE.
/// Mirrors CompositeFeed.sol: wScaled_j = ((n - j) * WEIGHT_SCALE) / (n(n+1)/2).
/// Multiply-before-divide, integer floor — must match Solidity exactly.
export function rankWeights(n: number, scale: bigint = WEIGHT_SCALE): bigint[] {
  if (n <= 0) return [];
  const denom = BigInt((n * (n + 1)) / 2);
  const out: bigint[] = [];
  for (let j = 0; j < n; j++) {
    out.push((BigInt(n - j) * scale) / denom);
  }
  return out;
}
