import { describe, it, expect } from "vitest";
import { runOneCategory } from "../src/run.js";
import { renderReport } from "../src/report.js";
import { buildSnapshot } from "../src/snapshot.js";

const series = Array.from({ length: 40 }, (_, i) => 320 + Math.round(10 * Math.sin(i / 4)));
const fg = series.map((_, i) => 40 + (i % 30));

describe("runOneCategory", () => {
  it("returns a CategoryResult with tuned scale, per-agent summaries, and steps", () => {
    const r = runOneCategory("METH_APR", series, fg, null);
    expect(r.metric).toBe("METH_APR");
    expect(BigInt(r.disagreeScale) > 0n).toBe(true);
    expect(r.agents.length).toBe(6); // statistical only (no deepseek cache)
    expect(r.steps.length).toBeGreaterThan(0);
    expect(r.testSteps).toBeGreaterThan(0);
  });
});

describe("renderReport + buildSnapshot", () => {
  it("report is non-empty markdown and snapshot is JSON-serializable", () => {
    const r = runOneCategory("METH_APR", series, fg, null);
    const md = renderReport([r]);
    expect(md).toContain("METH_APR");
    const snap = buildSnapshot([r], "2026-06-09T00:00:00.000Z");
    expect(() => JSON.stringify(snap)).not.toThrow();
    expect(snap.categories[0].metric).toBe("METH_APR");
  });
});
