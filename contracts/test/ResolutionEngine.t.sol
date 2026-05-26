// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {ResolutionEngine} from "../src/ResolutionEngine.sol";
import {ICategoryResolver} from "../src/interfaces/ICategoryResolver.sol";
import {IScoringEngine} from "../src/interfaces/IScoringEngine.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IBonusDistributor} from "../src/interfaces/IBonusDistributor.sol";

/// @notice Deterministic resolver: records inputs and returns a canned outcome.
contract MockResolver is ICategoryResolver {
    bytes public lastValue;
    uint256 public lastResolutionBlock;
    bytes public cannedOutcome;
    uint256 public callCount;

    function setOutcome(bytes calldata o) external {
        cannedOutcome = o;
    }

    function resolve(bytes calldata predictionValue, uint256 resolutionBlock)
        external
        view
        returns (bytes memory)
    {
        return cannedOutcome;
    }

    function record(bytes calldata predictionValue, uint256 resolutionBlock) external {
        lastValue = predictionValue;
        lastResolutionBlock = resolutionBlock;
        callCount++;
    }
}

/// @notice Resolver that records via storage write — exercised through `resolve` view path
///         only, so we capture inputs separately via a paired helper call.
contract RecordingResolver is ICategoryResolver {
    bytes public lastValue;
    uint256 public lastResolutionBlock;
    bytes public cannedOutcome;

    function setOutcome(bytes calldata o) external {
        cannedOutcome = o;
    }

    function resolve(bytes calldata predictionValue, uint256 resolutionBlock)
        external
        view
        returns (bytes memory)
    {
        return cannedOutcome;
    }
}

/// @notice ScoringEngine stub that records args and forwards settleStake to PredictionMarket
///         with a fixed 2%/98%/0% split so we can verify the full resolve → settle flow.
contract MockScoringEngine is IScoringEngine {
    PredictionMarket public immutable market;

    uint256 public lastPredictionId;
    bytes public lastOutcome;
    address public lastScorer;
    bytes public lastConfig;
    address public lastResolverCaller;
    uint256 public callCount;

    constructor(PredictionMarket _market) {
        market = _market;
    }

    function applyScore(
        uint256 predictionId,
        bytes calldata outcome,
        address scorer,
        bytes calldata categoryConfig,
        address resolverCaller
    ) external override {
        lastPredictionId = predictionId;
        lastOutcome = outcome;
        lastScorer = scorer;
        lastConfig = categoryConfig;
        lastResolverCaller = resolverCaller;
        callCount++;

        IPredictionMarket.Prediction memory p = market.getPrediction(predictionId);
        uint256 resolverReward = (p.stake * 200) / 10_000; // 2%
        uint256 returnAmount = p.stake - resolverReward;
        market.setScore(predictionId, 500_000);
        market.settleStake(predictionId, returnAmount, 0, resolverReward, resolverCaller);
    }
}

/// @notice Minimal bonus pool — accepts ETH, tracks total per category.
contract NoopBonusPool is IBonusDistributor {
    mapping(bytes32 => uint256) public received;

    function notifySlash(bytes32 categoryId) external payable override {
        received[categoryId] += msg.value;
    }

    receive() external payable {}
}

