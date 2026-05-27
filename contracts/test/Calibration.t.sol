// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ScoringEngine} from "../src/ScoringEngine.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

/// @notice Tests ScoringEngine.computeCalibration (the pure §7.4.2 formula) against the
///         hard-coded values produced by contracts/test/reference/calibration_reference.py.
///         Both implementations use integer arithmetic with identical order, so equality is exact.
contract CalibrationTest is Test {
    ScoringEngine internal scoring;

    function setUp() public {
        // computeCalibration is pure — dummy non-zero addresses satisfy the zero-check constructor.
        scoring = new ScoringEngine(
            address(this), IPredictionMarket(address(0x1111)), IAgentRegistry(address(0x2222))
        );
    }

    function _calibration(int256[10] memory buckets, uint256[10] memory counts) internal view returns (int256) {
        return scoring.computeCalibration(buckets, counts);
    }

    function _zeros() internal pure returns (int256[10] memory acc, uint256[10] memory cnt) {
        // all-zero arrays
    }

    function _singleBucket5(int256 accVal, uint256 cntVal)
        internal
        pure
        returns (int256[10] memory acc, uint256[10] memory cnt)
    {
        acc[5] = accVal;
        cnt[5] = cntVal;
    }

    function test_PythonReferenceVector_AllCasesMatch() public view {
        // Order must match CASES in calibration_reference.py
        int256[10] memory expected = [
            int256(0),
            int256(0),
            int256(-10_000),
            int256(-10_000),
            int256(0),
            int256(-1_000_000),
            int256(-1_000_000),
            int256(-3_275),
            int256(-1_000_000),
            int256(-1_000_000)
        ];

        // 1: cold_start
        {
            (int256[10] memory acc, uint256[10] memory cnt) = _zeros();
            assertEq(_calibration(acc, cnt), expected[0], "case 1: cold_start");
        }
        // 2: one_resolution_below_min
        {
            (int256[10] memory acc, uint256[10] memory cnt) = _singleBucket5(500_000, 1);
            assertEq(_calibration(acc, cnt), expected[1], "case 2: one_resolution_below_min");
        }
        // 3: ten_resolutions_bucket5_perfect
        {
            (int256[10] memory acc, uint256[10] memory cnt) = _singleBucket5(500_000, 10);
            assertEq(_calibration(acc, cnt), expected[2], "case 3: ten_resolutions_bucket5_perfect");
        }
        // 4: hundred_resolutions_bucket5_perfect
        {
            (int256[10] memory acc, uint256[10] memory cnt) = _singleBucket5(500_000, 100);
            assertEq(_calibration(acc, cnt), expected[3], "case 4: hundred_resolutions_bucket5_perfect");
        }
        // 5: perfectly_calibrated
        {
            int256[10] memory acc;
            uint256[10] memory cnt;
            for (uint256 i = 0; i < 10; ++i) {
                acc[i] = int256(i * 100_000 + 50_000);
                cnt[i] = 10;
            }
            assertEq(_calibration(acc, cnt), expected[4], "case 5: perfectly_calibrated");
        }
        // 6: overconfident
        {
            int256[10] memory acc = [
                int256(50_000), int256(150_000), int256(250_000), int256(350_000), int256(450_000),
                int256(200_000), int256(200_000), int256(200_000), int256(200_000), int256(200_000)
            ];
            uint256[10] memory cnt = [uint256(2), 2, 2, 2, 2, 10, 10, 10, 10, 10];
            assertEq(_calibration(acc, cnt), expected[5], "case 6: overconfident");
        }
        // 7: underconfident
        {
            int256[10] memory acc = [
                int256(800_000), int256(800_000), int256(800_000), int256(800_000), int256(800_000),
                int256(550_000), int256(650_000), int256(750_000), int256(850_000), int256(950_000)
            ];
            uint256[10] memory cnt = [uint256(10), 10, 10, 10, 10, 2, 2, 2, 2, 2];
            assertEq(_calibration(acc, cnt), expected[6], "case 7: underconfident");
        }
        // 8: mixed_realistic
        {
            int256[10] memory acc = [
                int256(40_000), int256(140_000), int256(220_000), int256(300_000), int256(420_000),
                int256(550_000), int256(680_000), int256(770_000), int256(880_000), int256(920_000)
            ];
            uint256[10] memory cnt = [uint256(5), 8, 12, 15, 18, 20, 15, 10, 8, 5];
            assertEq(_calibration(acc, cnt), expected[7], "case 8: mixed_realistic");
        }
        // 9: max_miscal_bucket0_high_acc
        {
            int256[10] memory acc;
            uint256[10] memory cnt;
            acc[0] = 950_000;
            cnt[0] = 100;
            assertEq(_calibration(acc, cnt), expected[8], "case 9: max_miscal_bucket0");
        }
        // 10: max_miscal_bucket9_low_acc
        {
            int256[10] memory acc;
            uint256[10] memory cnt;
            acc[9] = 50_000;
            cnt[9] = 100;
            assertEq(_calibration(acc, cnt), expected[9], "case 10: max_miscal_bucket9");
        }
    }

    function test_ColdStart_ReturnsZero() public view {
        int256[10] memory acc;
        uint256[10] memory cnt;
        assertEq(_calibration(acc, cnt), int256(0));
    }

    function test_BelowThreshold_ReturnsZero() public view {
        // total = 9 < 10 → return 0 even with strong miscalibration
        int256[10] memory acc;
        uint256[10] memory cnt;
        acc[9] = 0; // worst miscal for bucket 9 (midpoint 950k)
        cnt[9] = 9;
        assertEq(_calibration(acc, cnt), int256(0));
    }

    function test_AtThreshold_BecomesNonzero() public view {
        // total = 10 → cold-start exits, value should be < 0 for miscalibrated state
        int256[10] memory acc;
        uint256[10] memory cnt;
        acc[9] = 0;
        cnt[9] = 10;
        int256 cal = _calibration(acc, cnt);
        assertLt(cal, int256(0), "should be negative once threshold reached");
        // diff = 950_000 - 0 = 950_000; sq = 9.025e11; *count(10)*4 = 3.61e13; /(10*1e6) = 3.61e6 → clamp to -1e6
        assertEq(cal, int256(-1_000_000));
    }

    function test_Bounds_NeverPositive_Fuzz(uint256 seed) public view {
        int256[10] memory acc;
        uint256[10] memory cnt;
        // Seed-driven moderate fuzz
        for (uint256 i = 0; i < 10; ++i) {
            acc[i] = int256(uint256(keccak256(abi.encode(seed, i))) % 1_000_001);
            cnt[i] = (uint256(keccak256(abi.encode(seed, i, "c"))) % 50) + 1;
        }
        int256 cal = _calibration(acc, cnt);
        assertLe(cal, int256(0), "calibration must never be positive");
        assertGe(cal, int256(-1_000_000), "calibration clamps at -1e6");
    }
}
