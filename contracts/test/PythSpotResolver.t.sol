// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {IPyth} from "../src/interfaces/IPyth.sol";
import {MockPyth} from "../src/mocks/MockPyth.sol";
import {PythSpotResolver} from "../src/resolvers/PythSpotResolver.sol";

import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {BonusDistributor} from "../src/BonusDistributor.sol";
import {ScoringEngine} from "../src/ScoringEngine.sol";
import {RangeCrpsScorer} from "../src/scorers/RangeCrpsScorer.sol";
import {ResolutionEngine} from "../src/ResolutionEngine.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";

// Real Pyth MNT/USD feed id (confirmed via Hermes 2026-07-01). Used as the mock's key so intent is
// documented; the mock treats it as an opaque key.
bytes32 constant MNT_USD_FEED = 0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585;

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests: keeper record (normalization + guards) and resolve reads the pinned snapshot
// ─────────────────────────────────────────────────────────────────────────────
contract PythSpotResolverTest is Test {
    MockPyth internal pyth;
    PythSpotResolver internal resolver;

    address internal owner = address(this);
    address internal keeper = makeAddr("keeper");
    uint256 internal constant RB = 500; // a resolution block ≤ current block after the roll below

    function setUp() public {
        pyth = new MockPyth();
        resolver = new PythSpotResolver(IPyth(address(pyth)), MNT_USD_FEED, owner, keeper);
        vm.roll(1_000); // so RB (500) is past the horizon for record()
        vm.warp(1_000_000); // base timestamp
        vm.deal(keeper, 1 ether);
    }

    /// Seed a fresh Pyth price, keeper records it for RB, then read the resolved snapshot.
    function _recordAndResolve(int64 price, uint64 conf, int32 expo) internal returns (uint256) {
        pyth.setPrice(MNT_USD_FEED, price, conf, expo, block.timestamp);
        vm.prank(keeper);
        resolver.record{value: 1}(RB, new bytes[](0));
        return abi.decode(resolver.resolve("", RB), (uint256));
    }

    function _recordExpectStale(uint256 publishTime) internal {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, publishTime);
        vm.prank(keeper);
        vm.expectRevert(MockPyth.StalePrice.selector);
        resolver.record{value: 1}(RB, new bytes[](0));
    }

    function _recordExpectPriceRevert(int64 price, uint64 conf, bytes4 selector) internal {
        pyth.setPrice(MNT_USD_FEED, price, conf, -8, block.timestamp);
        vm.prank(keeper);
        vm.expectRevert(selector);
        resolver.record{value: 1}(RB, new bytes[](0));
    }

    // ─── Normalization to 8-dec USD ──────────────────────────────────────────────

    function test_Normalize_ExpoMinus8() public {
        assertEq(_recordAndResolve(int64(80_000_000), 1000, -8), 80_000_000); // $0.80
    }

    function test_Normalize_ExpoMinus5() public {
        assertEq(_recordAndResolve(int64(80_000), 1000, -5), 80_000_000);
    }

    function test_Normalize_ExpoZero() public {
        // conf 0: at expo 0 a raw price of 1 == $1.00, and any non-zero conf here would be a
        // multi-thousand-percent interval that trips the 5% gate — normalization is the point.
        assertEq(_recordAndResolve(int64(1), 0, 0), 100_000_000); // $1.00
    }

    function test_Normalize_ExpoMinus10() public {
        assertEq(_recordAndResolve(int64(8_000_000_000), 1000, -10), 80_000_000);
    }

    function test_Normalize_EthScale() public {
        assertEq(_recordAndResolve(int64(300_000_000_000), 1_000_000, -8), 300_000_000_000); // $3000
    }

    /// Resolver returns the raw price even above a category domain; RangeCrpsScorer clamps (pipeline).
    function test_OutOfDomainPrice_ReturnsRawValue() public {
        assertEq(_recordAndResolve(int64(600_000_000), 1000, -8), 600_000_000); // $6.00
    }

    // ─── Freshness guard at record (mirrors real Pyth's absolute diff) ────────────

    function test_Record_StaleAtBoundary_Ok() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp - resolver.MAX_AGE());
        vm.prank(keeper);
        resolver.record{value: 1}(RB, new bytes[](0));
        assertEq(abi.decode(resolver.resolve("", RB), (uint256)), 80_000_000);
    }

    function test_Record_StalePastBoundary_Reverts() public {
        _recordExpectStale(block.timestamp - resolver.MAX_AGE() - 1);
    }

    function test_Record_FutureAtBoundary_Ok() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp + resolver.MAX_AGE());
        vm.prank(keeper);
        resolver.record{value: 1}(RB, new bytes[](0));
        assertEq(abi.decode(resolver.resolve("", RB), (uint256)), 80_000_000);
    }

    function test_Record_FutureDatedPastBoundary_Reverts() public {
        _recordExpectStale(block.timestamp + resolver.MAX_AGE() + 1);
    }

    function test_Record_FeedNotFound_Reverts() public {
        vm.prank(keeper);
        vm.expectRevert(MockPyth.PriceFeedNotFound.selector);
        resolver.record{value: 1}(RB, new bytes[](0)); // no price set → publishTime 0
    }

    // ─── Price / confidence guards at record ─────────────────────────────────────

    function test_Record_NegativePrice_Reverts() public {
        _recordExpectPriceRevert(int64(-5), 1000, PythSpotResolver.BadPrice.selector);
    }

    function test_Record_ZeroPrice_Reverts() public {
        _recordExpectPriceRevert(int64(0), 1000, PythSpotResolver.BadPrice.selector);
    }

    /// A wide confidence interval (conf/price > MAX_CONF_BPS) is rejected — real stake is not graded
    /// against a print Pyth itself flags as unreliable.
    function test_Record_WideConfidence_Reverts() public {
        _recordExpectPriceRevert(int64(80_000_000), 5_000_000, PythSpotResolver.LowConfidence.selector); // 6.25%
    }

    /// conf exactly at the MAX_CONF_BPS threshold (5%) is accepted (strict >).
    function test_Record_ConfidenceAtThreshold_Ok() public {
        assertEq(_recordAndResolve(int64(80_000_000), 4_000_000, -8), 80_000_000);
    }

    // ─── Keeper-snapshot properties (the anti-cherry-pick core) ───────────────────

    function test_Record_OnlyKeeper() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        vm.prank(address(0xBAD)); // NotKeeper is checked first, before any fee/value handling
        vm.expectRevert(PythSpotResolver.NotKeeper.selector);
        resolver.record(RB, new bytes[](0));
    }

    function test_Record_BeforeHorizon_Reverts() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        vm.prank(keeper);
        vm.expectRevert(PythSpotResolver.HorizonNotReached.selector);
        resolver.record{value: 1}(2_000, new bytes[](0)); // 2000 > current block 1000
    }

    function test_Resolve_RevertsBeforeRecord() public {
        vm.expectRevert(PythSpotResolver.NotRecorded.selector);
        resolver.resolve("", RB);
    }

    /// First write wins: a second record for the same block reverts, and the pinned value is the
    /// FIRST print — no one can overwrite it with a later, favorable tick.
    function test_Record_FirstWriteWins() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        vm.prank(keeper);
        resolver.record{value: 1}(RB, new bytes[](0));

        pyth.setPrice(MNT_USD_FEED, int64(90_000_000), 1000, -8, block.timestamp); // price drifts
        vm.prank(keeper);
        vm.expectRevert(PythSpotResolver.AlreadyRecorded.selector);
        resolver.record{value: 1}(RB, new bytes[](0));

        assertEq(abi.decode(resolver.resolve("", RB), (uint256)), 80_000_000, "pinned to the first print");
    }

    /// The snapshot is immutable: after recording, moving the live Pyth price does NOT change the
    /// resolved value. This is the whole point — the graded price can't be time-selected.
    function test_Snapshot_ImmutableAgainstLaterPriceMoves() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        vm.prank(keeper);
        resolver.record{value: 1}(RB, new bytes[](0));

        vm.roll(block.number + 100_000);
        vm.warp(block.timestamp + 500_000);
        pyth.setPrice(MNT_USD_FEED, int64(400_000_000), 1000, -8, block.timestamp); // $4.00 now

        assertEq(abi.decode(resolver.resolve("", RB), (uint256)), 80_000_000, "still the pinned $0.80");
    }

    // ─── Fee handling ────────────────────────────────────────────────────────────

    function test_Record_InsufficientFee_Reverts() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        bytes[] memory data = new bytes[](1); // one update → fee 1, so value 0 underpays
        data[0] = hex"00";
        vm.prank(keeper);
        vm.expectRevert(PythSpotResolver.InsufficientFee.selector);
        resolver.record{value: 0}(RB, data);
    }

    function test_Record_RefundsExcess() public {
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1000, -8, block.timestamp);
        bytes[] memory data = new bytes[](1);
        data[0] = hex"00"; // non-empty → updatePriceFeeds consumes the 1-wei fee
        uint256 before = keeper.balance;
        vm.prank(keeper);
        resolver.record{value: 5}(RB, data);
        assertEq(before - keeper.balance, 1, "only the 1-wei fee spent; 4 refunded");
    }

    // ─── Admin / constructor guards ──────────────────────────────────────────────

    function test_Constructor_RejectsZeroPyth() public {
        vm.expectRevert(bytes("pyth=0"));
        new PythSpotResolver(IPyth(address(0)), MNT_USD_FEED, owner, keeper);
    }

    function test_Constructor_RejectsZeroFeedId() public {
        vm.expectRevert(bytes("feedId=0"));
        new PythSpotResolver(IPyth(address(pyth)), bytes32(0), owner, keeper);
    }

    function test_SetKeeper_OnlyOwner() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(); // Ownable
        resolver.setKeeper(address(0x1234));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline: register → commit → reveal → keeper records the live price → resolve → CRPS score