contract ResolutionEngineTest is Test {
    AgentRegistry internal registry;
    PredictionMarket internal market;
    ResolutionEngine internal engine;
    MockResolver internal resolver;
    MockScoringEngine internal scoring;
    NoopBonusPool internal pool;

    address internal owner = address(0xA11CE);
    address internal treasury = address(0xBEEF);
    address internal alice = address(0xA1);
    address internal bob = address(0xB0B);
    address internal placeholderScorer = address(0x5C09);

    uint256 internal aliceAgentId;

    bytes32 internal constant CATEGORY = keccak256("METH_APR_24H");
    bytes internal constant CATEGORY_CONFIG = hex"deadbeef";
    uint256 internal constant MIN_STAKE = 0.05 ether;
    uint256 internal constant WINDOW_START = 300;
    uint256 internal constant WINDOW_END = 50_000;

    function setUp() public {
        vm.roll(10_000);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        registry = new AgentRegistry(owner, treasury);
        market = new PredictionMarket(owner, registry);
        engine = new ResolutionEngine(owner, market);
        resolver = new MockResolver();
        scoring = new MockScoringEngine(market);
        pool = new NoopBonusPool();

        vm.prank(alice);
        aliceAgentId = registry.register{value: 0.1 ether}("ipfs://alice");

        vm.startPrank(owner);
        market.setBonusPool(address(pool));
        market.setScoringEngine(address(scoring));
        market.registerCategory(
            CATEGORY, address(resolver), placeholderScorer, MIN_STAKE, WINDOW_START, WINDOW_END, CATEGORY_CONFIG
        );
        engine.setScoringEngine(address(scoring));
        engine.registerCategory(CATEGORY, address(resolver), placeholderScorer, CATEGORY_CONFIG);
        vm.stopPrank();

        resolver.setOutcome(abi.encode(uint256(36500))); // canned: 365% APR
    }

    // ─── Admin ──────────────────────────────────────────────────────────────────

    function test_Constructor_RejectsZeroMarket() public {
        vm.expectRevert(ResolutionEngine.ZeroAddress.selector);
        new ResolutionEngine(owner, IPredictionMarket(address(0)));
    }

    function test_RegisterCategory_RevertsDuplicate() public {
        vm.prank(owner);
        vm.expectRevert(ResolutionEngine.CategoryAlreadyRegistered.selector);
        engine.registerCategory(CATEGORY, address(resolver), placeholderScorer, CATEGORY_CONFIG);
    }

    function test_RegisterCategory_RevertsZeroAddresses() public {
        vm.prank(owner);
        vm.expectRevert(ResolutionEngine.ZeroAddress.selector);
        engine.registerCategory(keccak256("OTHER"), address(0), placeholderScorer, CATEGORY_CONFIG);

        vm.prank(owner);
        vm.expectRevert(ResolutionEngine.ZeroAddress.selector);
        engine.registerCategory(keccak256("OTHER"), address(resolver), address(0), CATEGORY_CONFIG);
    }

    function test_RegisterCategory_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        engine.registerCategory(keccak256("OTHER"), address(resolver), placeholderScorer, CATEGORY_CONFIG);
    }

    function test_UpdateCategory_HappyPath() public {
        MockResolver newR = new MockResolver();
        vm.prank(owner);
        engine.updateCategory(CATEGORY, address(newR), placeholderScorer, hex"cafe");
        (address r, address s, bytes memory cfg) = engine.getCategory(CATEGORY);
        assertEq(r, address(newR));
        assertEq(s, placeholderScorer);
        assertEq(cfg, hex"cafe");
    }

    function test_UpdateCategory_RevertsUnregistered() public {
        vm.prank(owner);
        vm.expectRevert(ResolutionEngine.CategoryNotRegistered.selector);
        engine.updateCategory(keccak256("MISSING"), address(resolver), placeholderScorer, hex"");
    }

    function test_SetScoringEngine_RevertsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(ResolutionEngine.ZeroAddress.selector);
        engine.setScoringEngine(address(0));
    }

    // ─── resolve ────────────────────────────────────────────────────────────────

    function test_Resolve_HappyPath_DispatchesAndSettles() public {
        bytes memory value = abi.encode(uint256(1500));
        uint16 confidence = 8000;
        bytes32 nonce = bytes32("n");
        bytes32 commitHash = keccak256(abi.encode(aliceAgentId, CATEGORY, value, confidence, nonce));

        vm.prank(alice);
        uint256 id = market.commit{value: 1 ether}(
            aliceAgentId, CATEGORY, commitHash, block.number + 500, bytes32("c")
        );
        vm.roll(block.number + 15);
        market.reveal(id, value, confidence, nonce);

        vm.roll(market.getPrediction(id).resolutionBlock);

        uint256 bobBefore = bob.balance;
        uint256 aliceBefore = alice.balance;

        vm.prank(bob);
        engine.resolve(id);

        // ScoringEngine received correct args
        assertEq(scoring.callCount(), 1);
        assertEq(scoring.lastPredictionId(), id);
        assertEq(scoring.lastScorer(), placeholderScorer);
        assertEq(scoring.lastConfig(), CATEGORY_CONFIG);
        assertEq(scoring.lastResolverCaller(), bob);
        assertEq(scoring.lastOutcome(), abi.encode(uint256(36500)));

        // Settlement: bob got 2% resolver reward, alice got 98% return
        assertEq(bob.balance - bobBefore, 0.02 ether);
        assertEq(alice.balance - aliceBefore, 0.98 ether);

        IPredictionMarket.Prediction memory p = market.getPrediction(id);
        assertEq(uint8(p.status), uint8(IPredictionMarket.PredictionStatus.Resolved));
        assertEq(p.score, 500_000);
    }

    function test_Resolve_RevertsBeforeResolutionBlock() public {
        uint256 id = _commitReveal(1 ether);
        // resolutionBlock not yet reached
        vm.prank(bob);
        vm.expectRevert(ResolutionEngine.ResolutionBlockNotReached.selector);
        engine.resolve(id);
    }

    function test_Resolve_RevertsAlreadyResolved() public {
        uint256 id = _commitReveal(1 ether);
        vm.roll(market.getPrediction(id).resolutionBlock);
        vm.prank(bob);
        engine.resolve(id);

        vm.prank(bob);
        vm.expectRevert(ResolutionEngine.AlreadyResolved.selector);
        engine.resolve(id);
    }

    function test_Resolve_RevertsUnrevealed() public {
        bytes memory value = abi.encode(uint256(1500));
        bytes32 commitHash = keccak256(abi.encode(aliceAgentId, CATEGORY, value, uint16(5000), bytes32("n")));
        vm.prank(alice);
        uint256 id = market.commit{value: 1 ether}(
            aliceAgentId, CATEGORY, commitHash, block.number + 500, bytes32("c")
        );
        vm.roll(block.number + 600); // past resolutionBlock, but still Committed
        vm.prank(bob);
        vm.expectRevert(ResolutionEngine.PredictionNotRevealed.selector);
        engine.resolve(id);
    }

    function test_Resolve_RevertsScoringEngineUnset() public {
        // Fresh engine without scoringEngine set
        ResolutionEngine e2 = new ResolutionEngine(owner, market);
        vm.prank(bob);
        vm.expectRevert(ResolutionEngine.ScoringEngineNotSet.selector);
        e2.resolve(1);
    }

    function test_Resolve_RevertsCategoryNotRegistered() public {
        // Register an unregistered category in the engine. We have to bypass via market.
        // Easier: build a fresh market+engine where category is registered on market but not engine.
        AgentRegistry reg2 = new AgentRegistry(owner, treasury);
        PredictionMarket m2 = new PredictionMarket(owner, reg2);
        ResolutionEngine e2 = new ResolutionEngine(owner, m2);
        MockScoringEngine s2 = new MockScoringEngine(m2);
        NoopBonusPool p2 = new NoopBonusPool();

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        uint256 aId = reg2.register{value: 0.1 ether}("ipfs://x");

        vm.startPrank(owner);
        m2.setBonusPool(address(p2));
        m2.setScoringEngine(address(s2));
        m2.registerCategory(
            CATEGORY, address(resolver), placeholderScorer, MIN_STAKE, WINDOW_START, WINDOW_END, CATEGORY_CONFIG
        );
        e2.setScoringEngine(address(s2));
        vm.stopPrank();

        bytes memory value = abi.encode(uint256(1));
        bytes32 nonce = bytes32("n");
        bytes32 h = keccak256(abi.encode(aId, CATEGORY, value, uint16(1), nonce));
        vm.prank(alice);
        uint256 id = m2.commit{value: 1 ether}(aId, CATEGORY, h, block.number + 500, bytes32("c"));
        vm.roll(block.number + 15);
        m2.reveal(id, value, 1, nonce);
        vm.roll(m2.getPrediction(id).resolutionBlock);

        vm.prank(bob);
        vm.expectRevert(ResolutionEngine.CategoryNotRegistered.selector);
        e2.resolve(id);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function _commitReveal(uint256 stake) internal returns (uint256 id) {
        bytes memory value = abi.encode(uint256(1));
        uint16 confidence = 5000;
        bytes32 nonce = bytes32("n");
        bytes32 h = keccak256(abi.encode(aliceAgentId, CATEGORY, value, confidence, nonce));
        vm.prank(alice);
        id = market.commit{value: stake}(aliceAgentId, CATEGORY, h, block.number + 500, bytes32("c"));
        vm.roll(block.number + 15);
        market.reveal(id, value, confidence, nonce);
    }

    receive() external payable {}
}
