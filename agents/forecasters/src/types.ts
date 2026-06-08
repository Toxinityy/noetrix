/// Scaled-integer constants shared by the swarm math + scoring ports. These MUST match
/// the on-chain values in CompositeFeed.sol / RangeCrpsScorer.sol / ScoringEngine.sol.
export const WEIGHT_SCALE = 1_000_000_000_000_000_000n; // 1e18
export const CAL_SCALE = 1_000_000n; // 1e6 (calibration / multiplier fixed-point)
export const CAL_FLOOR = -500_000n; // -0.5 in CAL_SCALE
export const MAX_CONFIDENCE_BPS = 10_000;
export const AGREE_FLOOR = 400_000n; // 0.4 in CAL_SCALE — agreement multiplier floor
export const MIN_SWARM = 3; // quorum: below this, confidence is capped (single-source)
export const SINGLE_SOURCE_CEILING_BPS = 5_000;

/// A raw forecast band on the metric level (no confidence yet).
export interface Band {
  mean: number;
  lower: number;
  upper: number;
  /// True when a real history drove the forecast; false on a degenerate/empty fallback.
  fitted: boolean;
}

/// A band plus the confidence derived from its width (bps, [0, 10000]).
export interface Forecast extends Band {
  confidenceBps: number;
}

/// Options every strategy accepts. domainMin/Max bound the metric (used for confidence + clamping).
export interface StrategyOpts {
  domainMin: number;
  domainMax: number;
  horizon?: number;
}
