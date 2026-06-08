/// APR/APY percent → basis points, matching the on-chain convention (10000 bps = 100%).
export function apyPctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/// Derive a mETH/ETH exchange-rate series (1e18-scaled BigInt) from a daily apy% series, so that
/// MethAprResolver's 24h-slope formula reproduces the daily apy. rate_t = rate_{t-1}·(1 + apy_t/100/365).
/// Used by the Plan 4 oracle seeder; kept here so the derivation lives with the data layer.
export function deriveMethRateSeries(
  apyPct: number[],
  base = 1_000_000_000_000_000_000n,
): bigint[] {
  const out: bigint[] = [];
  let rate = base;
  for (const apy of apyPct) {
    // daily growth in parts-per-billion of the rate
    const dailyPpb = BigInt(Math.round((apy / 100 / 365) * 1_000_000_000));
    rate = rate + (rate * dailyPpb) / 1_000_000_000n;
    out.push(rate);
  }
  return out;
}
