// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICategoryScorer} from "../interfaces/ICategoryScorer.sol";

/// @title RangeCrpsScorer
/// @notice CRPS scorer for predictions encoded as uniform[low, high] uint256 ranges within a
///         category-configured [domainMin, domainMax] split into 100 equal-width buckets.
/// @dev Math derivation:
///
///      Forecast: uniform distribution over [a, b] where a, b are bucket boundaries snapped from
///      (predLow, predHigh). Outcome: point mass at midpoint of the outcome bucket (y).
///
///      Continuous CRPS = ∫ (F(x) - H(x))² dx over the real line.
///        F = forecast CDF (linear ramp on [a, b]).
///        H = outcome CDF (step at y).
///
///      Three closed-form cases:
///        1. y < a : CRPS = (a - y) + (b - a) / 3
///        2. y > b : CRPS = (y - b) + (b - a) / 3
///        3. a <= y <= b : CRPS = ((y - a)³ + (b - y)³) / (3 (b - a)²)
///
///      Score mapping: score = clamp((1 - 2 * CRPS / D) * 1e6, -1e6, +1e6), D = domainMax - domainMin.
///
///      Implementation works in doubled coordinates (a' = 2a, b' = 2b, y' = 2y) so the outcome
///      bucket midpoint y = (yBucket + 0.5) * w + domainMin remains an integer:
///        y' = 2*domainMin + (2*yBucket + 1) * w.
///      The doubled CRPS (crps' = 2 * CRPS) reduces algebraically to:
///        Case 1/2: crps' = numerator / (3),       numerator = 3 (a' - y') + (b' - a')   [resp.]
///        Case 3:   crps' = num / (3 (b' - a')²),  num = (y' - a')³ + (b' - y')³
///      Then the deduction subtracted from SCORE_MAX is `SCALE * crps' / D` which collapses to:
///        Case 1/2: deduction = SCALE * numerator / (3 D)
///        Case 3:   deduction = SCALE * num / (3 (b' - a')² D)
contract RangeCrpsScorer is ICategoryScorer {
    uint256 private constant N = 100;
    int256 private constant SCORE_MAX = 1_000_000;
    int256 private constant SCORE_MIN = -1_000_000;
    uint256 private constant SCALE = 1_000_000;

    error InvalidDomain();

    /// @inheritdoc ICategoryScorer
    /// @dev `prediction` = abi.encode(uint256 low, uint256 high). Inverted bounds auto-swap.
    ///      `outcome`    = abi.encode(uint256 actual). Clamped to [domainMin, domainMax].
    ///      `confidence` is unused by the CRPS computation (kept for interface parity).
    ///      `categoryConfig` = abi.encode(uint256 domainMin, uint256 domainMax).
    function score(
        bytes calldata prediction,
        bytes calldata outcome,
        uint16, /* confidence */
        bytes calldata categoryConfig
    ) external pure override returns (int256) {
        (uint256 domainMin, uint256 domainMax) = abi.decode(categoryConfig, (uint256, uint256));
        if (domainMax <= domainMin) revert InvalidDomain();
        uint256 D = domainMax - domainMin;
        uint256 w = D / N;
        if (w == 0) revert InvalidDomain();

        (uint256 lowRaw, uint256 highRaw) = abi.decode(prediction, (uint256, uint256));
        if (lowRaw > highRaw) {
            (lowRaw, highRaw) = (highRaw, lowRaw);
        }
        uint256 actualRaw = abi.decode(outcome, (uint256));

        // Doubled bucket boundaries: a2 = 2 * (domainMin + bLo*w), etc.
        uint256 a2 = 2 * (domainMin + _bucketIdx(lowRaw, domainMin, domainMax, w) * w);
        uint256 b2 = 2 * (domainMin + (_bucketIdx(highRaw, domainMin, domainMax, w) + 1) * w);
        uint256 y2 = 2 * domainMin + (2 * _bucketIdx(actualRaw, domainMin, domainMax, w) + 1) * w;

        uint256 deduction = _deduction(a2, b2, y2, D);

        int256 sc;
        if (deduction >= 2 * SCALE) {
            sc = SCORE_MIN;
        } else {
            sc = SCORE_MAX - int256(deduction);
        }
        if (sc > SCORE_MAX) sc = SCORE_MAX;
        if (sc < SCORE_MIN) sc = SCORE_MIN;
        return sc;
    }

    function _deduction(uint256 a2, uint256 b2, uint256 y2, uint256 D) internal pure returns (uint256) {
        if (y2 < a2) {
            uint256 numerator = 3 * (a2 - y2) + (b2 - a2);
            return (SCALE * numerator) / (3 * D);
        }
        if (y2 > b2) {
            uint256 numerator = 3 * (y2 - b2) + (b2 - a2);
            return (SCALE * numerator) / (3 * D);
        }
        uint256 dya = y2 - a2;
        uint256 dby = b2 - y2;
        uint256 dba = b2 - a2;
        uint256 num = dya * dya * dya + dby * dby * dby;
        uint256 denom = 3 * dba * dba * D;
        return (SCALE * num) / denom;
    }

    function _bucketIdx(uint256 v, uint256 domainMin, uint256 domainMax, uint256 w)
        internal
        pure
        returns (uint256)
    {
        if (v <= domainMin) return 0;
        if (v >= domainMax) return N - 1;
        uint256 idx = (v - domainMin) / w;
        if (idx >= N) idx = N - 1;
        return idx;
    }
}
