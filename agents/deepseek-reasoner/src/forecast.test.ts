import { describe, it, expect } from "vitest";
import { parseForecastText, sanitizeForecast } from "./forecast.js";

describe("parseForecastText", () => {
  it("parses summary + confidence_rationale when present", () => {
    const txt = JSON.stringify({
      predicted_value: { lower: 3700, upper: 3900 },
      confidence: 6000,
      reasoning: "calm market",
      summary: "I expect mETH yield around 37–39% — calm market.",
      confidence_rationale: "Tight band because recent days were stable.",
    });
    const p = parseForecastText(txt);
    expect(p.predicted_value.lower).toBe(3700);
    expect(p.summary).toContain("mETH");
    expect(p.confidence_rationale).toContain("stable");
  });
  it("tolerates absence of the new fields (back-compat)", () => {
    const txt = JSON.stringify({
      predicted_value: { lower: 1, upper: 2 },
      confidence: 5000,
      reasoning: "x",
    });
    const p = parseForecastText(txt);
    expect(p.summary).toBeUndefined();
    expect(p.confidence_rationale).toBeUndefined();
  });
});

describe("sanitizeForecast", () => {
  it("re-anchors a full-domain cold-start band onto the seed center + caps confidence", () => {
    // The observed failure: METH [0,100000] conf 10000 (midpoint 50000 = absurd).
    const r = sanitizeForecast(0, 100000, 10000, 0, 100000, 3000);
    const mid = (r.lower + r.upper) / 2;
    expect(mid).toBeCloseTo(3000, 0); // midpoint moved to the anchor, not domain/2
    expect(r.upper - r.lower).toBeLessThan(100000 * 0.5); // no longer uninformative
    expect(r.confidence).toBeLessThanOrEqual(5000); // fallback ⇒ not high conviction
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("leaves an informative tight band's confidence intact", () => {
    const r = sanitizeForecast(480, 520, 6000, 0, 2000, 500);
    expect(r.lower).toBe(480);
    expect(r.upper).toBe(520);
    expect(r.confidence).toBe(6000); // width 2% ⇒ coherent cap 9800 ⇒ stated 6000 kept
  });

  it("caps confidence by band width even without re-anchoring", () => {
    // 40%-of-domain band: under the re-anchor threshold but still can't be max-confidence.
    const r = sanitizeForecast(0, 800, 10000, 0, 2000, 500);
    expect(r.lower).toBe(0);
    expect(r.upper).toBe(800);
    expect(r.confidence).toBe(6000); // round(10000 × (1 − 0.4))
  });
});
