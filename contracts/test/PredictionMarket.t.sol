// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IBonusDistributor} from "../src/interfaces/IBonusDistributor.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Records every slash forwarded for an exact-amount assertion in tests.
contract MockBonusPool is IBonusDistributor {
    mapping(bytes32 => uint256) public received;
    uint256 public total;

    function notifySlash(bytes32 categoryId) external payable override {
        received[categoryId] += msg.value;
        total += msg.value;
    }

    receive() external payable {}
}

/// @notice Pool whose notifySlash re-enters PredictionMarket.commit. Used to verify ReentrancyGuard.
contract ReentrantBonusPool is IBonusDistributor {
    PredictionMarket public immutable market;
    uint256 public attackerAgentId;
    bytes32 public attackerCategoryId;

    constructor(PredictionMarket _market) {
        market = _market;
    }

    function configure(uint256 agentId, bytes32 categoryId) external {
        attackerAgentId = agentId;
        attackerCategoryId = categoryId;
    }

    function notifySlash(bytes32) external payable override {
        // Re-enter into a stake-moving function. Any nonReentrant function works.
        market.commit{value: 1 ether}(
            attackerAgentId, attackerCategoryId, bytes32(uint256(1)), block.number + 500, bytes32(uint256(2))
        );
    }

    receive() external payable {}
}

