// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AaveMantleTvlResolver} from "../src/resolvers/AaveMantleTvlResolver.sol";
import {MockAavePool} from "../src/mocks/MockAavePool.sol";
import {MockAToken} from "../src/mocks/MockAToken.sol";
import {IAavePoolLike, IAaveOracleLike} from "../src/interfaces/IAaveLike.sol";

contract AaveMantleTvlResolverTest is Test {
    MockAavePool pool;
    AaveMantleTvlResolver resolver;

    address owner = makeAddr("owner");

    address wethAsset = makeAddr("weth");
    address usdcAsset = makeAddr("usdc");
    address wbtcAsset = makeAddr("wbtc");

    function setUp() public {
        pool = new MockAavePool(owner);
        resolver = new AaveMantleTvlResolver(IAavePoolLike(address(pool)), IAaveOracleLike(address(pool)));
    }

    function _addReserve(address asset, uint256 supply, uint8 dec, uint256 price8) internal returns (MockAToken a) {
        a = new MockAToken(supply, dec);
        vm.prank(owner);
        pool.addReserve(asset, address(a), price8);
    }

    function test_ThreeReserves_USDTvlMatchesHandCalc() public {
        // WETH: 1000 tokens (18 dec) @ $3000 → $3,000,000 = 3.0e14 (8-dec USD)
        _addReserve(wethAsset, 1000 * 1e18, 18, 3000 * 1e8);
        // USDC: 5,000,000 tokens (6 dec) @ $1 → $5,000,000 = 5.0e14
        _addReserve(usdcAsset, 5_000_000 * 1e6, 6, 1 * 1e8);
        // WBTC: 10 tokens (8 dec) @ $60,000 → $600,000 = 6.0e13
        _addReserve(wbtcAsset, 10 * 1e8, 8, 60_000 * 1e8);

        bytes memory out = resolver.resolve("", 0);
        uint256 tvlUsd8 = abi.decode(out, (uint256));

        uint256 expected = 3e14 + 5e14 + 6e13; // 8.6e14 == $8,600,000
        assertEq(tvlUsd8, expected);
    }

    function test_ZeroSupplyReserve_Skipped() public {
        _addReserve(wethAsset, 0, 18, 3000 * 1e8);
        _addReserve(usdcAsset, 5_000_000 * 1e6, 6, 1 * 1e8);

        uint256 tvlUsd8 = abi.decode(resolver.resolve("", 0), (uint256));
        assertEq(tvlUsd8, 5e14);
    }

    function test_NoReserves_ReturnsZero() public {
        uint256 tvlUsd8 = abi.decode(resolver.resolve("", 0), (uint256));
        assertEq(tvlUsd8, 0);
    }

    function test_Constructor_RejectsZeroAddress() public {
        vm.expectRevert(bytes("addr=0"));
        new AaveMantleTvlResolver(IAavePoolLike(address(0)), IAaveOracleLike(address(pool)));
    }
}
