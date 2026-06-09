/// Floor integer square root over BigInt (Babylonian / Newton). Returns floor(sqrt(n)).
/// Matches OpenZeppelin Math.sqrt's truncating result for parity with the on-chain swarm math.
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("isqrt: negative input");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
