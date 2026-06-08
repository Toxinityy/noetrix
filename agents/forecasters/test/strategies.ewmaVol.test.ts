import { describe, it, expect } from "vitest";
import { ewmaVol } from "../src/strategies/ewmaVol.js";

describe("ewmaVol", () => {
  it("mean tracks the EWMA level (close to recent values)", () => {
    const b = ewmaVol([50, 50, 50, 51, 50], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeGreaterThan(48);
    expect(b.mean).toBeLessThan(52);
    expect(b.fitted).toBe(true);
  });
  it("turbulent series → wider band than a calm one", () => {
    const calm = ewmaVol([50, 50, 50, 50, 50, 50], { domainMin: 0, domainMax: 100 });
    const wild = ewmaVol([50, 70, 30, 65, 35, 60], { domainMin: 0, domainMax: 100 });
    expect(wild.upper - wild.lower).toBeGreaterThan(calm.upper - calm.lower);
  });
  it("short series → unfitted", () => {
    const b = ewmaVol([3], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
  });
});
