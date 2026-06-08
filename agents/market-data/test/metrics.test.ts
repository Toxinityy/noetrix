import { describe, it, expect } from "vitest";
import { METRICS } from "../src/metrics.js";

describe("metrics registry", () => {
  it("APR/APY map percent-bps to domain bigint (10000 bps = 100%)", () => {
    expect(METRICS.METH_APR.toDomain(350)).toBe(350n); // 3.5% → 350 bps
    expect(METRICS.USDY_APY.toDomain(500)).toBe(500n); // 5% → 500 bps
  });
  it("TVL maps USD to 8-dec bigint without Number precision loss", () => {
    // $92,000,000 → 92e6 * 1e8 = 9.2e15 (exceeds 2^53, must be exact via BigInt)
    expect(METRICS.AAVE_TVL.toDomain(92_000_000)).toBe(9_200_000_000_000_000n);
  });
  it("domain bounds match the on-chain categories", () => {
    expect(METRICS.METH_APR.domainMax).toBe(100_000n);
    expect(METRICS.USDY_APY.domainMax).toBe(2_000n);
    expect(METRICS.AAVE_TVL.domainMax).toBe(100_000_000_000_000_000n);
  });
});