// Proves the graded truth is the pinned live-oracle value and that timing/drift cannot game it.
// ─────────────────────────────────────────────────────────────────────────────
contract PythSpotPipelineTest is Test {
    AgentRegistry registry;
    PredictionMarket market;
    BonusDistributor bonus;
    ScoringEngine scoring;
    RangeCrpsScorer scorer;
    ResolutionEngine resolution;
    MockPyth pyth;
    PythSpotResolver resolver;

    bytes32 constant CATEGORY = keccak256("MNT_USD_SPOT");
    uint256 constant DOMAIN_MIN = 0;
    uint256 constant DOMAIN_MAX = 500_000_000; // $5.00 in 8-dec → w = 5_000_000 ($0.05/bucket)
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant STAKE = 1 ether;

    address alice = makeAddr("alice"); // agent A controller
    address carol = makeAddr("carol"); // agent B controller
    address bob = makeAddr("bob"); // resolver caller
    address keeper = makeAddr("keeper"); // snapshot recorder

    function setUp() public {
        address deployer = address(this);
        address treasury = makeAddr("treasury");

        registry = new AgentRegistry(deployer, treasury);
        market = new PredictionMarket(deployer, IAgentRegistry(address(registry)));
        bonus = new BonusDistributor(deployer, IAgentRegistry(address(registry)));
        scoring = new ScoringEngine(deployer, IPredictionMarket(address(market)), IAgentRegistry(address(registry)));
        scorer = new RangeCrpsScorer();
        resolution = new ResolutionEngine(deployer, IPredictionMarket(address(market)));
        pyth = new MockPyth();
        resolver = new PythSpotResolver(IPyth(address(pyth)), MNT_USD_FEED, deployer, keeper);

        registry.setScoringEngine(address(scoring));
        market.setScoringEngine(address(scoring));
        market.setBonusPool(address(bonus));
        bonus.setAuthorized(address(market), true);
        bonus.setAuthorized(address(scoring), true);
        scoring.setBonusDistributor(address(bonus));
        scoring.setResolutionEngine(address(resolution));
        resolution.setScoringEngine(address(scoring));
        resolution.registerCategory(CATEGORY, address(resolver), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX));
        market.registerCategory(
            CATEGORY, address(resolver), address(scorer), MIN_STAKE, 300, 500_000, abi.encode(DOMAIN_MIN, DOMAIN_MAX)
        );

        vm.roll(100_000);
        vm.warp(1_000_000);
        vm.deal(keeper, 1 ether);
    }

    function _register(address controller) internal returns (uint256 agentId) {
        vm.deal(controller, 10 ether);
        vm.prank(controller);
        agentId = registry.register{value: MIN_STAKE}("ipfs://agent");
    }

    function _commitReveal(uint256 agentId, address controller, uint256 low, uint256 high)
        internal
        returns (uint256 predId, uint256 resolutionBlock)
    {
        uint256 commitBlock = block.number;
        resolutionBlock = commitBlock + 350;
        uint16 confidence = 8000;
        bytes memory value = abi.encode(low, high);
        bytes32 nonce = keccak256(abi.encode(agentId, commitBlock));
        bytes32 commitHash = keccak256(abi.encode(agentId, CATEGORY, value, confidence, nonce));

        vm.prank(controller);
        predId = market.commit{value: STAKE}(agentId, CATEGORY, commitHash, resolutionBlock, bytes32("content"));

        vm.roll(commitBlock + 15);
        vm.prank(controller);
        market.reveal(predId, value, confidence, nonce);
    }

    /// Keeper pins the current Pyth price as the immutable snapshot for `rb` (horizon must be reached).
    function _keeperRecord(uint256 rb) internal {
        vm.prank(keeper);
        resolver.record{value: 1}(rb, new bytes[](0));
    }

    /// The core proof: a tight band over the pinned live price scores positive, settlement conserves.
    function test_ResolvesAgainstLivePythPrice_TightBandScoresPositive() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);

        vm.roll(resolutionBlock);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1_000_000, -8, block.timestamp);
        _keeperRecord(resolutionBlock); // keeper pins $0.80

        uint256 resolverBefore = bob.balance;
        uint256 controllerBefore = alice.balance;
        uint256 poolBefore = address(bonus).balance;

        vm.prank(bob);
        resolution.resolve(predId);

        IPredictionMarket.Prediction memory p = market.getPrediction(predId);
        assertEq(uint256(p.status), uint256(IPredictionMarket.PredictionStatus.Resolved), "resolved");
        assertGt(p.score, 0, "tight band over the pinned price scores positive");

        uint256 resolverDelta = bob.balance - resolverBefore;
        uint256 controllerDelta = alice.balance - controllerBefore;
        uint256 poolDelta = address(bonus).balance - poolBefore;
        assertEq(resolverDelta, (STAKE * 200) / 10_000, "resolver paid exactly 2%");
        assertEq(resolverDelta + controllerDelta + poolDelta, STAKE, "stake fully conserved");

        IAgentRegistry.Reputation memory rep = registry.getReputation(agentId, CATEGORY);
        assertEq(rep.resolvedCount, 1, "resolvedCount incremented");
        assertGt(rep.accuracyScore, 0, "accuracy moved positive");
    }

    /// The scorer discriminates on the real pinned price: a far-off band scores worse than a tight one.
    function test_ScorerDiscriminatesOnRealPrice() public {
        uint256 agentTight = _register(alice);
        uint256 agentFar = _register(carol);
        (uint256 tightId, uint256 rb1) = _commitReveal(agentTight, alice, 78_000_000, 82_000_000);
        (uint256 farId, uint256 rb2) = _commitReveal(agentFar, carol, 10_000_000, 14_000_000);

        vm.roll(rb1 > rb2 ? rb1 : rb2);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1_000_000, -8, block.timestamp);
        _keeperRecord(rb1);
        _keeperRecord(rb2);

        vm.prank(bob);
        resolution.resolve(tightId);
        vm.prank(bob);
        resolution.resolve(farId);

        assertGt(
            market.getPrediction(tightId).score,
            market.getPrediction(farId).score,
            "band near the real price beats a far-off band"
        );
    }

    /// THE FIX (finding #1): once the keeper pins the snapshot at the horizon, resolution timing and
    /// later price drift are irrelevant. Resolving 10k blocks late with the live price now $4.00 still
    /// grades the tight $0.80 band against the pinned $0.80 → near-max score, not the drift.
    function test_SnapshotPinned_TimingAndDriftIrrelevant() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);

        vm.roll(resolutionBlock);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1_000_000, -8, block.timestamp);
        _keeperRecord(resolutionBlock); // pin $0.80 at the horizon

        // Much later, price has drifted far and blocks advanced.
        vm.roll(resolutionBlock + 10_000);
        vm.warp(block.timestamp + 100_000);
        pyth.setPrice(MNT_USD_FEED, int64(400_000_000), 1_000_000, -8, block.timestamp); // $4.00 now

        vm.prank(bob);
        resolution.resolve(predId);

        assertGt(market.getPrediction(predId).score, 900_000, "graded pinned $0.80 (near-max), not drifted $4.00");
    }

    /// A pinned price ABOVE the domain ceiling clamps to the top bucket; a near-ceiling band beats a
    /// far-low band (finding #5).
    function test_OutOfDomainPrice_ScorerClampsAndDiscriminates() public {
        uint256 nearTop = _register(alice);
        uint256 low = _register(carol);
        (uint256 topId, uint256 rb1) = _commitReveal(nearTop, alice, 480_000_000, 500_000_000);
        (uint256 lowId, uint256 rb2) = _commitReveal(low, carol, 10_000_000, 30_000_000);

        vm.roll(rb1 > rb2 ? rb1 : rb2);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(600_000_000), 1_000_000, -8, block.timestamp); // $6.00 > ceiling
        _keeperRecord(rb1);
        _keeperRecord(rb2);

        vm.prank(bob);
        resolution.resolve(topId);
        vm.prank(bob);
        resolution.resolve(lowId);

        assertGt(
            market.getPrediction(topId).score,
            market.getPrediction(lowId).score,
            "band near the clamped ceiling beats a far-low band"
        );
    }

    /// Keeper outage: a stale price at the horizon can't be recorded, resolve is unavailable
    /// (NotRecorded), and the agent reclaims full stake via the void escape after the delay.
    function test_UnrecordedThenVoid_RefundsFullStake() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);

        vm.roll(resolutionBlock);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1_000_000, -8, block.timestamp - 200); // stale
        vm.prank(keeper);
        vm.expectRevert(MockPyth.StalePrice.selector);
        resolver.record{value: 1}(resolutionBlock, new bytes[](0));

        vm.prank(bob);
        vm.expectRevert(PythSpotResolver.NotRecorded.selector);
        resolution.resolve(predId);

        uint256 balBefore = alice.balance;
        vm.roll(resolutionBlock + market.VOID_DELAY_BLOCKS() + 1);
        vm.prank(alice);
        market.voidExpired(predId);
        assertEq(alice.balance - balBefore, STAKE, "full stake refunded on void");
    }

    /// Void safety-valve boundary + terminal state.
    function test_VoidExpired_RefundsFullStakeAfterWindow() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);
        uint256 balBefore = alice.balance;

        vm.roll(resolutionBlock + market.VOID_DELAY_BLOCKS());
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.VoidWindowNotElapsed.selector);
        market.voidExpired(predId);

        vm.roll(resolutionBlock + market.VOID_DELAY_BLOCKS() + 1);
        vm.prank(alice);
        market.voidExpired(predId);

        assertEq(alice.balance - balBefore, STAKE, "full stake refunded, no slash");
        IPredictionMarket.Prediction memory p = market.getPrediction(predId);
        assertEq(uint256(p.status), uint256(IPredictionMarket.PredictionStatus.Cancelled), "voided -> cancelled");
        assertEq(p.score, 0, "no score on void");
    }

    /// Only the agent's controller can void its stuck prediction — no third-party interference.
    function test_VoidExpired_OnlyController() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);
        vm.roll(resolutionBlock + market.VOID_DELAY_BLOCKS() + 1);
        vm.prank(bob); // not the controller
        vm.expectRevert(PredictionMarket.NotAgentController.selector);
        market.voidExpired(predId);
    }

    /// A RECORDED (resolvable) prediction cannot be voided even past the void window — void is only a
    /// genuine-outage escape, not a costless "heads I resolve, tails I void" opt-out that would let an
    /// agent dodge the slash + reputation hit on a losing forecast. It must be resolved instead.
    function test_VoidExpired_RevertsWhenResolvable() public {
        uint256 agentId = _register(alice);
        (uint256 predId, uint256 resolutionBlock) = _commitReveal(agentId, alice, 78_000_000, 82_000_000);

        vm.roll(resolutionBlock);
        vm.warp(2_000_000);
        pyth.setPrice(MNT_USD_FEED, int64(80_000_000), 1_000_000, -8, block.timestamp);
        _keeperRecord(resolutionBlock); // snapshot pinned → outcome available

        vm.roll(resolutionBlock + market.VOID_DELAY_BLOCKS() + 1);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.OutcomeAvailable.selector);
        market.voidExpired(predId);

        // It still resolves normally — the stake is scored/settled, not refunded.
        vm.prank(bob);
        resolution.resolve(predId);
        assertEq(
            uint256(market.getPrediction(predId).status),
            uint256(IPredictionMarket.PredictionStatus.Resolved),
            "a resolvable prediction resolves, never voids"
        );
    }
}
