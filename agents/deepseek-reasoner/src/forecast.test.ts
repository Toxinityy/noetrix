import { describe, it, expect } from "vitest";
import { parseForecastText } from "./forecast.js";

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
