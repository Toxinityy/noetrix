export const FORECASTERS_VERSION = "0.1.0";

export * from "./types.js";
export * from "./confidence.js";
export * from "./math/isqrt.js";
export * from "./math/rankWeights.js";
export * from "./swarm.js";
export * from "./scoring/crps.js";
export * from "./scoring/calibration.js";

export { persistence } from "./strategies/persistence.js";
export { arima } from "./strategies/arima.js";
export { meanReversion } from "./strategies/meanReversion.js";
export { momentum } from "./strategies/momentum.js";
export { ewmaVol } from "./strategies/ewmaVol.js";
export { sentiment } from "./strategies/sentiment.js";
