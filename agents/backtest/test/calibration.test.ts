import { describe, it, expect } from "vitest";
import { buildCalibration } from "../src/calibration.js";
import type { CategoryResult } from "../src/types.js";

const cat: CategoryResult = {
  metric: "METH_APR", disagreeScale: "490", trainSteps: 100, testSteps: 40, steps: [], agents: [],
  stress: { dMed: 4612, dHigh: 7000, surpriseMed: 3, surpriseHigh: 18 },
  domainMin: "0", domainMax: "2000",
};

describe("buildCalibration", () => {
  it("maps each category to its on-chain config + global F&G thresholds", () => {
    const c = buildCalibration([cat]);
    expect(c.fearExtreme).toBe(25);
    expect(c.categories.METH_APR.disagreeScale).toBe("490");
    expect(c.categories.METH_APR.domainMax).toBe("2000");
    expect(c.categories.METH_APR.dHigh).toBe(7000);
  });
});
