// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract AgentRegistryTest is Test {
    AgentRegistry internal registry;

    address internal owner = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal scoringEngine = address(0x5C09);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA20);

    bytes32 internal constant CATEGORY = keccak256("METH_APR_24H");

    function setUp() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);

        registry = new AgentRegistry(owner, treasury);

        vm.prank(owner);
        registry.setScoringEngine(scoringEngine);
    }

    // ─── Constructor ────────────────────────────────────────────────────────────

    function test_Constructor_RejectsZeroTreasury() public {
        vm.expectRevert(AgentRegistry.TreasuryNotSet.selector);
        new AgentRegistry(owner, address(0));
    }

    function test_Constructor_SetsOwnerAndTreasury() public view {
        assertEq(registry.owner(), owner);
        assertEq(registry.treasury(), treasury);
    }

    // ─── Registration ───────────────────────────────────────────────────────────

    function test_Register_RevertsOnZeroFee() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.IncorrectRegistrationFee.selector);
        registry.register("ipfs://meta");
    }

    function test_Register_RevertsOnWrongFee() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.IncorrectRegistrationFee.selector);
        registry.register{value: 0.05 ether}("ipfs://meta");
    }

    function test_Register_MintsAndForwardsFee() public {
        uint256 treasuryBefore = treasury.balance;

        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("ipfs://meta");

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), alice);
        assertEq(registry.controllerOf(agentId), alice);
        assertEq(registry.controllerToAgent(alice), agentId);
        assertEq(treasury.balance - treasuryBefore, 0.1 ether);

        IAgentRegistry.AgentProfile memory profile = registry.getAgent(agentId);
        assertEq(profile.controller, alice);
        assertEq(profile.metadataURI, "ipfs://meta");
        assertEq(profile.registeredAt, block.timestamp);
    }

    function test_Register_AssignsMonotonicIds() public {
        vm.prank(alice);
        uint256 id1 = registry.register{value: 0.1 ether}("a");

        vm.prank(bob);
        uint256 id2 = registry.register{value: 0.1 ether}("b");

        vm.prank(carol);
        uint256 id3 = registry.register{value: 0.1 ether}("c");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    function test_Register_RevertsIfControllerAlreadyBound() public {
        vm.prank(alice);
        registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.ControllerAlreadyBound.selector);
        registry.register{value: 0.1 ether}("b");
    }

    // ─── Soulbound ──────────────────────────────────────────────────────────────

    function test_Transfer_AlwaysReverts() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.TransfersDisabled.selector);
        registry.transferFrom(alice, bob, agentId);
    }

    function test_SafeTransfer_AlwaysReverts() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.TransfersDisabled.selector);
        registry.safeTransferFrom(alice, bob, agentId);
    }

    function test_Approve_DoesNotEnableTransfer() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        registry.approve(bob, agentId);

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.TransfersDisabled.selector);
        registry.transferFrom(alice, bob, agentId);
    }

    function test_TokenURI_ReturnsMetadata() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("ipfs://abc");
        assertEq(registry.tokenURI(agentId), "ipfs://abc");
    }

    // ─── Controller rotation ────────────────────────────────────────────────────

    function test_Rotation_HappyPath() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        registry.proposeControllerRotation(agentId, bob);

        vm.warp(block.timestamp + 24 hours);

        vm.prank(alice);
        registry.executeControllerRotation(agentId);

        assertEq(registry.controllerOf(agentId), bob);
        assertEq(registry.controllerToAgent(bob), agentId);
        assertEq(registry.controllerToAgent(alice), 0);
    }

    function test_Rotation_RejectsBeforeTimelock() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        registry.proposeControllerRotation(agentId, bob);

        vm.warp(block.timestamp + 23 hours);

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.TimelockNotElapsed.selector);
        registry.executeControllerRotation(agentId);
    }

    function test_Rotation_OnlyControllerCanPropose() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(bob);
        vm.expectRevert(AgentRegistry.NotController.selector);
        registry.proposeControllerRotation(agentId, bob);
    }

    function test_Rotation_RejectsZeroNewController() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.InvalidNewController.selector);
        registry.proposeControllerRotation(agentId, address(0));
    }

    function test_Rotation_RejectsSameController() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.InvalidNewController.selector);
        registry.proposeControllerRotation(agentId, alice);
    }

    function test_Rotation_RejectsAlreadyBoundNewController() public {
        vm.prank(alice);
        uint256 aliceAgent = registry.register{value: 0.1 ether}("a");

        vm.prank(bob);
        registry.register{value: 0.1 ether}("b");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.ControllerAlreadyBound.selector);
        registry.proposeControllerRotation(aliceAgent, bob);
    }

    function test_Rotation_RejectsExecuteWithoutPending() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.NoPendingRotation.selector);
        registry.executeControllerRotation(agentId);
    }

    // ─── Reputation auth ────────────────────────────────────────────────────────

    function test_UpdateReputation_RevertsFromNonScoringEngine() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;

        vm.prank(alice);
        vm.expectRevert(AgentRegistry.OnlyScoringEngine.selector);
        registry.updateReputation(agentId, CATEGORY, 1e5, -1e5, bucketAcc, bucketCount);
    }

    function test_UpdateReputation_AppliesAllFields() public {
        vm.prank(alice);
        uint256 agentId = registry.register{value: 0.1 ether}("a");

        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;
        for (uint256 i; i < 10; ++i) {
            bucketAcc[i] = int256(i * 1e4);
            bucketCount[i] = i + 1;
        }

        vm.prank(scoringEngine);
        registry.updateReputation(agentId, CATEGORY, 5e5, -2e5, bucketAcc, bucketCount);

        IAgentRegistry.Reputation memory rep = registry.getReputation(agentId, CATEGORY);
        assertEq(rep.accuracyScore, 5e5);
        assertEq(rep.calibrationScore, -2e5);
        assertEq(rep.resolvedCount, 1);
        assertEq(rep.lastUpdatedBlock, block.number);
        for (uint256 i; i < 10; ++i) {
            assertEq(rep.bucketAccuracy[i], int256(i * 1e4));
            assertEq(rep.bucketCount[i], i + 1);
        }

        IAgentRegistry.AgentProfile memory profile = registry.getAgent(agentId);
        assertEq(profile.totalResolved, 1);
    }

    // ─── topAgents — the trickiest piece ────────────────────────────────────────

    uint160 internal _ctrlNonce = 0x1000;

    /// @dev Register `count` agents using fresh controller addresses. Returns ids in order.
    function _registerN(uint256 count) internal returns (uint256[] memory ids) {
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            address ctrl = address(_ctrlNonce++);
            vm.deal(ctrl, 1 ether);
            vm.prank(ctrl);
            ids[i] = registry.register{value: 0.1 ether}("ipfs://x");
        }
    }

    /// @dev Push an agent to TOP_AGENT_MIN_RESOLVED resolutions with `finalScore` as their last accuracyScore.
    function _seedReputation(uint256 agentId, int256 finalScore) internal {
        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;
        for (uint256 i; i < AgentRegistry(registry).TOP_AGENT_MIN_RESOLVED(); ++i) {
            vm.prank(scoringEngine);
            registry.updateReputation(agentId, CATEGORY, finalScore, 0, bucketAcc, bucketCount);
        }
    }

    function test_TopAgents_QualifiesOnlyAfterMinResolved() public {
        uint256[] memory ids = _registerN(1);
        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;

        // 9 resolutions → should NOT be in topAgents yet.
        for (uint256 i; i < 9; ++i) {
            vm.prank(scoringEngine);
            registry.updateReputation(ids[0], CATEGORY, 9e5, 0, bucketAcc, bucketCount);
        }
        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], 0, "should still be empty at 9 resolutions");

        // 10th resolution → enters the array.
        vm.prank(scoringEngine);
        registry.updateReputation(ids[0], CATEGORY, 9e5, 0, bucketAcc, bucketCount);
        top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], ids[0], "should enter top after min resolved met");
    }

    function test_TopAgents_SortsByAccuracyDesc() public {
        uint256[] memory ids = _registerN(3);
        _seedReputation(ids[0], 3e5); // mid
        _seedReputation(ids[1], 9e5); // high
        _seedReputation(ids[2], 1e5); // low

        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], ids[1], "high accuracy ranks first");
        assertEq(top[1], ids[0], "mid accuracy ranks second");
        assertEq(top[2], ids[2], "low accuracy ranks third");
    }

    function test_TopAgents_TieBreakByLowerAgentId() public {
        uint256[] memory ids = _registerN(2);
        _seedReputation(ids[0], 5e5);
        _seedReputation(ids[1], 5e5);

        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], ids[0], "tie broken by lower agentId (ids[0] < ids[1])");
        assertEq(top[1], ids[1]);
    }

    function test_TopAgents_EvictsBeyond20() public {
        // 25 agents, varied scores. Lowest 5 must NOT appear in top-20.
        uint256[] memory ids = _registerN(25);
        for (uint256 i; i < 25; ++i) {
            _seedReputation(ids[i], int256(int256(i) * 1e4)); // score = i*1e4
        }

        uint256[20] memory top = registry.getTopAgents(CATEGORY);

        // Top slot should be agent with score 24*1e4.
        assertEq(top[0], ids[24]);
        assertEq(top[19], ids[5]);

        // Lowest 5 should not appear anywhere.
        for (uint256 i; i < 5; ++i) {
            for (uint256 j; j < 20; ++j) {
                assertTrue(top[j] != ids[i], "evicted agent must not appear");
            }
        }
    }

    function test_TopAgents_RepositionsOnRescore() public {
        uint256[] memory ids = _registerN(3);
        _seedReputation(ids[0], 8e5);
        _seedReputation(ids[1], 6e5);
        _seedReputation(ids[2], 4e5);

        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;

        // Demote ids[0] to lowest.
        vm.prank(scoringEngine);
        registry.updateReputation(ids[0], CATEGORY, 1e5, 0, bucketAcc, bucketCount);

        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], ids[1]);
        assertEq(top[1], ids[2]);
        assertEq(top[2], ids[0]);
    }

    function test_TopAgents_NeverDuplicatesAgentId() public {
        uint256[] memory ids = _registerN(1);
        _seedReputation(ids[0], 5e5);

        int256[10] memory bucketAcc;
        uint256[10] memory bucketCount;
        // Re-score 5 more times.
        for (uint256 i; i < 5; ++i) {
            vm.prank(scoringEngine);
            registry.updateReputation(ids[0], CATEGORY, int256(5e5 + int256(i) * 1e3), 0, bucketAcc, bucketCount);
        }

        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        uint256 occurrences;
        for (uint256 i; i < 20; ++i) {
            if (top[i] == ids[0]) occurrences++;
        }
        assertEq(occurrences, 1, "agent must appear at most once in topAgents");
    }

    function test_TopAgents_HandlesInsertionAtBottom() public {
        uint256[] memory ids = _registerN(20);
        for (uint256 i; i < 20; ++i) {
            _seedReputation(ids[i], int256(int256(i + 1) * 1e5)); // 1e5..20e5
        }

        // 21st agent with score lower than all → must not enter.
        uint256[] memory more = _registerN(1);
        _seedReputation(more[0], int256(1)); // strictly lower than 1e5

        uint256[20] memory top = registry.getTopAgents(CATEGORY);
        for (uint256 i; i < 20; ++i) {
            assertTrue(top[i] != more[0], "below-threshold agent must not enter top-20");
        }

        // 22nd agent with score higher than all → must enter at slot 0.
        uint256[] memory even_more = _registerN(1);
        _seedReputation(even_more[0], int256(100e5));

        top = registry.getTopAgents(CATEGORY);
        assertEq(top[0], even_more[0]);
    }

    // ─── Fuzz: monotonic IDs, no collisions ─────────────────────────────────────

    function testFuzz_Register_MonotonicNoCollisions(uint8 n) public {
        n = uint8(bound(n, 1, 50));
        uint256 prev;
        for (uint256 i; i < n; ++i) {
            address ctrl = address(uint160(0xC0DE0000 + i));
            vm.deal(ctrl, 1 ether);
            vm.prank(ctrl);
            uint256 id = registry.register{value: 0.1 ether}("u");
            assertGt(id, prev, "ids must be strictly increasing");
            prev = id;
        }
    }
}
