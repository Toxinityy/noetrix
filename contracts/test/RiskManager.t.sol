// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockCompositeFeed} from "./mocks/MockCompositeFeed.sol";
import {RiskManager} from "../src/examples/RiskManager.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";

contract RiskManagerTest is Test {
    MockCompositeFeed internal feed;
    RiskManager internal rm;
    bytes32 constant METH = keccak256("METH_APR_24H");
    address internal owner = address(0xA11CE);

    function setUp() public {
        feed = new MockCompositeFeed();
        vm.prank(owner);
        rm = new RiskManager(ICompositeFeed(address(feed)), owner);
        vm.prank(owner);
        rm.registerAsset(METH, 8000, 1_000_000e8); // baseCf 80%, maxCap $1M (8-dec)
        vm.roll(1_000_000);
    }

    function test_HighConfidence_NormalAndHighCf() public {
        feed.set(METH, 3000, 9500, 3, block.number);
        assertEq(uint256(rm.riskState(METH)), uint256(RiskManager.State.Normal));
        assertEq(rm.collateralFactor(METH), 7600); // 8000*9500/10000
        assertFalse(rm.isPaused(METH));
    }

    function test_MidConfidence_Caution() public {
        feed.set(METH, 3000, 6000, 3, block.number);
        assertEq(uint256(rm.riskState(METH)), uint256(RiskManager.State.Caution));
    }

    function test_StaleFeed_FrozenAndPaused() public {
        feed.set(METH, 3000, 9500, 3, block.number - 1_000_000);
        assertEq(uint256(rm.riskState(METH)), uint256(RiskManager.State.Frozen));
        assertTrue(rm.isPaused(METH));
        assertEq(rm.depositCap(METH), 0);
    }

    function test_LowConfidence_Frozen() public {
        feed.set(METH, 3000, 2000, 3, block.number);
        assertEq(uint256(rm.riskState(METH)), uint256(RiskManager.State.Frozen));
    }
}
