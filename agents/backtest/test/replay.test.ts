import { describe, it, expect } from "vitest";
import { replayCategory } from "../src/replay.js";
import { buildRoster } from "../src/roster.js";

const roster = buildRoster(null);
// synthetic but realistic bps series (METH-like), 30 daily points
const series = Array.from({ length: 30 }, (_, i) => 320 + Math.round(8 * Math.sin(i / 3)));
const fg = series.map(() => 50);

describe("replayCategory", () => {
  it("produces one step per forecastable point and never looks ahead", () => {
    const r = replayCategory("METH_APR", series, fg, roster, 5_000n, DEFAULT_MIN);
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.steps[0].t).toBeGreaterThanOrEqual(DEFAULT_MIN);
  });

  it("no-future-leakage: corrupting a future point does not change an earlier step's forecast", () => {
    const base = replayCategory("METH_APR", series, fg, roster, 5_000n, DEFAULT_MIN);
    const corrupted = series.slice();
    corrupted[20] = 99999; // poison a far-future point
    const after = replayCategory("METH_APR", corrupted, fg, roster, 5_000n, DEFAULT_MIN);
    const step = base.steps.find((s) => s.t === 10)!;
    const step2 = after.steps.find((s) => s.t === 10)!;
    // step at t=10 only sees series[0..9]; identical in both runs
    expect(step2.swarm.ensemble).toBe(step.swarm.ensemble);
    expect(step2.agents.map((a) => a.lo.toString())).toEqual(step.agents.map((a) => a.lo.toString()));
  });
});

const DEFAULT_MIN = 6;
