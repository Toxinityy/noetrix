// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";

contract SentimentOracleTest is Test {
    SentimentOracle oracle;
    address keeper = address(0xBEEF);

    function setUp() public {
        oracle = new SentimentOracle(address(this));
    }

    function test_OwnerCanSet_LatestReflects() public {
        oracle.setFearGreed(42);
        (uint8 v, uint256 b) = oracle.latest();
        assertEq(v, 42);
        assertEq(b, block.number);
    }

    function test_KeeperCanSet_NonKeeperReverts() public {
        oracle.setKeeper(keeper, true);
        vm.prank(keeper);
        oracle.setFearGreed(10);
        (uint8 v,) = oracle.latest();
        assertEq(v, 10);
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        oracle.setFearGreed(99);
    }

    function test_RejectsOutOfRange() public {
        vm.expectRevert();
        oracle.setFearGreed(101);
    }
}
