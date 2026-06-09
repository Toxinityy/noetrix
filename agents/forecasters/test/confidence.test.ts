import { describe, it, expect } from "vitest";
import { confidenceFromWidth, toForecast } from "../src/confidence.js";

describe("confidenceFromWidth", () => {
  it("tight band → high confidence (mirrors reasoner coherent rule)", () => {
    // width 4000 over span 100000 → widthFrac 0.04 → round(10000*0.96)=9600
    expect(confidenceFromWidth(48000, 52000, 0, 100000)).toBe(9600);
  });
  it("full-domain band → 0 confidence", () => {
    expect(confidenceFromWidth(0, 100000, 0, 100000)).toBe(0);
  });
  it("zero-width band → max confidence", () => {
    expect(confidenceFromWidth(500, 500, 0, 2000)).toBe(10000);
  });
});

describe("toForecast", () => {
  it("clamps band to domain and derives confidence", () => {
    const f = toForecast({ mean: 50, lower: -10, upper: 120, fitted: true }, 0, 100);
    expect(f.lower).toBe(0);
    expect(f.upper).toBe(100);
    expect(f.confidenceBps).toBe(0); // full-domain after clamp
    expect(f.fitted).toBe(true);
  });
});
