// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {ScoringEngine} from "../src/ScoringEngine.sol";
import {ICategoryScorer} from "../src/interfaces/ICategoryScorer.sol";
import {IBonusDistributor} from "../src/interfaces/IBonusDistributor.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";

/// @notice Deterministic scorer: returns the int256 encoded in the `outcome` bytes. Stays pure so
///         it conforms to ICategoryScorer; lets us test ScoringEngine logic with arbitrary scores
///         without depending on RangeCrpsScorer's specific math.
contract FixedScorer is ICategoryScorer {
    function score(bytes calldata, bytes calldata outcome, uint16, bytes calldata)
        external
        pure
        override
        returns (int256)
    {
        return abi.decode(outcome, (int256));
    }
}

/// @notice BonusDistributor mock that captures notifySlash/recordContribution side-effects.
contract MockBonusDistributor is IBonusDistributor {
    mapping(bytes32 => uint256) public slashed;
    mapping(bytes32 => mapping(uint256 => uint256)) public contribution;

    function notifySlash(bytes32 categoryId) external payable override {
        slashed[categoryId] += msg.value;
    }

    function recordContribution(bytes32 categoryId, uint256 agentId, uint256 share) external override {
        contribution[categoryId][agentId] += share;
    }

    receive() external payable {}
}

