import { describe, it, expect } from "vitest";
import {
  simulateMarket,
  simulateStress,
  sliderToDisagreementBps,
  sliderToFearGreed,
  riskFromConfBps,
  riskReason,
  CONF_FLOOR_BPS,
  CONF_CAUTION_BPS,
  type MarketBase,
  type StressLevel,
} from "./rwaSim";

const BASE: MarketBase = { methApyPct: 3.8, usdyApyPct: 5.0, baseConfBps: 9_000 };

describe("riskFromConfBps — mirrors RiskManager thresholds exactly", () => {
  it("flips Frozen→Caution exactly at CONF_FLOOR_BPS (4000)", () => {
    expect(riskFromConfBps(CONF_FLOOR_BPS - 1)).toBe(2); // 3999 → Frozen
    expect(riskFromConfBps(CONF_FLOOR_BPS)).toBe(1); // 4000 → Caution
  });
  it("flips Caution→Normal exactly at CONF_CAUTION_BPS (7500)", () => {
    expect(riskFromConfBps(CONF_CAUTION_BPS - 1)).toBe(1); // 7499 → Caution
    expect(riskFromConfBps(CONF_CAUTION_BPS)).toBe(0); // 7500 → Normal
  });
  it("handles the extremes", () => {
    expect(riskFromConfBps(0)).toBe(2);
    expect(riskFromConfBps(10_000)).toBe(0);
  });
});

describe("simulateMarket — allocation invariant", () => {
  it("allocation always sums to exactly 10000 across the full stress sweep", () => {
    for (let s = 0; s <= 100; s++) {
      const r = simulateMarket(s, BASE);
      expect(r.allocMethBps + r.allocUsdyBps).toBe(10_000);
      expect(r.allocMethBps).toBeGreaterThanOrEqual(0);
      expect(r.allocMethBps).toBeLessThanOrEqual(10_000);
    }
  });

  it("blended APY stays between the two asset yields", () => {
    for (let s = 0; s <= 100; s += 5) {
      const r = simulateMarket(s, BASE);
      expect(r.blendedApyPct).toBeGreaterThanOrEqual(BASE.methApyPct - 1e-9);
      expect(r.blendedApyPct).toBeLessThanOrEqual(BASE.usdyApyPct + 1e-9);
    }
  });
});

describe("simulateMarket — flight-to-safety direction", () => {
  it("calm → Normal and tilts to the higher-yield asset's confidence-weighted share", () => {
    const calm = simulateMarket(0, BASE);
    expect(calm.riskState).toBe(0); // both conf 9000 ≥ 7500
    // equal confidence → ratio is yield-driven: USDY (5.0) outweighs mETH (3.8)
    expect(calm.allocUsdyBps).toBeGreaterThan(calm.allocMethBps);
  });

  it("rising stress monotonically shifts allocation toward USDY", () => {
    let prevMeth = Infinity;
    for (let s = 0; s <= 100; s += 10) {
      const r = simulateMarket(s, BASE);
      expect(r.allocMethBps).toBeLessThanOrEqual(prevMeth + 1); // non-increasing (±round)
      prevMeth = r.allocMethBps;
    }
  });

  it("stressed extreme → Frozen (mETH conf drops below floor) and never NaN", () => {
    const stressed = simulateMarket(100, BASE);
    expect(stressed.methConfBps).toBe(9_000 - 100 * 60); // 3000, < 4000
    expect(stressed.riskState).toBe(2);
    expect(Number.isNaN(stressed.allocMethBps)).toBe(false);
    expect(Number.isNaN(stressed.blendedApyPct)).toBe(false);
  });
});

describe("simulateMarket — edge cases", () => {
  it("clamps out-of-range stress without producing NaN or invalid alloc", () => {
    for (const s of [-50, -1, 101, 1000]) {
      const r = simulateMarket(s, BASE);
      expect(r.allocMethBps + r.allocUsdyBps).toBe(10_000);
      expect(r.methConfBps).toBeGreaterThanOrEqual(0);
      expect(r.methConfBps).toBeLessThanOrEqual(10_000);
    }
  });

  it("falls back to 50/50 when both yields are zero (avoids div-by-zero)", () => {
    const r = simulateMarket(0, { methApyPct: 0, usdyApyPct: 0, baseConfBps: 9_000 });
    expect(r.allocMethBps).toBe(5_000);
    expect(r.allocUsdyBps).toBe(5_000);
  });
});

describe("riskReason — plain-English caption", () => {
  it("is empty at Normal, present otherwise", () => {
    expect(riskReason(simulateMarket(0, BASE))).toBe("");
    expect(riskReason(simulateMarket(100, BASE)).length).toBeGreaterThan(0);
  });
});

describe("simulateStress — mirrors the on-chain 3-source classification", () => {
  it("slider at 0 → Calm (neutral F&G=60, disagreementBps=0 — no threshold crossed)", () => {
    // slider=0: disagreementBps=0 (< D_MED=2000), fg=60 (> FEAR_MED=45, < GREED_EXTREME=75)
    expect(simulateStress(0)).toBe<StressLevel>("Calm");
  });

  it("slider at 50 → Stressed (disagreementBps=5000 ≥ dHigh=4000)", () => {
    // At stress=50: disagreementBps=5000 ≥ dHigh=4000 → Stressed
    expect(simulateStress(50)).toBe<StressLevel>("Stressed");
  });

  it("slider at 100 → Stressed", () => {
    expect(simulateStress(100)).toBe<StressLevel>("Stressed");
  });

  it("monotone non-decreasing: level never decreases as slider rises", () => {
    const LEVELS: StressLevel[] = ["Calm", "Elevated", "Stressed"];
    let prevOrdinal = 0;
    for (let s = 0; s <= 100; s++) {
      const level = simulateStress(s);
      const ordinal = LEVELS.indexOf(level);
      expect(ordinal).toBeGreaterThanOrEqual(prevOrdinal);
      prevOrdinal = ordinal;
    }
  });

  it("sliderToDisagreementBps is linear 0→10000", () => {
    expect(sliderToDisagreementBps(0)).toBe(0);
    expect(sliderToDisagreementBps(100)).toBe(10_000);
    expect(sliderToDisagreementBps(50)).toBe(5_000);
  });

  it("sliderToFearGreed falls from neutral (60) to extreme fear as slider rises", () => {
    const calm = sliderToFearGreed(0);
    const stressed = sliderToFearGreed(100);
    expect(calm).toBeGreaterThan(stressed);
    // Calm end should be neutral (60)
    expect(calm).toBe(60);
    // Stressed end should be in extreme fear territory (≤ 15)
    expect(stressed).toBeLessThanOrEqual(15);
  });

  it("out-of-range inputs are clamped without crashing", () => {
    expect(() => simulateStress(-10)).not.toThrow();
    expect(() => simulateStress(999)).not.toThrow();
    // Clamped results must be valid levels
    const levels: StressLevel[] = ["Calm", "Elevated", "Stressed"];
    expect(levels).toContain(simulateStress(-10));
    expect(levels).toContain(simulateStress(999));
  });
});
