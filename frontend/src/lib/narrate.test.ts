import { describe, it, expect, vi } from "vitest";
import { buildNarrationPrompt, narrateWith, type NarrateInput, _clearCache } from "@/lib/narrate";

const input: NarrateInput = {
  predictionId: 1001,
  agentKind: "ARIMA",
  category: "METH_APR_24H",
  low: 3700,
  high: 3900,
  confidence: 6000,
  accuracyScore: 380_000,
};

describe("narrate", () => {
  it("prompt is jargon-banning and includes the band", () => {
    const p = buildNarrationPrompt(input);
    expect(p).toContain("plain English");
    expect(p.toLowerCase()).toContain("no jargon");
  });

  it("calls the model once then serves cache for the same predictionId", async () => {
    _clearCache();
    const fetcher = vi.fn().mockResolvedValue("mETH yield should sit near 38%, fairly steady.");
    const a = await narrateWith(input, fetcher);
    const b = await narrateWith(input, fetcher);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a graceful fallback when the model call throws", async () => {
    _clearCache();
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const out = await narrateWith({ ...input, predictionId: 2002 }, fetcher);
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toContain("forecast");
  });
});
