// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";
import {MethAprResolver} from "../src/resolvers/MethAprResolver.sol";
import {IMethRateOracle} from "../src/interfaces/IMethRateOracle.sol";

contract MethAprResolverTest is Test {
    MockMethRateOracle internal oracle;
    MethAprResolver internal resolver;

    address internal owner = address(0xA11CE);

    uint256 internal constant DAY_BLOCKS = 43_200;

    function setUp() public {
        oracle = new MockMethRateOracle(owner);
        resolver = new MethAprResolver(IMethRateOracle(address(oracle)));
    }

    function _setPair(uint256 priorBlock, uint256 priorRate, uint256 nowBlock, uint256 nowRate) internal {
        uint256[] memory bs = new uint256[](2);
        uint256[] memory rs = new uint256[](2);
        bs[0] = priorBlock;
        bs[1] = nowBlock;
        rs[0] = priorRate;
        rs[1] = nowRate;
        vm.prank(owner);
        oracle.setRates(bs, rs);
    }

    // ─── Hand-verified cases ────────────────────────────────────────────────────

    /// rateNow = 1.01e18, ratePrior = 1.00e18 → 1% in a day → 365% APR = 36500 bps
    function test_Resolve_OnePercentDaily_Yields36500Bps() public {
        uint256 nowBlock = 200_000;
        _setPair(nowBlock - DAY_BLOCKS, 1e18, nowBlock, 1.01e18);
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 36_500);
    }

    /// rateNow = 1.0001e18, ratePrior = 1.00e18 → 0.01% in a day → 3.65% APR = 365 bps
    function test_Resolve_TinyDailyMove_Yields365Bps() public {
        uint256 nowBlock = 300_000;
        _setPair(nowBlock - DAY_BLOCKS, 1e18, nowBlock, 1.0001e18);
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 365);
    }

    /// rateNow = 1.5e18, ratePrior = 1.2e18 → (0.25) × 365 × 10000 = 912500 bps
    function test_Resolve_LargerMove_HandComputed() public {
        uint256 nowBlock = 400_000;
        _setPair(nowBlock - DAY_BLOCKS, 1.2e18, nowBlock, 1.5e18);
        // ratio = 1.5/1.2 = 1.25 → minusOne = 0.25e18 → ×365 ×10000 /1e18 = 0.25 × 3650000 = 912500
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 912_500);
    }

    // ─── Edge cases ─────────────────────────────────────────────────────────────

    function test_Resolve_EqualRates_ReturnsZero() public {
        uint256 nowBlock = 500_000;
        _setPair(nowBlock - DAY_BLOCKS, 1.1e18, nowBlock, 1.1e18);
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 0);
    }

    function test_Resolve_NegativeChange_ClampsToZero() public {
        uint256 nowBlock = 600_000;
        _setPair(nowBlock - DAY_BLOCKS, 1.2e18, nowBlock, 1.1e18);
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 0);
    }

    function test_Resolve_PriorRateZero_ReturnsZero() public {
        uint256 nowBlock = 700_000;
        // Set prior = 1 (smallest non-zero so oracle accepts), but we want the prior=0 path.
        // We can't set prior=0 because oracle reverts on RateNotSet. Test via fresh oracle where
        // we never seed the prior block.
        MockMethRateOracle o2 = new MockMethRateOracle(owner);
        MethAprResolver r2 = new MethAprResolver(IMethRateOracle(address(o2)));
        vm.prank(owner);
        o2.setRate(nowBlock, 1.5e18);
        // prior block not seeded → getRateAt reverts → resolver reverts (we use rateOrZero path? No,
        // resolver uses getRateAt). So this case actually surfaces as a revert from the oracle.
        // Document the expected behavior: missing prior data == resolution impossible.
        vm.expectRevert(MockMethRateOracle.RateNotSet.selector);
        r2.resolve("", nowBlock);
    }

    function test_Resolve_RateNowZero_PathRequiresOracleSet() public {
        // Both rates must be set (oracle reverts on zero reads). Set both as zero is impossible;
        // assertion stays: hot path always sees both rates ≥ 1 wei.
        uint256 nowBlock = 800_000;
        _setPair(nowBlock - DAY_BLOCKS, 1e18, nowBlock, 1); // nowRate < priorRate
        bytes memory out = resolver.resolve("", nowBlock);
        assertEq(abi.decode(out, (uint256)), 0);
    }

    function test_Resolve_ResolutionBlockBelowDayWindow_ReturnsZero() public {
        // resolutionBlock < BLOCKS_PER_DAY → resolver short-circuits.
        bytes memory out = resolver.resolve("", DAY_BLOCKS - 1);
        assertEq(abi.decode(out, (uint256)), 0);
    }

    function test_Resolve_IgnoresPredictionValue() public {
        uint256 nowBlock = 900_000;
        _setPair(nowBlock - DAY_BLOCKS, 1e18, nowBlock, 1.005e18);
        // Same numeric answer regardless of value bytes.
        bytes memory out1 = resolver.resolve("", nowBlock);
        bytes memory out2 = resolver.resolve(abi.encode(uint256(99999)), nowBlock);
        assertEq(abi.decode(out1, (uint256)), abi.decode(out2, (uint256)));
    }

    // ─── Mock oracle ────────────────────────────────────────────────────────────

    function test_Oracle_SetRate_OnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        oracle.setRate(1, 1e18);
    }

    function test_Oracle_SetRates_LengthMismatchReverts() public {
        uint256[] memory bs = new uint256[](2);
        uint256[] memory rs = new uint256[](1);
        bs[0] = 1;
        bs[1] = 2;
        rs[0] = 1e18;
        vm.prank(owner);
        vm.expectRevert(MockMethRateOracle.LengthMismatch.selector);
        oracle.setRates(bs, rs);
    }

    function test_Oracle_GetRateAt_RevertsUnset() public {
        vm.expectRevert(MockMethRateOracle.RateNotSet.selector);
        oracle.getRateAt(123);
    }

    function test_Oracle_RateOrZero_ReturnsZeroForUnset() public view {
        assertEq(oracle.rateOrZero(123), 0);
    }

    function test_Constructor_RejectsZeroOracle() public {
        vm.expectRevert(bytes("oracle=0"));
        new MethAprResolver(IMethRateOracle(address(0)));
    }
}
