import { describe, it, expect } from "vitest";
import * as lib from "../src/index.js";

describe("public barrel", () => {
  it("exports the 6 strategies, swarm, scoring, confidence, and constants", () => {
    for (const name of [
      "persistence", "arima", "meanReversion", "momentum", "ewmaVol", "sentiment",
      "aggregateSwarm", "crpsScore", "calibration", "confidenceFromWidth", "toForecast",
      "isqrt", "rankWeights", "MIN_SWARM",
    ]) {
      expect(lib).toHaveProperty(name);
    }
  });
});
