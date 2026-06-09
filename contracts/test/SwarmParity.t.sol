// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";

/// @notice Bit-parity of CompositeFeed.aggregatePreview against the committed TS golden vectors in
///         agents/forecasters/test/vectors/swarm-vectors.json. If this drifts, the on-chain feed no
///         longer matches the backtest.
contract SwarmParityTest is Test {
    CompositeFeed feed;

    function setUp() public {
        feed = new CompositeFeed(address(this));
    }

    function _u(uint256[3] memory a) internal pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    function _u16(uint16[3] memory a) internal pure returns (uint16[] memory r) {
        r = new uint16[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    function _i(int256[3] memory a) internal pure returns (int256[] memory r) {
        r = new int256[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    // Vector meth-agree-n3: domain [0,100000], disagreeScale 5000.
    // JSON: lo=[49000,49000,49000], hi=[51000,51000,51000], stated=[9800,9800,9800], cal=[0,0,0]
    // expected: ensemble=49999, confidenceBps=7841, disagreementBps=1998
    function test_Parity_MethAgreeN3() public view {
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]),
            _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9800), 9800, 9800]),
            _i([int256(0), 0, 0]),
            0, 100000, 5000
        );
        assertEq(ens, 49999, "ensemble");
        assertEq(conf, 7841, "confidence");
        assertEq(dis, 1998, "disagreementBps");
    }

    // Vector meth-scatter-n3: domain [0,100000], disagreeScale 5000.
    // JSON: lo=[10000,49000,88000], hi=[12000,51000,90000], stated=[9000,9000,9000], cal=[0,0,0]
    // expected: ensemble=36999, confidenceBps=3599, disagreementBps=10000
    function test_Parity_MethScatterN3() public view {
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(
            _u([uint256(10000), 49000, 88000]),
            _u([uint256(12000), 51000, 90000]),
            _u16([uint16(9000), 9000, 9000]),
            _i([int256(0), 0, 0]),
            0, 100000, 5000
        );
        assertEq(ens, 36999, "ensemble");
        assertEq(conf, 3599, "confidence");
        assertEq(dis, 10000, "disagreementBps");
    }

    // Vector meth-lone-n1: single agent — quorum cap, confidence <= 5000.
    // JSON: lo=[48000], hi=[52000], stated=[9600], cal=[0]
    // expected: confidenceBps=5000, disagreementBps=4000
    function test_Parity_MethLoneN1() public view {
        uint256[] memory lo = new uint256[](1); lo[0] = 48000;
        uint256[] memory hi = new uint256[](1); hi[0] = 52000;
        uint16[] memory st = new uint16[](1); st[0] = 9600;
        int256[] memory cl = new int256[](1); cl[0] = 0;
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(lo, hi, st, cl, 0, 100000, 5000);
        assertEq(ens, 50000, "ensemble");
        assertEq(conf, 5000, "confidence capped at single-source ceiling");
        assertEq(dis, 4000, "disagreementBps");
    }

    // Vector usdy-agree-n3: domain [0,2000], disagreeScale 120.
    // JSON: lo=[480,490,485], hi=[520,510,515], stated=[9000,9000,9000], cal=[0,0,0]
    // expected: ensemble=499, confidenceBps=7874, disagreementBps=1250
    function test_Parity_UsdyAgreeN3() public view {
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(
            _u([uint256(480), 490, 485]),
            _u([uint256(520), 510, 515]),
            _u16([uint16(9000), 9000, 9000]),
            _i([int256(0), 0, 0]),
            0, 2000, 120
        );
        assertEq(ens, 499, "ensemble");
        assertEq(conf, 7874, "confidence");
        assertEq(dis, 1250, "disagreementBps");
    }

    // ── Edge-case tests (Task 4) ──────────────────────────────────────────────

    function test_Empty_ReturnsZero() public view {
        uint256[] memory e = new uint256[](0);
        uint16[] memory e16 = new uint16[](0);
        int256[] memory ei = new int256[](0);
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(e, e, e16, ei, 0, 100000, 5000);
        assertEq(ens, 0); assertEq(conf, 0); assertEq(dis, 0);
    }

    function test_AntiGaming_WideBandsHighDisagreement() public view {
        // identical midpoints but full-domain bands → high disagreement + confidence haircut
        (, uint16 tightConf, uint32 tightDis) = feed.aggregatePreview(
            _u([uint256(49800), 49800, 49800]), _u([uint256(50200), 50200, 50200]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        (, uint16 wideConf, uint32 wideDis) = feed.aggregatePreview(
            _u([uint256(0), 0, 0]), _u([uint256(100000), 100000, 100000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        assertGt(wideDis, 5000);
        assertGt(wideDis, tightDis);
        assertLt(wideConf, tightConf);
    }

    function test_MinCombine_BadCalibrationHaircut() public view {
        (, uint16 goodConf,) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]), _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        (, uint16 badConf,) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]), _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(-500000), -500000, -500000]), 0, 100000, 5000);
        assertLt(badConf, goodConf);
    }

    function test_Legacy_DisagreeScaleZero_NoQuorumNoAgreement() public view {
        // disagreeScale 0 → legacy: even n=1 keeps full (calMult-only) confidence, disagreement 0
        uint256[] memory lo = new uint256[](1); lo[0] = 49000;
        uint256[] memory hi = new uint256[](1); hi[0] = 51000;
        uint16[] memory st = new uint16[](1); st[0] = 9000;
        int256[] memory cl = new int256[](1); cl[0] = 0;
        (, uint16 conf, uint32 dis) = feed.aggregatePreview(lo, hi, st, cl, 0, 100000, 0);
        assertEq(dis, 0);
        assertGt(conf, 5000, "legacy not quorum-capped");
    }

    function test_TvlDomain_NoOverflow() public view {
        (, uint16 conf,) = feed.aggregatePreview(
            _u([uint256(9_000_000_000_000_000), 9_100_000_000_000_000, 9_050_000_000_000_000]),
            _u([uint256(9_200_000_000_000_000), 9_300_000_000_000_000, 9_250_000_000_000_000]),
            _u16([uint16(8000), 8000, 8000]), _i([int256(0), 0, 0]),
            0, 100_000_000_000_000_000, 2_000_000_000_000_000);
        assertGt(conf, 0);
    }
}
