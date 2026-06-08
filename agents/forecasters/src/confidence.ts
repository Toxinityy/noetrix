import type { Band, Forecast } from "./types.js";

/// Confidence from band width — mirrors the reasoner's coherent rule (forecast.ts):
/// confidence = round(10000 * (1 - widthFraction)), clamped to [0, 10000].
/// A wide band cannot be high-confidence; a tight band approaches max.
export function confidenceFromWidth(
  lower: number,
  upper: number,
  domainMin: number,
  domainMax: number,
): number {
  const span = Math.max(1, domainMax - domainMin);
  const widthFrac = Math.min(1, Math.max(0, (upper - lower) / span));
  return Math.max(0, Math.min(10000, Math.round(10000 * (1 - widthFrac))));
}

/// Clamp a raw Band to the category domain and attach width-derived confidence.
export function toForecast(band: Band, domainMin: number, domainMax: number): Forecast {
  const clampedLower = Math.min(Math.max(band.lower, domainMin), domainMax);
  const clampedUpper = Math.min(Math.max(band.upper, domainMin), domainMax);
  const lower = Math.min(clampedLower, clampedUpper);
  const upper = Math.max(clampedLower, clampedUpper);
  const mean = Math.min(Math.max(band.mean, domainMin), domainMax);
  return {
    mean,
    lower,
    upper,
    fitted: band.fitted,
    confidenceBps: confidenceFromWidth(lower, upper, domainMin, domainMax),
  };
}
