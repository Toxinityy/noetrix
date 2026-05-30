// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockCompositeFeed} from "./mocks/MockCompositeFeed.sol";
import {YieldAllocator} from "../src/examples/YieldAllocator.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";

contract YieldAllocatorTest is Test {
    MockCompositeFeed internal feed;
    YieldAllocator internal alloc;

    bytes32 constant METH = keccak256("METH_APR_24H");
    bytes32 constant USDY = keccak256("USDY_APY_24H");

    function setUp() public {
        feed = new MockCompositeFeed();
        alloc = new YieldAllocator(ICompositeFeed(address(feed)), METH, USDY);
        vm.roll(1_000_000); // so freshness math has headroom
    }

    // mETH 3000bps@9000conf vs USDY 500bps@9000conf → effective 2700 vs 450 → mETH-heavy.
    function test_Allocation_FavorsHigherEffectiveYield() public {
        feed.set(METH, 3000, 9000, 2, block.number);
        feed.set(USDY, 500, 9000, 2, block.number);
        (uint256 m, uint256 u,,) = alloc.getAllocation();
        assertEq(m + u, 10_000);
        assertGt(m, u);
        // eff: 2700 vs 450 → m = 2700*10000/3150 = 8571
        assertEq(m, 8571);
        assertEq(u, 1429);
    }

    // Stale feed (old updatedBlock) → 50/50 fallback.
    function test_Allocation_StaleFeed_FallsBackFiftyFifty() public {
        feed.set(METH, 3000, 9000, 2, block.number - 1_000_000); // very stale
        feed.set(USDY, 500, 9000, 2, block.number);
        (uint256 m, uint256 u,,) = alloc.getAllocation();
        assertEq(m, 5000);
        assertEq(u, 5000);
    }

    // Both zero yield → 50/50 fallback (no div-by-zero).
    function test_Allocation_ZeroYields_FallsBackFiftyFifty() public {
        feed.set(METH, 0, 9000, 2, block.number);
        feed.set(USDY, 0, 9000, 2, block.number);
        (uint256 m, uint256 u,,) = alloc.getAllocation();
        assertEq(m, 5000);
        assertEq(u, 5000);
    }
}
