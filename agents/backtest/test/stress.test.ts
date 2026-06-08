import { describe, it, expect } from "vitest";
import { classifyStress, surpriseBps, DEFAULT_STRESS } from "../src/stress.js";
import { alignByDay } from "../src/align.js";

describe("surpriseBps", () => {
  it("normalizes |realized - ensemble| to bps of the domain width", () => {
    // domain 100000, gap 5000 → 500 bps
    expect(surpriseBps(55_000n, 50_000n, 0n, 100_000n)).toBe(500);
  });
});

describe("classifyStress", () => {
  it("calm when all signals are benign", () => {
    const s = classifyStress(100, 50, 50, DEFAULT_STRESS);
    expect(s.level).toBe("Calm");
  });
  it("stressed on extreme fear regardless of model agreement", () => {
    const s = classifyStress(100, 50, 10, DEFAULT_STRESS); // fg=10 extreme fear
    expect(s.level).toBe("Stressed");
    expect(s.reasons).toContain("extreme-fear");
  });
  it("stressed on high disagreement", () => {
    const s = classifyStress(9000, 50, 50, DEFAULT_STRESS);
    expect(s.level).toBe("Stressed");
  });
  it("elevated on moderate surprise", () => {
    const s = classifyStress(100, 800, 50, DEFAULT_STRESS);
    expect(s.level).toBe("Elevated");
  });
});

describe("alignByDay", () => {
  it("maps a value series to a reference timestamp series by UTC day", () => {
    const ref = [{ ts: 86_400, value: 1 }, { ts: 172_800, value: 2 }];
    const other = [{ ts: 86_400, value: 40 }, { ts: 172_800, value: 60 }];
    expect(alignByDay(ref, other)).toEqual([40, 60]);
  });
  it("fills missing days with null", () => {
    const ref = [{ ts: 86_400, value: 1 }, { ts: 172_800, value: 2 }];
    const other = [{ ts: 86_400, value: 40 }];
    expect(alignByDay(ref, other)).toEqual([40, null]);
  });
});
