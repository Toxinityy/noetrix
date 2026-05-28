// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {BonusDistributor} from "../src/BonusDistributor.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

contract BonusDistributorTest is Test {
    AgentRegistry registry;
    BonusDistributor dist;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address authorizedCaller = makeAddr("authorizedCaller");
    address finalizer = makeAddr("finalizer");

    address ctrlA = makeAddr("ctrlA");
    address ctrlB = makeAddr("ctrlB");
    uint256 agentA;
    uint256 agentB;

    bytes32 constant CATEGORY = keccak256("METH_APR_24H");
    uint256 constant EPOCH = 1;
    uint256 constant FEE = 0.1 ether;

    function setUp() public {
        registry = new AgentRegistry(owner, treasury);
        dist = new BonusDistributor(owner, IAgentRegistry(address(registry)));

        vm.prank(owner);
        dist.setAuthorized(authorizedCaller, true);

        agentA = _register(ctrlA, "ipfs://a");
        agentB = _register(ctrlB, "ipfs://b");

        // Work inside epoch 1.
        vm.roll(EPOCH * dist.EPOCH_BLOCKS()); // block 1000 → epoch 1
    }

    function _register(address ctrl, string memory uri) internal returns (uint256 id) {
        vm.deal(ctrl, FEE);
        vm.prank(ctrl);
        id = registry.register{value: FEE}(uri);
    }

    // ─── Authorization + inflows ────────────────────────────────────────────────

    function test_NotifySlash_And_RecordContribution_SetState() public {
        vm.deal(authorizedCaller, 1 ether);
        vm.startPrank(authorizedCaller);
        dist.notifySlash{value: 1 ether}(CATEGORY);
        dist.recordContribution(CATEGORY, agentA, 30);
        dist.recordContribution(CATEGORY, agentB, 10);
        vm.stopPrank();

        assertEq(dist.pool(CATEGORY, EPOCH), 1 ether);
        assertEq(dist.agentShare(CATEGORY, EPOCH, agentA), 30);
        assertEq(dist.agentShare(CATEGORY, EPOCH, agentB), 10);
        assertEq(dist.totalShare(CATEGORY, EPOCH), 40);
    }

    function test_NotifySlash_Unauthorized_Reverts() public {
        vm.deal(address(this), 1 ether);
        vm.expectRevert(BonusDistributor.NotAuthorized.selector);
        dist.notifySlash{value: 1 ether}(CATEGORY);
    }

    function test_RecordContribution_Unauthorized_Reverts() public {
        vm.expectRevert(BonusDistributor.NotAuthorized.selector);
        dist.recordContribution(CATEGORY, agentA, 10);
    }

    // ─── finalizeEpoch ─────────────────────────────────────────────────────────

    function test_FinalizeEpoch_BeforeEnd_Reverts() public {
        _seedPool(1 ether);
        // still inside epoch 1 (block 1000..1999) → not ended
        vm.expectRevert(BonusDistributor.EpochNotEnded.selector);
        dist.finalizeEpoch(CATEGORY, EPOCH);
    }

    function test_FinalizeEpoch_Computes_Rollover_And_FinalizerReward() public {
        _seedPool(1 ether);
        _seedShares(); // A=30, B=10

        vm.roll((EPOCH + 1) * dist.EPOCH_BLOCKS()); // block 2000 → epoch 1 ended

        uint256 raw = 1 ether;
        uint256 rollover = (raw * 500) / 10_000; // 5%
        uint256 finalizerReward = (raw * 50) / 10_000; // 0.5%
        uint256 expectedFinal = raw - rollover - finalizerReward;

        uint256 finalizerBalBefore = finalizer.balance;
        vm.prank(finalizer);
        dist.finalizeEpoch(CATEGORY, EPOCH);

        assertTrue(dist.finalized(CATEGORY, EPOCH));
        assertEq(dist.finalPool(CATEGORY, EPOCH), expectedFinal);
        assertEq(dist.pool(CATEGORY, EPOCH + 1), rollover, "rollover credited to next epoch");
        assertEq(finalizer.balance - finalizerBalBefore, finalizerReward, "finalizer paid 0.5%");
    }

    function test_FinalizeEpoch_Twice_Reverts() public {
        _seedPool(1 ether);
        vm.roll((EPOCH + 1) * dist.EPOCH_BLOCKS());
        vm.prank(finalizer);
        dist.finalizeEpoch(CATEGORY, EPOCH);
        vm.expectRevert(BonusDistributor.AlreadyFinalized.selector);
        dist.finalizeEpoch(CATEGORY, EPOCH);
    }

    // ─── claimBonus ─────────────────────────────────────────────────────────────

    function test_ClaimBonus_BeforeFinalize_Reverts() public {
        _seedPool(1 ether);
        _seedShares();
        vm.prank(ctrlA);
        vm.expectRevert(BonusDistributor.NotFinalized.selector);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
    }

    function test_ClaimBonus_NonController_Reverts() public {
        _seedPool(1 ether);
        _seedShares();
        _finalize();
        vm.prank(ctrlB); // ctrlB is not controller of agentA
        vm.expectRevert(BonusDistributor.NotAgentController.selector);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
    }

    function test_ClaimBonus_CorrectAmount() public {
        _seedPool(1 ether);
        _seedShares(); // A=30, B=10, total=40
        _finalize();

        uint256 finalPool = dist.finalPool(CATEGORY, EPOCH);
        uint256 expectedA = (finalPool * 30) / 40;
        uint256 expectedB = (finalPool * 10) / 40;

        uint256 balA = ctrlA.balance;
        vm.prank(ctrlA);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
        assertApproxEqAbs(ctrlA.balance - balA, expectedA, 1);

        uint256 balB = ctrlB.balance;
        vm.prank(ctrlB);
        dist.claimBonus(CATEGORY, EPOCH, agentB);
        assertApproxEqAbs(ctrlB.balance - balB, expectedB, 1);
    }

    function test_ClaimBonus_Twice_Reverts() public {
        _seedPool(1 ether);
        _seedShares();
        _finalize();
        vm.prank(ctrlA);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
        vm.prank(ctrlA);
        vm.expectRevert(BonusDistributor.AlreadyClaimed.selector);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
    }

    function test_ClaimBonus_NoShare_Reverts() public {
        _seedPool(1 ether);
        _seedShares(); // only A and B have shares
        _finalize();
        // Register a third agent with no contribution.
        uint256 agentC = _register(makeAddr("ctrlC"), "ipfs://c");
        vm.prank(registry.controllerOf(agentC));
        vm.expectRevert(BonusDistributor.NoShare.selector);
        dist.claimBonus(CATEGORY, EPOCH, agentC);
    }

    // ─── Conservation ─────────────────────────────────────────────────────────

    function test_Conservation_SumClaimable_LEQ_FinalPool() public {
        _seedPool(1 ether);
        // Use shares that do NOT divide evenly to exercise dust.
        vm.startPrank(authorizedCaller);
        dist.recordContribution(CATEGORY, agentA, 7);
        dist.recordContribution(CATEGORY, agentB, 11);
        vm.stopPrank();
        _finalize();

        uint256 finalPool = dist.finalPool(CATEGORY, EPOCH);
        uint256 claimA = dist.claimable(CATEGORY, EPOCH, agentA);
        uint256 claimB = dist.claimable(CATEGORY, EPOCH, agentB);

        assertLe(claimA + claimB, finalPool, "no overdistribution");

        // Actually claim and verify the contract retains the rounding dust.
        uint256 distBalBefore = address(dist).balance;
        vm.prank(ctrlA);
        dist.claimBonus(CATEGORY, EPOCH, agentA);
        vm.prank(ctrlB);
        dist.claimBonus(CATEGORY, EPOCH, agentB);
        uint256 paidOut = distBalBefore - address(dist).balance;
        assertEq(paidOut, claimA + claimB);
        assertLe(paidOut, finalPool);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _seedPool(uint256 amount) internal {
        vm.deal(authorizedCaller, amount);
        vm.prank(authorizedCaller);
        dist.notifySlash{value: amount}(CATEGORY);
    }

    function _seedShares() internal {
        vm.startPrank(authorizedCaller);
        dist.recordContribution(CATEGORY, agentA, 30);
        dist.recordContribution(CATEGORY, agentB, 10);
        vm.stopPrank();
    }

    function _finalize() internal {
        vm.roll((EPOCH + 1) * dist.EPOCH_BLOCKS());
        vm.prank(finalizer);
        dist.finalizeEpoch(CATEGORY, EPOCH);
    }
}
