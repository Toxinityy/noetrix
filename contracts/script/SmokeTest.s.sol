// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {AgentRegistry} from "../src/AgentRegistry.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {BonusDistributor} from "../src/BonusDistributor.sol";
import {ScoringEngine} from "../src/ScoringEngine.sol";
import {RangeCrpsScorer} from "../src/scorers/RangeCrpsScorer.sol";
import {ResolutionEngine} from "../src/ResolutionEngine.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";
import {MethAprResolver} from "../src/resolvers/MethAprResolver.sol";

import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IMethRateOracle} from "../src/interfaces/IMethRateOracle.sol";

/// @title SmokeTest — full commit→reveal→resolve round-trip with state logging (Prompt 7 Part D)
/// @notice Self-contained: deploys + wires the scoring-path contracts, then runs the round-trip using
///         block cheatcodes, asserting §7.2.4 settlement. Runnable with no live credentials:
///           forge script script/SmokeTest.s.sol:SmokeTest
///         (Live Mantle Sepolia can't be scripted in one shot because reveal/resolve are ~350 blocks
///          apart; for a live walk-through, drive the deployed contracts tx-by-tx with `cast`.)
contract SmokeTest is Script {
    bytes32 internal constant METH = keccak256("METH_APR_24H");
    uint256 internal constant DOMAIN_MIN = 0;
    uint256 internal constant DOMAIN_MAX = 100_000;
    uint256 internal constant MIN_STAKE = 0.1 ether;
    uint256 internal constant STAKE = 1 ether;
    uint256 internal constant BLOCKS_PER_DAY = 43_200;

    AgentRegistry registry;
    PredictionMarket market;
    BonusDistributor bonus;
    ScoringEngine scoring;
    RangeCrpsScorer scorer;
    ResolutionEngine resolution;
    MockMethRateOracle methOracle;
    MethAprResolver methResolver;

    address internal deployer = address(0xD3910769);
    address internal agentCtrl = address(0xA11CE);
    address internal resolver = address(0xB0B);
    address internal treasury = address(0x7EE);

    function run() external {
        vm.startPrank(deployer);
        _deployAndWire();
        vm.stopPrank();

        vm.roll(100_000);

        // 1. Register agent.
        vm.deal(agentCtrl, MIN_STAKE + STAKE);
        vm.prank(agentCtrl);
        uint256 agentId = registry.register{value: MIN_STAKE}("ipfs://smoke-agent");
        console2.log("Registered agentId:", agentId);

        // 2. Seed oracle + commit.
        uint256 commitBlock = block.number;
        uint256 resolutionBlock = commitBlock + 350;
        vm.startPrank(deployer);
        methOracle.setRate(resolutionBlock - BLOCKS_PER_DAY, 1e18);
        methOracle.setRate(resolutionBlock, 1e18 + 1e15); // aprBps = 3650
        vm.stopPrank();

        uint16 confidence = 8000;
        bytes memory value = abi.encode(uint256(3600), uint256(3700));
        bytes32 nonce = keccak256("smoke-nonce");
        bytes32 commitHash = keccak256(abi.encode(agentId, METH, value, confidence, nonce));

        vm.prank(agentCtrl);
        uint256 predId = market.commit{value: STAKE}(agentId, METH, commitHash, resolutionBlock, bytes32("smoke"));
        console2.log("Committed predId:", predId, "resolutionBlock:", resolutionBlock);

        // 3. Reveal in window.
        vm.roll(commitBlock + 15);
        vm.prank(agentCtrl);
        market.reveal(predId, value, confidence, nonce);
        console2.log("Revealed at block:", block.number);

        // 4. Resolve.
        vm.roll(resolutionBlock);
        uint256 resolverBefore = resolver.balance;
        uint256 ctrlBefore = agentCtrl.balance;
        uint256 poolBefore = address(bonus).balance;
        uint256 epoch = resolutionBlock / bonus.EPOCH_BLOCKS();

        vm.prank(resolver);
        resolution.resolve(predId);

        // 5. Report state changes.
        IPredictionMarket.Prediction memory p = market.getPrediction(predId);
        IAgentRegistry.Reputation memory rep = registry.getReputation(agentId, METH);

        uint256 resolverReward = resolver.balance - resolverBefore;
        uint256 returned = agentCtrl.balance - ctrlBefore;
        uint256 slashed = address(bonus).balance - poolBefore;

        console2.log("--- State after resolve ---");
        console2.log("status (3=Resolved enum 2):", uint256(p.status));
        console2.log("score:", vm.toString(p.score));
        console2.log("resolvedCount:", rep.resolvedCount);
        console2.log("accuracyScore:", vm.toString(rep.accuracyScore));
        console2.log("resolver reward (2%):", resolverReward);
        console2.log("returned to agent:", returned);
        console2.log("slashed to pool:", slashed);
        console2.log("epoch:", epoch, "pool[epoch]:", bonus.pool(METH, epoch));

        require(p.status == IPredictionMarket.PredictionStatus.Resolved, "not resolved");
        require(rep.resolvedCount == 1, "reputation not updated");
        require(resolverReward == (STAKE * 200) / 10_000, "resolver != 2%");
        require(resolverReward + returned + slashed == STAKE, "conservation violated");
        console2.log("SMOKE TEST PASSED");
    }

    function _deployAndWire() internal {
        address d = deployer;
        registry = new AgentRegistry(d, treasury);
        market = new PredictionMarket(d, IAgentRegistry(address(registry)));
        bonus = new BonusDistributor(d, IAgentRegistry(address(registry)));
        scoring = new ScoringEngine(d, IPredictionMarket(address(market)), IAgentRegistry(address(registry)));
        scorer = new RangeCrpsScorer();
        resolution = new ResolutionEngine(d, IPredictionMarket(address(market)));
        methOracle = new MockMethRateOracle(d);
        methResolver = new MethAprResolver(IMethRateOracle(address(methOracle)));

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
    }
}
