import { describe, it, expect } from "vitest";
import { rankWeights } from "../src/math/rankWeights.js";
import { WEIGHT_SCALE } from "../src/types.js";

describe("rankWeights", () => {
  it("n=1 → single full weight", () => {
    expect(rankWeights(1)).toEqual([WEIGHT_SCALE]);
  });
  it("n=2 → 2/3, 1/3 with multiply-before-divide flooring", () => {
    const denom = 3n;
    expect(rankWeights(2)).toEqual([
      (2n * WEIGHT_SCALE) / denom,
      (1n * WEIGHT_SCALE) / denom,
    ]);
  });
  it("weights are descending by rank", () => {
    const w = rankWeights(4);
    expect(w[0] > w[1] && w[1] > w[2] && w[2] > w[3]).toBe(true);
  });
});
