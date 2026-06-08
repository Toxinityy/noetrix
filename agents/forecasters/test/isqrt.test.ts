import { describe, it, expect } from "vitest";
import { isqrt } from "../src/math/isqrt.js";

describe("isqrt (floor integer sqrt)", () => {
  it("perfect squares", () => {
    expect(isqrt(0n)).toBe(0n);
    expect(isqrt(1n)).toBe(1n);
    expect(isqrt(144n)).toBe(12n);
    expect(isqrt(1_000_000n)).toBe(1000n);
  });
  it("non-perfect squares floor", () => {
    expect(isqrt(2n)).toBe(1n);
    expect(isqrt(15n)).toBe(3n);
    expect(isqrt(99n)).toBe(9n);
  });
  it("large values (256-bit range)", () => {
    const big = 10n ** 40n; // (1e20)^2
    expect(isqrt(big)).toBe(10n ** 20n);
  });
  it("rejects negatives", () => {
    expect(() => isqrt(-1n)).toThrow();
  });
});
