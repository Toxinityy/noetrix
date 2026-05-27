// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {RangeCrpsScorer} from "../src/scorers/RangeCrpsScorer.sol";

/// @notice Tests RangeCrpsScorer scores against hard-coded values produced by
///         contracts/test/reference/crps_reference.py. Both implementations use integer
///         arithmetic with identical truncation order, so equality is exact.
contract RangeCrpsScorerTest is Test {
    RangeCrpsScorer internal scorer;

    uint256 internal constant DOMAIN_MIN = 0;
    uint256 internal constant DOMAIN_MAX = 10_000;

    function setUp() public {
        scorer = new RangeCrpsScorer();
    }

    function _config() internal pure returns (bytes memory) {
        return abi.encode(DOMAIN_MIN, DOMAIN_MAX);
    }

    function _pred(uint256 low, uint256 high) internal pure returns (bytes memory) {
        return abi.encode(low, high);
    }

    function _outcome(uint256 v) internal pure returns (bytes memory) {
        return abi.encode(v);
    }

    function _score(uint256 low, uint256 high, uint256 outcome) internal view returns (int256) {
        return scorer.score(_pred(low, high), _outcome(outcome), 0, _config());
    }

    // ─── Python-reference test vector (auto-generated; see crps_reference.py) ───

    function test_PythonReferenceVector_AllCasesMatch() public view {
        // Order must match CASES in crps_reference.py
        int256[10] memory expected = [
            int256(995_000),
            int256(956_667),
            int256(-976_666),
            int256(36_667),
            int256(998_334),
            int256(833_284),
            int256(994_167),
            int256(416_667),
            int256(596_667),
            int256(995_000)
        ];

        assertEq(_score(2_900, 3_100, 3_000), expected[0], "case 1: perfect_centered");
        assertEq(_score(2_900, 3_000, 3_200), expected[1], "case 2: off_by_one_high");
        assertEq(_score(0, 99, 9_999), expected[2], "case 3: single_bucket_far_above");
        assertEq(_score(5_000, 5_100, 10_000), expected[3], "case 4: outcome_at_domain_max");
        assertEq(_score(5_000, 5_000, 5_050), expected[4], "case 5: single_bucket_centered");
        assertEq(_score(0, 10_000, 5_000), expected[5], "case 6: full_domain");
        assertEq(_score(5_000, 5_100, 5_050), expected[6], "case 7: two_bucket_edge_aligned");
        assertEq(_score(2_000, 2_100, 5_000), expected[7], "case 8: below_outcome");
        assertEq(_score(7_000, 7_100, 5_000), expected[8], "case 9: above_outcome");
        assertEq(_score(5_100, 4_900, 5_000), expected[9], "case 10: inverted_bounds_swap");
    }

    // ─── Boundary cases ─────────────────────────────────────────────────────────

    function test_Boundary_PredictionFullyBelowDomain_Bounded() public view {
        // Single bucket at bottom, outcome at top: per case 3 the value is finite and well above SCORE_MIN.
        int256 s = _score(0, 0, 9_999);
        assertLe(s, int256(0), "should be negative for far miss");
        assertGe(s, int256(-1_000_000), "must not underflow below SCORE_MIN");
    }

    function test_Boundary_PredictionAtDomainEdge_Clamped() public view {
        // Predict near the top edge, outcome at the very top.
        int256 s = _score(9_800, 9_900, 10_000);
        assertGe(s, int256(0), "should be positive for near-edge match");
        assertLe(s, int256(1_000_000), "must not exceed SCORE_MAX");
    }

    function test_Boundary_OutcomeBelowDomain_ClampedToBucketZero() public view {
        // Outcome below domainMin gets clamped to bucket 0 (midpoint = 50).
        // Forecast also at bucket 0 → near-perfect score.
        int256 s = _score(0, 99, 0);
        assertGt(s, int256(990_000), "outcome clamped to bucket 0 should land near SCORE_MAX");
    }

    function test_InvalidDomain_Reverts() public {
        bytes memory badConfig = abi.encode(uint256(100), uint256(50)); // max <= min
        vm.expectRevert(RangeCrpsScorer.InvalidDomain.selector);
        scorer.score(_pred(0, 100), _outcome(50), 0, badConfig);
    }

    function test_InvalidDomain_TooNarrow_Reverts() public {
        // domainMax - domainMin = 99 < N (100) → w == 0 → revert.
        bytes memory tinyConfig = abi.encode(uint256(0), uint256(99));
        vm.expectRevert(RangeCrpsScorer.InvalidDomain.selector);
        scorer.score(_pred(0, 50), _outcome(25), 0, tinyConfig);
    }

    function test_ConfidenceIgnored() public view {
        // Same prediction with different confidence values should yield identical scores.
        int256 sLow = scorer.score(_pred(2_900, 3_100), _outcome(3_000), 0, _config());
        int256 sMid = scorer.score(_pred(2_900, 3_100), _outcome(3_000), 5_000, _config());
        int256 sHigh = scorer.score(_pred(2_900, 3_100), _outcome(3_000), 10_000, _config());
        assertEq(sLow, sMid);
        assertEq(sMid, sHigh);
    }

    function test_Score_AlwaysInBounds_Fuzz(uint256 low, uint256 high, uint256 outcome) public view {
        low = bound(low, 0, DOMAIN_MAX);
        high = bound(high, 0, DOMAIN_MAX);
        outcome = bound(outcome, 0, DOMAIN_MAX);
        int256 s = _score(low, high, outcome);
        assertLe(s, int256(1_000_000), "score above SCORE_MAX");
        assertGe(s, int256(-1_000_000), "score below SCORE_MIN");
    }
}
