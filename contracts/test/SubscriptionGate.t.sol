// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionGate} from "../src/SubscriptionGate.sol";

contract SubscriptionGateTest is Test {
    SubscriptionGate gate;
    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address bob = address(0xCAFE);

    uint64 constant PERIOD = 30 days;

    event Subscribed(address indexed subscriber, SubscriptionGate.Tier tier, uint64 expiry, uint256 paid);

    function setUp() public {
        vm.warp(1_000_000); // a non-trivial timestamp
        gate = new SubscriptionGate(owner);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function test_SubscribePro_setsTierExpiryBalanceAndEvent() public {
        uint256 price = gate.proPrice();
        vm.expectEmit(true, false, false, true, address(gate));
        emit Subscribed(alice, SubscriptionGate.Tier.Pro, uint64(block.timestamp + PERIOD), price);
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);

        assertEq(uint8(gate.tierOf(alice)), uint8(SubscriptionGate.Tier.Pro));
        assertEq(gate.subscriptionExpiry(alice), block.timestamp + PERIOD);
        assertEq(address(gate).balance, price);
    }

    function test_SubscribeProtocol() public {
        uint256 price = gate.protocolPrice();
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Protocol);
        assertEq(uint8(gate.tierOf(alice)), uint8(SubscriptionGate.Tier.Protocol));
        assertEq(gate.subscriptionExpiry(alice), block.timestamp + PERIOD);
    }

    function test_Overpayment_acceptedAndKept() public {
        uint256 price = gate.proPrice();
        vm.prank(alice);
        gate.subscribe{value: price + 1 ether}(SubscriptionGate.Tier.Pro);
        assertEq(uint8(gate.tierOf(alice)), uint8(SubscriptionGate.Tier.Pro));
        assertEq(address(gate).balance, price + 1 ether);
    }

    function test_Underpayment_reverts() public {
        uint256 price = gate.proPrice();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SubscriptionGate.InsufficientPayment.selector, price, price - 1));
        gate.subscribe{value: price - 1}(SubscriptionGate.Tier.Pro);
    }

    function test_SubscribeNone_reverts() public {
        vm.prank(alice);
        vm.expectRevert(SubscriptionGate.BadTier.selector);
        gate.subscribe{value: 1 ether}(SubscriptionGate.Tier.None);
    }

    function test_Renew_extendsFromCurrentExpiry() public {
        uint256 price = gate.proPrice();
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);
        uint256 firstExpiry = gate.subscriptionExpiry(alice);

        vm.warp(block.timestamp + 1 days); // still active
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);
        assertEq(gate.subscriptionExpiry(alice), firstExpiry + PERIOD);
    }

    function test_SubscribeAfterExpiry_startsFromNow() public {
        uint256 price = gate.proPrice();
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);

        vm.warp(block.timestamp + 60 days); // past expiry
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);
        assertEq(gate.subscriptionExpiry(alice), block.timestamp + PERIOD);
    }

    function test_SetPrices_ownerOnly() public {
        vm.prank(owner);
        gate.setPrices(1 ether, 5 ether);
        assertEq(gate.proPrice(), 1 ether);
        assertEq(gate.protocolPrice(), 5 ether);

        vm.prank(alice);
        vm.expectRevert();
        gate.setPrices(2 ether, 2 ether);
    }

    function test_Withdraw_ownerOnly_zeroAddr_andTransfers() public {
        uint256 price = gate.proPrice();
        vm.prank(alice);
        gate.subscribe{value: price}(SubscriptionGate.Tier.Pro);

        // non-owner
        vm.prank(alice);
        vm.expectRevert();
        gate.withdraw(alice);

        // zero address
        vm.prank(owner);
        vm.expectRevert(SubscriptionGate.ZeroAddress.selector);
        gate.withdraw(address(0));

        // owner withdraw transfers full balance
        uint256 before = bob.balance;
        vm.prank(owner);
        gate.withdraw(bob);
        assertEq(bob.balance, before + price);
        assertEq(address(gate).balance, 0);
    }

    function test_HasAccess_openByDefault() public view {
        assertTrue(gate.hasAccess(alice, keccak256("METH_APR_24H")));
    }

    function test_SetRequiresSubscription_and_gatedAccess() public {
        bytes32 cat = keccak256("METH_APR_24H");
        vm.prank(owner);
        gate.setRequiresSubscription(cat, true);
        assertFalse(gate.hasAccess(alice, cat));

        vm.prank(owner);
        gate.setSubscription(alice, block.timestamp + 100);
        assertTrue(gate.hasAccess(alice, cat));
    }
}
