import { describe, it, expect } from "vitest";
import { metricView } from "../src/view.js";

describe("metricView", () => {
  it("bps metric: working domain equals on-chain domain", () => {
    const v = metricView("METH_APR");
    expect(v.workingMin).toBe(0);
    expect(v.workingMax).toBe(2_000);
    expect(v.toDomain(350)).toBe(350n);
  });
  it("USD TVL metric: working max is the on-chain max divided by 1e8 (stays a safe Number)", () => {
    const v = metricView("AAVE_TVL");
    expect(v.workingMax).toBe(1_000_000_000); // 1e17 / 1e8 = $1B
    expect(v.toDomain(92_000_000)).toBe(9_200_000_000_000_000n);
  });
});
