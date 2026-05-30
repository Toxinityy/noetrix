// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";
import {UsdyApyResolver} from "../src/resolvers/UsdyApyResolver.sol";
import {IMethRateOracle} from "../src/interfaces/IMethRateOracle.sol";

contract UsdyApyResolverTest is Test {
    MockMethRateOracle internal oracle;
    UsdyApyResolver internal resolver;
    address internal owner = address(0xA11CE);
    uint256 internal constant DAY_BLOCKS = 43_200;

    function setUp() public {
        oracle = new MockMethRateOracle(owner);
        resolver = new UsdyApyResolver(IMethRateOracle(address(oracle)));
    }

    function _setPair(uint256 pb, uint256 pr, uint256 nb, uint256 nr) internal {
        uint256[] memory bs = new uint256[](2);
        uint256[] memory rs = new uint256[](2);
        bs[0] = pb;
        bs[1] = nb;
        rs[0] = pr;
        rs[1] = nr;
        vm.prank(owner);
        oracle.setRates(bs, rs);
    }

    // 0.0137% daily ≈ 5% APY. ratio-1 = 0.000137e18 → ×365×10000/1e18 = 500 bps.
    function test_Resolve_FivePercentApy_Yields500Bps() public {
        uint256 nb = 200_000;
        _setPair(nb - DAY_BLOCKS, 1e18, nb, 1.000137e18);
        bytes memory out = resolver.resolve("", nb);
        assertEq(abi.decode(out, (uint256)), 500);
    }

    function test_Resolve_NoGrowth_YieldsZero() public {
        uint256 nb = 200_000;
        _setPair(nb - DAY_BLOCKS, 1e18, nb, 1e18);
        assertEq(abi.decode(resolver.resolve("", nb), (uint256)), 0);
    }

    function test_Resolve_BeforeDayWindow_YieldsZero() public view {
        assertEq(abi.decode(resolver.resolve("", 100), (uint256)), 0);
    }
}