contract ScoringEngineTest is Test {
    AgentRegistry internal registry;
    PredictionMarket internal market;
    ScoringEngine internal scoring;
    FixedScorer internal scorer;
    MockBonusDistributor internal pool;

    address internal owner = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal alice = address(0xA1);
    address internal resolverEOA = address(0x5E50);
    // Placeholder for `resolver` slot on the registered category; not invoked here.
    address internal dummyResolver = address(0xD00D);

    uint256 internal aliceAgentId;

    bytes32 internal constant CATEGORY = keccak256("METH_APR_24H");
    uint256 internal constant DOMAIN_MIN = 0;
    uint256 internal constant DOMAIN_MAX = 10_000;
    uint256 internal constant MIN_STAKE = 0.05 ether;
    uint256 internal constant WINDOW_START = 300;
    uint256 internal constant WINDOW_END = 50_000;
    uint256 internal constant STAKE = 1 ether;

    function setUp() public {
        vm.roll(10_000);
        vm.deal(alice, 100 ether);
        vm.deal(resolverEOA, 1 ether);

        registry = new AgentRegistry(owner, treasury);
        market = new PredictionMarket(owner, registry);
        scoring = new ScoringEngine(owner, market, registry);
        scorer = new FixedScorer();
        pool = new MockBonusDistributor();

        vm.startPrank(owner);
        registry.setScoringEngine(address(scoring));
        market.setBonusPool(address(pool));
        market.setScoringEngine(address(scoring));
        scoring.setBonusDistributor(address(pool));
        // The test contract acts as the ResolutionEngine — it directly invokes applyScore.
        scoring.setResolutionEngine(address(this));
        market.registerCategory(
            CATEGORY, dummyResolver, address(scorer), MIN_STAKE, WINDOW_START, WINDOW_END, abi.encode(DOMAIN_MIN, DOMAIN_MAX)
        );
        vm.stopPrank();

        // Register agent alice. Note: `registry.REGISTRATION_FEE()` is a separate external call
        // and would consume the vm.prank — read it first into a local.
        uint256 fee = registry.REGISTRATION_FEE();
        vm.prank(alice);
        aliceAgentId = registry.register{value: fee}("ipfs://alice");
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function _commitAndReveal(uint16 confidence, bytes memory predictionValue, uint256 stake)
        internal
        returns (uint256 predictionId)
    {
        uint256 resolutionBlock = block.number + 500;
        bytes32 nonce = bytes32(uint256(0xC0FFEE));
        bytes32 commitHash = keccak256(abi.encode(aliceAgentId, CATEGORY, predictionValue, confidence, nonce));

        vm.prank(alice);
        predictionId =
            market.commit{value: stake}(aliceAgentId, CATEGORY, commitHash, resolutionBlock, bytes32(uint256(0xC0)));

        vm.roll(block.number + market.REVEAL_DELAY_BLOCKS() + 1);
        vm.prank(alice);
        market.reveal(predictionId, predictionValue, confidence, nonce);

        vm.roll(resolutionBlock);
    }

    function _commitReady(uint16 confidence) internal returns (uint256 predictionId) {
        bytes memory predictionValue = abi.encode(uint256(2_900), uint256(3_100));
        predictionId = _commitAndReveal(confidence, predictionValue, STAKE);
    }

    function _applyFixed(uint256 predictionId, int256 fixedScore) internal {
        // FixedScorer decodes the score from `outcome`.
        scoring.applyScore(
            predictionId, abi.encode(fixedScore), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX), resolverEOA
        );
    }

    /// @dev Snapshots balances BEFORE applyScore (i.e., after the stake is paid in via commit).
    function _applyAndMeasure(int256 fixedScore, uint16 confidence)
        internal
        returns (uint256 predictionId, uint256 aliceDelta, uint256 resolverDelta, uint256 poolDelta)
    {
        predictionId = _commitReady(confidence);
        uint256 aliceBefore = alice.balance;
        uint256 resolverBefore = resolverEOA.balance;
        uint256 poolBefore = address(pool).balance;
        _applyFixed(predictionId, fixedScore);
        aliceDelta = alice.balance - aliceBefore;
        resolverDelta = resolverEOA.balance - resolverBefore;
        poolDelta = address(pool).balance - poolBefore;
    }

    // ─── Stake settlement (hand-verified) ────────────────────────────────────────

    function test_PerfectScore_FullReturn_ZeroSlash_FullContribution() public {
        (uint256 predictionId, uint256 aliceDelta, uint256 resolverDelta, uint256 poolDelta) =
            _applyAndMeasure(1_000_000, 5_000);

        // Expected: resolverReward = 2% = 0.02e18, return = 0.98e18, slash = 0
        uint256 expectedResolver = (STAKE * 200) / 10_000;
        uint256 expectedReturn = STAKE - expectedResolver;

        assertEq(resolverDelta, expectedResolver, "resolver reward");
        assertEq(aliceDelta, expectedReturn, "controller return");
        assertEq(poolDelta, 0, "pool slash = 0");

        // contribShare = (1e6 * 1e6 * stake) / (1e6 * 1e6) = stake
        assertEq(pool.contribution(CATEGORY, aliceAgentId), STAKE, "full contribution");
        assertEq(market.getPrediction(predictionId).score, int256(1_000_000));
    }

    function test_NeutralScore_HalfReturn_HalfSlash_ZeroContribution() public {
        (, uint256 aliceDelta, uint256 resolverDelta, uint256 poolDelta) = _applyAndMeasure(0, 5_000);

        uint256 expectedResolver = (STAKE * 200) / 10_000;
        uint256 remaining = STAKE - expectedResolver;
        uint256 expectedReturn = remaining / 2;
        uint256 expectedSlash = remaining - expectedReturn;

        assertEq(resolverDelta, expectedResolver, "resolver reward");
        assertEq(aliceDelta, expectedReturn, "controller return ~50%");
        assertEq(poolDelta, expectedSlash, "pool slash ~50%");
        assertEq(pool.contribution(CATEGORY, aliceAgentId), 0, "zero contribution at score 0");
    }

    function test_WorstScore_ZeroReturn_FullSlash() public {
        (, uint256 aliceDelta, uint256 resolverDelta, uint256 poolDelta) = _applyAndMeasure(-1_000_000, 5_000);

        uint256 expectedResolver = (STAKE * 200) / 10_000;
        uint256 expectedSlash = STAKE - expectedResolver;

        assertEq(resolverDelta, expectedResolver, "resolver reward");
        assertEq(aliceDelta, 0, "no return at worst score");
        assertEq(poolDelta, expectedSlash, "full slash minus resolver");
        assertEq(pool.contribution(CATEGORY, aliceAgentId), 0, "no contribution for negative score");
    }

    function test_PositiveScore_PartialContribution() public {
        // Score = +500_000 → score_norm = 0.5 → max(0,score_norm)^2 = 0.25 → contribution = 0.25 * stake
        _applyAndMeasure(500_000, 5_000);
        uint256 expectedContrib = STAKE / 4; // 0.25 * STAKE
        assertEq(pool.contribution(CATEGORY, aliceAgentId), expectedContrib);
    }

    function test_StakeConservation_AlwaysEquals(int256 rawScore) public {
        rawScore = bound(rawScore, -1_000_000, 1_000_000);
        (, uint256 aliceDelta, uint256 resolverDelta, uint256 poolDelta) = _applyAndMeasure(rawScore, 5_000);
        assertEq(resolverDelta + aliceDelta + poolDelta, STAKE, "stake conservation");
    }

    // ─── Reputation updates ────────────────────────────────────────────────────

    function test_BucketAccuracy_UpdatesCorrectBucket() public {
        // confidence 5_000 → bucket 5
        _applyAndMeasure(int256(1_000_000), 5_000);
        IAgentRegistry.Reputation memory rep = registry.getReputation(aliceAgentId, CATEGORY);
        assertEq(rep.bucketCount[5], 1, "bucket 5 count incremented");
        for (uint256 i = 0; i < 10; ++i) {
            if (i != 5) assertEq(rep.bucketCount[i], 0, "other buckets unchanged");
        }
        // EMA from 0 with realized=1e6 → (0 + 1e6)/10 = 1e5
        assertEq(rep.bucketAccuracy[5], int256(100_000), "EMA from zero");
    }

    function test_BucketAccuracy_HighConfidenceMapsToBucket9() public {
        _applyAndMeasure(int256(500_000), 9_500); // confidence 9500 → bucket 9
        IAgentRegistry.Reputation memory rep = registry.getReputation(aliceAgentId, CATEGORY);
        assertEq(rep.bucketCount[9], 1);
        // realized = (5e5 + 1e6)/2 = 750_000. EMA from 0 → 75_000.
        assertEq(rep.bucketAccuracy[9], int256(75_000));
    }

    function test_AccuracyEma_DecaysOverMultipleResolutions() public {
        // Apply two perfect scores. EMA(0, 1e6) = 1e5; EMA(1e5, 1e6) = (9*1e5 + 1e6)/10 = 1.9e5.
        _applyAndMeasure(int256(1_000_000), 5_000);
        IAgentRegistry.Reputation memory r1 = registry.getReputation(aliceAgentId, CATEGORY);
        assertEq(r1.accuracyScore, int256(100_000));

        bytes memory predictionValue = abi.encode(uint256(2_900), uint256(3_100));
        uint256 pid = _commitAndReveal(5_000, predictionValue, STAKE);
        scoring.applyScore(
            pid, abi.encode(int256(1_000_000)), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX), resolverEOA
        );
        IAgentRegistry.Reputation memory r2 = registry.getReputation(aliceAgentId, CATEGORY);
        assertEq(r2.accuracyScore, int256(190_000), "EMA second update");
    }

    function test_PredictionStatus_ResolvedAfterApply() public {
        (uint256 predictionId,,,) = _applyAndMeasure(int256(0), 5_000);
        IPredictionMarket.Prediction memory p = market.getPrediction(predictionId);
        assertEq(uint256(p.status), uint256(IPredictionMarket.PredictionStatus.Resolved));
        assertEq(p.score, int256(0));
    }

    // ─── Access control + reverts ───────────────────────────────────────────────

    function test_OnlyResolutionEngine_Reverts() public {
        bytes memory predictionValue = abi.encode(uint256(2_900), uint256(3_100));
        uint256 pid = _commitAndReveal(5_000, predictionValue, STAKE);

        vm.expectRevert(ScoringEngine.NotResolutionEngine.selector);
        vm.prank(alice);
        scoring.applyScore(
            pid, abi.encode(int256(500_000)), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX), resolverEOA
        );
    }

    function test_BonusDistributorNotSet_Reverts() public {
        // Spin up a clean ScoringEngine without bonusDistributor set.
        ScoringEngine fresh = new ScoringEngine(owner, market, registry);
        vm.prank(owner);
        fresh.setResolutionEngine(address(this));

        bytes memory predictionValue = abi.encode(uint256(2_900), uint256(3_100));
        uint256 pid = _commitAndReveal(5_000, predictionValue, STAKE);

        vm.expectRevert(ScoringEngine.BonusDistributorNotSet.selector);
        fresh.applyScore(
            pid, abi.encode(int256(500_000)), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX), resolverEOA
        );
    }

    function test_NotRevealed_Reverts() public {
        // Commit but skip reveal — prediction stays in Committed status.
        uint16 confidence = 5_000;
        uint256 resolutionBlock = block.number + 500;
        bytes memory predictionValue = abi.encode(uint256(2_900), uint256(3_100));
        bytes32 nonce = bytes32(uint256(0xC0FFEE));
        bytes32 commitHash = keccak256(abi.encode(aliceAgentId, CATEGORY, predictionValue, confidence, nonce));
        vm.prank(alice);
        uint256 pid = market.commit{value: STAKE}(aliceAgentId, CATEGORY, commitHash, resolutionBlock, bytes32(uint256(0xC0)));
        vm.roll(resolutionBlock);

        vm.expectRevert(ScoringEngine.PredictionNotRevealed.selector);
        scoring.applyScore(
            pid, abi.encode(int256(500_000)), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX), resolverEOA
        );
    }

    function test_PreviewStakeSplit_MatchesActual() public view {
        (uint256 r, uint256 a, uint256 s) = scoring.previewStakeSplit(STAKE, int256(750_000));
        assertEq(r + a + s, STAKE, "preview conservation");
        // resolver = 2% of stake
        assertEq(r, (STAKE * 200) / 10_000);
        // rateScaled = 5e5 + 750_000/2 = 5e5 + 375_000 = 875_000
        // returned = remaining * 875_000 / 1e6
        uint256 remaining = STAKE - r;
        assertEq(a, (remaining * 875_000) / 1_000_000);
        assertEq(s, remaining - a);
    }

    function test_ScoreClamping_AboveMax() public {
        // FixedScorer returns 2e6 but ScoringEngine should clamp internally to +1e6
        _applyAndMeasure(int256(2_000_000), 5_000);
        // After clamp: score stored should be +1e6, behavior identical to perfect test.
        // Verify via accuracy EMA: from 0, (0 + 1e6)/10 = 1e5
        IAgentRegistry.Reputation memory rep = registry.getReputation(aliceAgentId, CATEGORY);
        assertEq(rep.accuracyScore, int256(100_000));
    }

    function test_ScoreClamping_BelowMin() public {
        _applyAndMeasure(int256(-2_000_000), 5_000);
        IAgentRegistry.Reputation memory rep = registry.getReputation(aliceAgentId, CATEGORY);
        // accuracy EMA: (0 + (-1e6))/10 = -1e5
        assertEq(rep.accuracyScore, int256(-100_000));
    }
}
