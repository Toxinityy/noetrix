// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {BonusDistributor} from "../src/BonusDistributor.sol";
import {ScoringEngine} from "../src/ScoringEngine.sol";
import {RangeCrpsScorer} from "../src/scorers/RangeCrpsScorer.sol";
import {ResolutionEngine} from "../src/ResolutionEngine.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";
import {MethAprResolver} from "../src/resolvers/MethAprResolver.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";
import {SubscriptionGate} from "../src/SubscriptionGate.sol";
import {DemoFeedConsumer} from "../src/examples/DemoFeedConsumer.sol";

import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IMethRateOracle} from "../src/interfaces/IMethRateOracle.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {ISubscriptionGate} from "../src/interfaces/ISubscriptionGate.sol";

/// @notice Full deploy + wire + commit→reveal→resolve round-trip (Prompt 7 smoke test as a
///         deterministic local integration test, since live-chain block advancement can't be
///         scripted). Mirrors Deploy.s.sol wiring.
contract EndToEndTest is Test {
    AgentRegistry registry;
    PredictionMarket market;
    BonusDistributor bonus;
    ScoringEngine scoring;
    RangeCrpsScorer scorer;
    ResolutionEngine resolution;
    MockMethRateOracle methOracle;
    MethAprResolver methResolver;
    CompositeFeed feed;
    SubscriptionGate gate;
    DemoFeedConsumer consumer;

    bytes32 constant METH = keccak256("METH_APR_24H");
    uint256 constant DOMAIN_MIN = 0;
    uint256 constant DOMAIN_MAX = 100_000;
    uint256 constant MIN_STAKE = 0.1 ether;
    uint256 constant STAKE = 1 ether;
    uint256 constant BLOCKS_PER_DAY = 43_200;

    address alice = makeAddr("alice"); // agent controller
    address bob = makeAddr("bob"); // resolver caller

    function setUp() public {
        address deployer = address(this);
        address treasury = makeAddr("treasury");

        registry = new AgentRegistry(deployer, treasury);
        market = new PredictionMarket(deployer, IAgentRegistry(address(registry)));
        bonus = new BonusDistributor(deployer, IAgentRegistry(address(registry)));
        scoring = new ScoringEngine(deployer, IPredictionMarket(address(market)), IAgentRegistry(address(registry)));
        scorer = new RangeCrpsScorer();
        resolution = new ResolutionEngine(deployer, IPredictionMarket(address(market)));
        methOracle = new MockMethRateOracle(deployer);
        methResolver = new MethAprResolver(IMethRateOracle(address(methOracle)));
        feed = new CompositeFeed(deployer);
        gate = new SubscriptionGate(deployer);
        consumer = new DemoFeedConsumer(ICompositeFeed(address(feed)));

        registry.setScoringEngine(address(scoring));
        market.setScoringEngine(address(scoring));
        market.setBonusPool(address(bonus));
        bonus.setAuthorized(address(market), true);
        bonus.setAuthorized(address(scoring), true);
        scoring.setBonusDistributor(address(bonus));
        scoring.setResolutionEngine(address(resolution));
        resolution.setScoringEngine(address(scoring));
        resolution.registerCategory(METH, address(methResolver), address(scorer), abi.encode(DOMAIN_MIN, DOMAIN_MAX));
        market.registerCategory(
            METH, address(methResolver), address(scorer), MIN_STAKE, 300, 500_000, abi.encode(DOMAIN_MIN, DOMAIN_MAX)
        );
        feed.setAgentRegistry(IAgentRegistry(address(registry)));
        feed.setPredictionMarket(IPredictionMarket(address(market)));
        feed.setSubscriptionGate(ISubscriptionGate(address(gate)));

        vm.roll(100_000);
    }

    function test_FullRoundTrip_SettlesPerSpec() public {
        uint256 agentId = _registerAgent();
        (uint256 predId, uint256 resolutionBlock) = _commitAndReveal(agentId);

        vm.roll(resolutionBlock);
        _resolveAndAssertSettlement(predId, resolutionBlock);
        _assertReputationMoved(agentId);
        _assertFeedHasNoActiveContributor();
    }

    // ─── Round-trip steps ────────────────────────────────────────────────────

    function _registerAgent() internal returns (uint256 agentId) {
        vm.deal(alice, MIN_STAKE + STAKE);
        vm.prank(alice);
        agentId = registry.register{value: MIN_STAKE}("ipfs://agent");
        assertEq(registry.controllerOf(agentId), alice);
    }

    function _commitAndReveal(uint256 agentId) internal returns (uint256 predId, uint256 resolutionBlock) {
        uint256 commitBlock = block.number;
        resolutionBlock = commitBlock + 350;
        // Seed mETH oracle: prior @ resolutionBlock-43200, now @ resolutionBlock → aprBps 3650.
        methOracle.setRate(resolutionBlock - BLOCKS_PER_DAY, 1e18);
        methOracle.setRate(resolutionBlock, 1e18 + 1e15);

        uint16 confidence = 8000;
        bytes memory value = abi.encode(uint256(3600), uint256(3700)); // band around the 3650 outcome
        bytes32 nonce = keccak256("nonce");
        bytes32 commitHash = keccak256(abi.encode(agentId, METH, value, confidence, nonce));

        vm.prank(alice);
        predId = market.commit{value: STAKE}(agentId, METH, commitHash, resolutionBlock, bytes32("content"));

        vm.roll(commitBlock + 15);
        vm.prank(alice);
        market.reveal(predId, value, confidence, nonce);
    }

    function _resolveAndAssertSettlement(uint256 predId, uint256 resolutionBlock) internal {
        uint256 resolverBefore = bob.balance;
        uint256 controllerBefore = alice.balance;
        uint256 poolBefore = address(bonus).balance;
        uint256 marketBefore = address(market).balance;
        uint256 epoch = resolutionBlock / bonus.EPOCH_BLOCKS();
        uint256 poolStorageBefore = bonus.pool(METH, epoch);

        vm.prank(bob);
        resolution.resolve(predId);

        IPredictionMarket.Prediction memory p = market.getPrediction(predId);
        assertEq(uint256(p.status), uint256(IPredictionMarket.PredictionStatus.Resolved), "resolved");
        assertGt(p.score, 0, "tight band over correct outcome scores positive");

        uint256 resolverDelta = bob.balance - resolverBefore;
        uint256 controllerDelta = alice.balance - controllerBefore;
        uint256 poolDelta = address(bonus).balance - poolBefore;

        assertEq(resolverDelta, (STAKE * 200) / 10_000, "resolver paid exactly 2%");
        assertEq(resolverDelta + controllerDelta + poolDelta, STAKE, "conservation: all of stake distributed");
        assertEq(marketBefore - address(market).balance, STAKE, "market released full stake");
        assertEq(bonus.pool(METH, epoch) - poolStorageBefore, poolDelta, "slash credited to epoch pool");
    }

    function _assertReputationMoved(uint256 agentId) internal view {
        IAgentRegistry.Reputation memory rep = registry.getReputation(agentId, METH);
        assertEq(rep.resolvedCount, 1, "resolvedCount incremented");
        assertGt(rep.accuracyScore, 0, "accuracy moved positive");
    }

    function _assertFeedHasNoActiveContributor() internal {
        // The single prediction is now Resolved, so it's no longer an active feed contributor.
        feed.refresh(METH);
        (,, uint256 contributors,) = consumer.latest(METH);
        assertEq(contributors, 0, "resolved prediction excluded from feed");
    }
}
