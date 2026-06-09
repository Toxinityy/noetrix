import { describe, it, expect } from "vitest";
import { pearson, correlationMatrix } from "../src/metrics.js";

describe("pearson", () => {
  it("perfectly correlated → 1", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6);
  });
  it("perfectly anti-correlated → -1", () => {
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 6);
  });
  it("zero-variance → 0 (no NaN)", () => {
    expect(pearson([5, 5, 5], [1, 2, 3])).toBe(0);
  });
});

describe("correlationMatrix", () => {
  it("builds a symmetric matrix with 1 on the diagonal", () => {
    const m = correlationMatrix({ a: [1, 2, 3, 4], b: [1, 2, 3, 4], c: [4, 3, 2, 1] });
    expect(m.keys).toEqual(["a", "b", "c"]);
    expect(m.matrix[0][0]).toBeCloseTo(1, 6);
    expect(m.matrix[0][1]).toBeCloseTo(1, 6); // a,b identical
    expect(m.matrix[0][2]).toBeCloseTo(-1, 6); // a,c anti
    expect(m.matrix[1][0]).toBeCloseTo(m.matrix[0][1], 6); // symmetric
  });
});