contract PredictionMarketTest is Test {
    AgentRegistry internal registry;
    PredictionMarket internal market;
    MockBonusPool internal pool;

    address internal owner = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal scoringEngine = address(0x5C01);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA20);
    address internal resolverEOA = address(0x5E50);

    uint256 internal aliceAgentId;

    bytes32 internal constant CATEGORY = keccak256("METH_APR_24H");
    bytes internal constant CATEGORY_CONFIG = hex"01020304";
    uint256 internal constant MIN_STAKE = 0.05 ether;
    uint256 internal constant WINDOW_START = 300;
    uint256 internal constant WINDOW_END = 50_000;

    function setUp() public {
        // Roll to a comfortable block so reveal-window math never underflows.
        vm.roll(10_000);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(carol, 100 ether);

        registry = new AgentRegistry(owner, treasury);
        market = new PredictionMarket(owner, registry);

        // Register alice as agent #1.
        vm.prank(alice);
        aliceAgentId = registry.register{value: 0.1 ether}("ipfs://alice");

        // Configure market.
        pool = new MockBonusPool();
        vm.startPrank(owner);
        market.setBonusPool(address(pool));
        market.setScoringEngine(scoringEngine);
        market.registerCategory(
            CATEGORY,
            address(0xD11D), // resolver placeholder
            address(0x5C09), // scorer placeholder
            MIN_STAKE,
            WINDOW_START,
            WINDOW_END,
            CATEGORY_CONFIG
        );
        vm.stopPrank();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function _validResolutionBlock() internal view returns (uint256) {
        return block.number + 500;
    }

    function _commitHash(
        uint256 agentId,
        bytes32 categoryId,
        bytes memory value,
        uint16 confidence,
        bytes32 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(agentId, categoryId, value, confidence, nonce));
    }

    function _doCommit(uint256 stake, bytes memory value, uint16 confidence, bytes32 nonce)
        internal
        returns (uint256 predictionId, uint256 resBlock)
    {
        resBlock = _validResolutionBlock();
        bytes32 h = _commitHash(aliceAgentId, CATEGORY, value, confidence, nonce);
        vm.prank(alice);
        predictionId = market.commit{value: stake}(aliceAgentId, CATEGORY, h, resBlock, bytes32("content"));
    }

    // ─── Constructor / admin ────────────────────────────────────────────────────

    function test_Constructor_RejectsZeroRegistry() public {
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        new PredictionMarket(owner, AgentRegistry(address(0)));
    }

    function test_SetBonusPool_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        market.setBonusPool(address(0));
    }

    function test_SetScoringEngine_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        market.setScoringEngine(address(0));
    }

    function test_RegisterCategory_RevertsDuplicate() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.CategoryAlreadyRegistered.selector);
        market.registerCategory(
            CATEGORY, address(0xD11D), address(0x5C09), MIN_STAKE, WINDOW_START, WINDOW_END, CATEGORY_CONFIG
        );
    }

    function test_RegisterCategory_RevertsWindowStartTooSmall() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidCategoryConfig.selector);
        market.registerCategory(
            keccak256("OTHER"), address(0xD11D), address(0x5C09), MIN_STAKE, 100, WINDOW_END, CATEGORY_CONFIG
        );
    }

    function test_RegisterCategory_RevertsEndBeforeStart() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidCategoryConfig.selector);
        market.registerCategory(
            keccak256("OTHER"), address(0xD11D), address(0x5C09), MIN_STAKE, 1000, 500, CATEGORY_CONFIG
        );
    }

    function test_RegisterCategory_RevertsZeroResolverScorer() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        market.registerCategory(
            keccak256("OTHER"), address(0), address(0x5C09), MIN_STAKE, WINDOW_START, WINDOW_END, CATEGORY_CONFIG
        );
    }

    // ─── commit ─────────────────────────────────────────────────────────────────

    function test_Commit_HappyPath_SetsState() public {
        (uint256 id, uint256 resBlock) =
            _doCommit(0.1 ether, abi.encode(uint256(1500)), 8000, bytes32("nonce"));
        assertEq(id, 1);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(p.agentId, aliceAgentId);
        assertEq(p.categoryId, CATEGORY);
        assertEq(p.stake, 0.1 ether);
        assertEq(p.commitBlock, block.number);
        assertEq(p.resolutionBlock, resBlock);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Committed));
        assertEq(p.value.length, 0);
        assertEq(p.confidence, 0);
        assertEq(p.score, 0);
        assertEq(address(market).balance, 0.1 ether);
    }

    function test_Commit_RevertsUnregisteredCategory() public {
        bytes32 unreg = keccak256("UNREG");
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.CategoryNotRegistered.selector);
        market.commit{value: MIN_STAKE}(aliceAgentId, unreg, bytes32("h"), _validResolutionBlock(), bytes32("c"));
    }

    function test_Commit_RevertsStakeBelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.StakeBelowMinimum.selector);
        market.commit{value: MIN_STAKE - 1}(
            aliceAgentId, CATEGORY, bytes32("h"), _validResolutionBlock(), bytes32("c")
        );
    }

    function test_Commit_RevertsResolutionBlockTooSoon() public {
        uint256 tooSoon = block.number + 299; // under MIN_RESOLUTION_OFFSET (300)
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.ResolutionTooSoon.selector);
        market.commit{value: MIN_STAKE}(aliceAgentId, CATEGORY, bytes32("h"), tooSoon, bytes32("c"));
    }

    function test_Commit_RevertsResolutionOutsideAllowedWindow() public {
        uint256 tooFar = block.number + WINDOW_END + 1;
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.ResolutionOutsideAllowedWindow.selector);
        market.commit{value: MIN_STAKE}(aliceAgentId, CATEGORY, bytes32("h"), tooFar, bytes32("c"));
    }

    function test_Commit_RevertsNonController() public {
        vm.prank(bob); // bob has no agent
        vm.expectRevert(PredictionMarket.NotAgentController.selector);
        market.commit{value: MIN_STAKE}(
            aliceAgentId, CATEGORY, bytes32("h"), _validResolutionBlock(), bytes32("c")
        );
    }

    // ─── reveal ─────────────────────────────────────────────────────────────────

    function test_Reveal_HappyPath_SetsState() public {
        bytes memory value = abi.encode(uint256(1500));
        uint16 confidence = 8000;
        bytes32 nonce = bytes32("nonce");
        (uint256 id,) = _doCommit(0.1 ether, value, confidence, nonce);

        vm.roll(block.number + 20); // inside [delay 10, window 100], plenty before resolution-200
        market.reveal(id, value, confidence, nonce);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Revealed));
        assertEq(p.value, value);
        assertEq(p.confidence, confidence);
    }

    function test_Reveal_RevertsWrongNonce() public {
        bytes memory value = abi.encode(uint256(1500));
        (uint256 id,) = _doCommit(0.1 ether, value, 8000, bytes32("nonce"));
        vm.roll(block.number + 20);
        vm.expectRevert(PredictionMarket.CommitHashMismatch.selector);
        market.reveal(id, value, 8000, bytes32("WRONG"));
    }

    function test_Reveal_RevertsBeforeDelay() public {
        bytes memory value = abi.encode(uint256(1500));
        (uint256 id,) = _doCommit(0.1 ether, value, 8000, bytes32("n"));
        vm.roll(block.number + 5); // < REVEAL_DELAY_BLOCKS (10)
        vm.expectRevert(PredictionMarket.RevealTooEarly.selector);
        market.reveal(id, value, 8000, bytes32("n"));
    }

    function test_Reveal_RevertsAfterWindow() public {
        bytes memory value = abi.encode(uint256(1500));
        (uint256 id,) = _doCommit(0.1 ether, value, 8000, bytes32("n"));
        vm.roll(block.number + 101); // > REVEAL_WINDOW_BLOCKS (100)
        vm.expectRevert(PredictionMarket.RevealTooLate.selector);
        market.reveal(id, value, 8000, bytes32("n"));
    }

    function test_Reveal_RevertsTooCloseToResolution() public {
        // Need: commit at block X, resolution at X+250 → reveal cutoff = X+50.
        // Move into a fresh category so allowedWindowStart doesn't bar this.
        bytes32 tight = keccak256("TIGHT");
        vm.prank(owner);
        market.registerCategory(
            tight, address(0xD11D), address(0x5C09), MIN_STAKE, 300, 50_000, hex""
        );
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        uint256 resBlock = block.number + 300; // delta = MIN_RESOLUTION_OFFSET exactly
        bytes32 h = _commitHash(aliceAgentId, tight, value, 1, nonce);
        vm.prank(alice);
        uint256 id = market.commit{value: MIN_STAKE}(aliceAgentId, tight, h, resBlock, bytes32("c"));

        // reveal cutoff = resBlock - 200 = commitBlock + 100. Push one block past cutoff but still
        // inside reveal window? Window ends at commitBlock + 100 too — both bounds coincide here.
        // To isolate the "too close to resolution" path we need cutoff < window-end.
        // Use a longer category instead and roll past the cutoff but inside the reveal window? Impossible
        // because cutoff = resBlock-200 and window-end = commitBlock+100; cutoff ≥ window-end iff
        // resBlock ≥ commitBlock+300. So when delta == 300 they coincide. Use delta = 250 → invalid commit.
        // Instead test: commit with delta = 280 still fails commit's MIN_RESOLUTION_OFFSET=300.
        // Conclusion: with MIN_RESOLUTION_OFFSET = REVEAL_WINDOW + SUBMISSION_CUTOFF, the
        // "too close to resolution" branch is provably unreachable; assert this by attempting a reveal
        // exactly at the cutoff (one past) and confirming the RevealTooLate branch fires first.
        vm.roll(resBlock - 199); // commitBlock + 101 → RevealTooLate triggers first
        vm.expectRevert(PredictionMarket.RevealTooLate.selector);
        market.reveal(id, value, 1, nonce);
    }

    function test_Reveal_RevertsConfidenceOutOfRange() public {
        bytes memory value = abi.encode(uint256(1500));
        bytes32 nonce = bytes32("n");
        // Need a commit that hashes a confidence > 10000 to reach the OutOfRange branch
        // strictly before the hash-mismatch branch. Confidence is uint16 so 10001 is valid for hashing.
        uint16 badConf = 10_001;
        bytes32 h = _commitHash(aliceAgentId, CATEGORY, value, badConf, nonce);
        uint256 resBlock = _validResolutionBlock();
        vm.prank(alice);
        uint256 id = market.commit{value: MIN_STAKE}(aliceAgentId, CATEGORY, h, resBlock, bytes32("c"));
        vm.roll(block.number + 20);
        vm.expectRevert(PredictionMarket.ConfidenceOutOfRange.selector);
        market.reveal(id, value, badConf, nonce);
    }

    function test_Reveal_RevertsAlreadyRevealed() public {
        bytes memory value = abi.encode(uint256(1500));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(MIN_STAKE, value, 5000, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 5000, nonce);

        vm.expectRevert(PredictionMarket.InvalidStatusForOperation.selector);
        market.reveal(id, value, 5000, nonce);
    }

    function test_Reveal_RevertsNonexistent() public {
        vm.expectRevert(PredictionMarket.PredictionDoesNotExist.selector);
        market.reveal(999, hex"", 0, bytes32(0));
    }

    // ─── cancel ─────────────────────────────────────────────────────────────────

    function test_Cancel_BeforeResolution_RefundsAndSlashes() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        uint256 aliceBefore = alice.balance;

        vm.prank(alice);
        market.cancel(id);

        // 90% refund, 10% slash
        assertEq(alice.balance - aliceBefore, 0.9 ether);
        assertEq(pool.received(CATEGORY), 0.1 ether);
        assertEq(address(market).balance, 0);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Cancelled));
    }

    function test_Cancel_AfterReveal_Works() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        market.cancel(id);

        assertEq(alice.balance - aliceBefore, 0.9 ether);
        assertEq(pool.received(CATEGORY), 0.1 ether);
    }

    function test_Cancel_RevertsAfterResolutionBlock() public {
        (uint256 id, uint256 resBlock) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.roll(resBlock);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.CancelAfterResolutionBlock.selector);
        market.cancel(id);
    }

    function test_Cancel_RevertsNonController() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NotAgentController.selector);
        market.cancel(id);
    }

    function test_Cancel_RevertsAlreadyResolvedOrCancelled() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.prank(alice);
        market.cancel(id);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.InvalidStatusForOperation.selector);
        market.cancel(id);
    }

    // ─── forfeit ────────────────────────────────────────────────────────────────

    function test_Forfeit_RevertsBeforeWindowExpires() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.roll(block.number + REVEAL_WINDOW_BLOCKS_LIMIT()); // at the boundary
        vm.expectRevert(PredictionMarket.ForfeitWindowNotElapsed.selector);
        market.forfeitUnrevealed(id);
    }

    function REVEAL_WINDOW_BLOCKS_LIMIT() internal view returns (uint256) {
        return market.REVEAL_WINDOW_BLOCKS();
    }

    function test_Forfeit_AfterWindow_PaysCallerAndPool() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.roll(block.number + 101); // > 100
        uint256 carolBefore = carol.balance;

        vm.prank(carol);
        market.forfeitUnrevealed(id);

        // 0.5% to caller, 99.5% to pool
        assertEq(carol.balance - carolBefore, 0.005 ether);
        assertEq(pool.received(CATEGORY), 0.995 ether);
        assertEq(address(market).balance, 0);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Forfeited));
    }

    function test_Forfeit_RevertsAlreadyRevealed() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);
        vm.roll(block.number + 200);
        vm.expectRevert(PredictionMarket.InvalidStatusForOperation.selector);
        market.forfeitUnrevealed(id);
    }

    function test_Forfeit_RevertsBonusPoolUnset() public {
        // Deploy fresh market without bonusPool set.
        PredictionMarket m2 = new PredictionMarket(owner, registry);
        vm.startPrank(owner);
        m2.setScoringEngine(scoringEngine);
        m2.registerCategory(
            CATEGORY, address(0xD11D), address(0x5C09), MIN_STAKE, WINDOW_START, WINDOW_END, CATEGORY_CONFIG
        );
        vm.stopPrank();

        bytes32 h = _commitHash(aliceAgentId, CATEGORY, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.prank(alice);
        uint256 id = m2.commit{value: MIN_STAKE}(aliceAgentId, CATEGORY, h, block.number + 500, bytes32("c"));
        vm.roll(block.number + 101);
        vm.expectRevert(PredictionMarket.BonusPoolNotSet.selector);
        m2.forfeitUnrevealed(id);
    }

    // ─── settleStake ────────────────────────────────────────────────────────────

    function test_SettleStake_HappyPath() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        // 2% resolver, 49% return, 49% bonus (totals 100% = 1 ether)
        uint256 resolverReward = 0.02 ether;
        uint256 returnAmount = 0.49 ether;
        uint256 bonusAmount = 0.49 ether;

        uint256 aliceBefore = alice.balance;
        uint256 resolverBefore = resolverEOA.balance;

        vm.prank(scoringEngine);
        market.settleStake(id, returnAmount, bonusAmount, resolverReward, resolverEOA);

        assertEq(alice.balance - aliceBefore, returnAmount);
        assertEq(resolverEOA.balance - resolverBefore, resolverReward);
        assertEq(pool.received(CATEGORY), bonusAmount);
        assertEq(address(market).balance, 0);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Resolved));
    }

    function test_SettleStake_RevertsNonScoringEngine() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        vm.expectRevert(PredictionMarket.OnlyScoringEngine.selector);
        market.settleStake(id, 0.49 ether, 0.49 ether, 0.02 ether, resolverEOA);
    }

    function test_SettleStake_RevertsBeforeReveal() public {
        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.prank(scoringEngine);
        vm.expectRevert(PredictionMarket.InvalidStatusForOperation.selector);
        market.settleStake(id, 0.49 ether, 0.49 ether, 0.02 ether, resolverEOA);
    }

    function test_SettleStake_RevertsConservationViolation() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        vm.prank(scoringEngine);
        vm.expectRevert(PredictionMarket.StakeConservationViolated.selector);
        market.settleStake(id, 0.5 ether, 0.5 ether, 0.02 ether, resolverEOA); // sums to 1.02
    }

    function test_SettleStake_AllToAgent() public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        // Perfect score: 2% resolver, 98% return, 0% bonus
        uint256 aliceBefore = alice.balance;
        vm.prank(scoringEngine);
        market.settleStake(id, 0.98 ether, 0, 0.02 ether, resolverEOA);
        assertEq(alice.balance - aliceBefore, 0.98 ether);
        assertEq(pool.received(CATEGORY), 0);
    }

    function test_SetScore_OnlyScoringEngine() public {
        (uint256 id,) = _doCommit(MIN_STAKE, abi.encode(uint256(1)), 1, bytes32("n"));

        vm.expectRevert(PredictionMarket.OnlyScoringEngine.selector);
        market.setScore(id, 500_000);

        vm.prank(scoringEngine);
        market.setScore(id, 500_000);
        assertEq(market.getPrediction(id).score, 500_000);
    }

    // ─── reentrancy ─────────────────────────────────────────────────────────────

    function test_Reentrancy_CancelReenteringCommit_Reverts() public {
        ReentrantBonusPool evil = new ReentrantBonusPool(market);
        vm.deal(address(evil), 10 ether);
        evil.configure(aliceAgentId, CATEGORY);

        vm.prank(owner);
        market.setBonusPool(address(evil));

        (uint256 id,) = _doCommit(1 ether, abi.encode(uint256(1)), 1, bytes32("n"));
        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        market.cancel(id);
    }

    // ─── fuzz ───────────────────────────────────────────────────────────────────

    function testFuzz_CommitReveal_RoundTrip(uint256 valueSeed, uint16 confidenceSeed, bytes32 nonce) public {
        uint16 confidence = uint16(uint256(confidenceSeed) % 10001);
        bytes memory value = abi.encode(valueSeed);
        bytes32 h = _commitHash(aliceAgentId, CATEGORY, value, confidence, nonce);
        uint256 resBlock = _validResolutionBlock();

        vm.prank(alice);
        uint256 id = market.commit{value: MIN_STAKE}(aliceAgentId, CATEGORY, h, resBlock, bytes32("c"));

        vm.roll(block.number + 50);
        market.reveal(id, value, confidence, nonce);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Revealed));
        assertEq(p.confidence, confidence);
    }

    function testFuzz_SettleStake_ConservationHolds(uint128 ret, uint128 bonus) public {
        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        (uint256 id,) = _doCommit(1 ether, value, 1, nonce);
        vm.roll(block.number + 15);
        market.reveal(id, value, 1, nonce);

        uint256 resolverReward = 0.02 ether;
        // bound so the sum equals stake
        uint256 stake = 1 ether;
        uint256 available = stake - resolverReward;
        uint256 retAmt = uint256(ret) % (available + 1);
        uint256 bonusAmt = available - retAmt;
        // ignore the `bonus` fuzz parameter (we derive it) — fuzz signature kept for coverage.
        bonus;

        vm.prank(scoringEngine);
        market.settleStake(id, retAmt, bonusAmt, resolverReward, resolverEOA);
        assertEq(address(market).balance, 0);
    }

    receive() external payable {}
}
