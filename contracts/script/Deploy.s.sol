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
import {MockAavePool} from "../src/mocks/MockAavePool.sol";
import {MockAToken} from "../src/mocks/MockAToken.sol";
import {MethAprResolver} from "../src/resolvers/MethAprResolver.sol";
import {AaveMantleTvlResolver} from "../src/resolvers/AaveMantleTvlResolver.sol";
import {UsdyApyResolver} from "../src/resolvers/UsdyApyResolver.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";
import {SubscriptionGate} from "../src/SubscriptionGate.sol";
import {DemoFeedConsumer} from "../src/examples/DemoFeedConsumer.sol";
import {YieldAllocator} from "../src/examples/YieldAllocator.sol";
import {RiskManager} from "../src/examples/RiskManager.sol";

import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";
import {MarketStressMonitor} from "../src/examples/MarketStressMonitor.sol";

import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {IMethRateOracle} from "../src/interfaces/IMethRateOracle.sol";
import {IAavePoolLike, IAaveOracleLike} from "../src/interfaces/IAaveLike.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {ISubscriptionGate} from "../src/interfaces/ISubscriptionGate.sol";

/// @title Deploy — full Predictor Index deployment + wiring (PRD §7, Prompt 7)
/// @notice Deploys all 12 contracts in dependency order, wires cross-references, registers the two
///         hackathon categories, and writes addresses to deployments/<network>.json.
///
/// Usage (Mantle Sepolia):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $MANTLE_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify
contract Deploy is Script {
    // Category ids.
    bytes32 internal constant METH_APR_24H = keccak256("METH_APR_24H");
    bytes32 internal constant AAVE_MANTLE_TVL_24H = keccak256("AAVE_MANTLE_TVL_24H");
    bytes32 internal constant USDY_APY_24H = keccak256("USDY_APY_24H");

    // Category config (RangeCrpsScorer domain = abi.encode(domainMin, domainMax), split into 100 buckets).
    uint256 internal constant METH_DOMAIN_MIN = 0;
    uint256 internal constant METH_DOMAIN_MAX = 2_000; // APR bps space, bucket width 20 (realistic mETH ~0–20%)
    uint256 internal constant TVL_DOMAIN_MIN = 0;
    uint256 internal constant TVL_DOMAIN_MAX = 1e17; // USD 8-dec up to ~$1B, bucket width $10M
    uint256 internal constant USDY_DOMAIN_MIN = 0;
    uint256 internal constant USDY_DOMAIN_MAX = 2_000; // APY bps, ~0–20%, bucket width 20

    uint256 internal constant MIN_STAKE = 0.1 ether;
    uint256 internal constant WINDOW_START = 300; // == PredictionMarket.MIN_RESOLUTION_OFFSET
    uint256 internal constant WINDOW_END = 500_000;

    // mETH synthetic curve: ~96 ppm/day → resolved APR ≈ 96 × 3.65 ≈ 350 bps (realistic mETH, fits [0,2000]).
    uint256 internal constant METH_DAILY_GROWTH_PPM = 96;
    // USDY synthetic curve: ~137 ppm/day → resolved APY ≈ 137 × 3.65 ≈ 500 bps (≈5%, matches agent seed).
    uint256 internal constant USDY_DAILY_GROWTH_PPM = 137;
    // anchor = deployBlock − this; must sit below the earliest queried block (first resolutionBlock − 43200).
    uint256 internal constant METH_ANCHOR_LOOKBACK = 50_000;

    // Aave reserve seeds → total TVL ≈ $142M (matches the frontend narrative). Prices are 8-dec USD.
    // Asset addresses are arbitrary unique keys (only used to index the reserve in the mock pool).
    address internal constant AAVE_USDC = 0x0000000000000000000000000000000000000a01;
    address internal constant AAVE_WETH = 0x0000000000000000000000000000000000000a02;

    // Deployed addresses (state vars to dodge stack-too-deep in run()).
    AgentRegistry agentRegistry;
    PredictionMarket predictionMarket;
    BonusDistributor bonusDistributor;
    ScoringEngine scoringEngine;
    RangeCrpsScorer rangeCrpsScorer;
    ResolutionEngine resolutionEngine;
    MockMethRateOracle methOracle;
    MockAavePool aavePool;
    MethAprResolver methAprResolver;
    AaveMantleTvlResolver aaveTvlResolver;
    CompositeFeed compositeFeed;
    SubscriptionGate subscriptionGate;
    DemoFeedConsumer demoConsumer;
    MockMethRateOracle usdyOracle;
    UsdyApyResolver usdyApyResolver;
    YieldAllocator yieldAllocator;
    RiskManager riskManager;
    SentimentOracle sentimentOracle;
    MarketStressMonitor stressMonitor;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        _deploy(deployer);
        _wire();
        vm.stopBroadcast();

        _writeJson();
        _log();
    }

    function _deploy(address deployer) internal {
        // 1. AgentRegistry (treasury = deployer)
        agentRegistry = new AgentRegistry(deployer, deployer);
        // 2. PredictionMarket
        predictionMarket = new PredictionMarket(deployer, IAgentRegistry(address(agentRegistry)));
        // 3. BonusDistributor
        bonusDistributor = new BonusDistributor(deployer, IAgentRegistry(address(agentRegistry)));
        // 4. ScoringEngine (registry + market are constructor immutables)
        scoringEngine =
            new ScoringEngine(deployer, IPredictionMarket(address(predictionMarket)), IAgentRegistry(address(agentRegistry)));
        // 5. RangeCrpsScorer
        rangeCrpsScorer = new RangeCrpsScorer();
        // 6. ResolutionEngine
        resolutionEngine = new ResolutionEngine(deployer, IPredictionMarket(address(predictionMarket)));
        // 7. Mock oracles (v1 archive-RPC substitutes)
        methOracle = new MockMethRateOracle(deployer);
        aavePool = new MockAavePool(deployer);
        // 7a. Seed the mock Aave pool with two reserves so TVL resolves to ≈ $142M (not $0).
        MockAToken aUsdc = new MockAToken(88_000_000 * 1e6, 6); // 88M USDC (6 dec)
        MockAToken aWeth = new MockAToken(18_000 * 1e18, 18); // 18k WETH (18 dec)
        aavePool.addReserve(AAVE_USDC, address(aUsdc), 1e8); // $1.00  → $88M
        aavePool.addReserve(AAVE_WETH, address(aWeth), 3000 * 1e8); // $3,000 → $54M
        // 7b. USDY oracle (reuses the generic rate-oracle mock) + resolver.
        usdyOracle = new MockMethRateOracle(deployer);
        usdyApyResolver = new UsdyApyResolver(IMethRateOracle(address(usdyOracle)));
        // 8. MethAprResolver
        methAprResolver = new MethAprResolver(IMethRateOracle(address(methOracle)));
        // 9. AaveMantleTvlResolver (pool doubles as oracle in the mock)
        aaveTvlResolver =
            new AaveMantleTvlResolver(IAavePoolLike(address(aavePool)), IAaveOracleLike(address(aavePool)));
        // 10. CompositeFeed
        compositeFeed = new CompositeFeed(deployer);
        // 11. SubscriptionGate
        subscriptionGate = new SubscriptionGate(deployer);
        // 12. DemoFeedConsumer
        demoConsumer = new DemoFeedConsumer(ICompositeFeed(address(compositeFeed)));
        // 13. RWA consumers — dynamic yield strategy + automated risk management.
        yieldAllocator = new YieldAllocator(ICompositeFeed(address(compositeFeed)), METH_APR_24H, USDY_APY_24H);
        riskManager = new RiskManager(ICompositeFeed(address(compositeFeed)), deployer);
        // 14. Sentiment oracle + market-stress monitor
        sentimentOracle = new SentimentOracle(deployer);
        stressMonitor =
            new MarketStressMonitor(address(compositeFeed), address(resolutionEngine), address(sentimentOracle), deployer);
    }

    function _wire() internal {
        // Reputation writer.
        agentRegistry.setScoringEngine(address(scoringEngine));

        // Stake settlement + slashing.
        predictionMarket.setScoringEngine(address(scoringEngine));
        predictionMarket.setBonusPool(address(bonusDistributor));

        // Bonus pool inflows allowed from PredictionMarket (slash) + ScoringEngine (contribution).
        bonusDistributor.setAuthorized(address(predictionMarket), true);
        bonusDistributor.setAuthorized(address(scoringEngine), true);

        // ScoringEngine dependencies.
        scoringEngine.setBonusDistributor(address(bonusDistributor));
        scoringEngine.setResolutionEngine(address(resolutionEngine));

        // ResolutionEngine dependencies + category registry (resolver + scorer + domain config).
        resolutionEngine.setScoringEngine(address(scoringEngine));
        resolutionEngine.registerCategory(
            METH_APR_24H, address(methAprResolver), address(rangeCrpsScorer), abi.encode(METH_DOMAIN_MIN, METH_DOMAIN_MAX)
        );
        resolutionEngine.registerCategory(
            AAVE_MANTLE_TVL_24H, address(aaveTvlResolver), address(rangeCrpsScorer), abi.encode(TVL_DOMAIN_MIN, TVL_DOMAIN_MAX)
        );
        resolutionEngine.registerCategory(
            USDY_APY_24H, address(usdyApyResolver), address(rangeCrpsScorer), abi.encode(USDY_DOMAIN_MIN, USDY_DOMAIN_MAX)
        );

        // PredictionMarket category config (stake + reveal window).
        predictionMarket.registerCategory(
            METH_APR_24H,
            address(methAprResolver),
            address(rangeCrpsScorer),
            MIN_STAKE,
            WINDOW_START,
            WINDOW_END,
            abi.encode(METH_DOMAIN_MIN, METH_DOMAIN_MAX)
        );
        predictionMarket.registerCategory(
            AAVE_MANTLE_TVL_24H,
            address(aaveTvlResolver),
            address(rangeCrpsScorer),
            MIN_STAKE,
            WINDOW_START,
            WINDOW_END,
            abi.encode(TVL_DOMAIN_MIN, TVL_DOMAIN_MAX)
        );
        predictionMarket.registerCategory(
            USDY_APY_24H,
            address(usdyApyResolver),
            address(rangeCrpsScorer),
            MIN_STAKE,
            WINDOW_START,
            WINDOW_END,
            abi.encode(USDY_DOMAIN_MIN, USDY_DOMAIN_MAX)
        );

        // mETH oracle synthetic curve so any agent-chosen resolutionBlock resolves to ~350 bps APR.
        uint256 methAnchor = block.number > METH_ANCHOR_LOOKBACK ? block.number - METH_ANCHOR_LOOKBACK : 0;
        methOracle.setSynthetic(methAnchor, 1e18, METH_DAILY_GROWTH_PPM);
        // USDY oracle synthetic curve so any agent-chosen resolutionBlock resolves to ~500 bps APY.
        usdyOracle.setSynthetic(methAnchor, 1e18, USDY_DAILY_GROWTH_PPM);

        // CompositeFeed dependencies.
        compositeFeed.setAgentRegistry(IAgentRegistry(address(agentRegistry)));
        compositeFeed.setPredictionMarket(IPredictionMarket(address(predictionMarket)));
        compositeFeed.setSubscriptionGate(ISubscriptionGate(address(subscriptionGate)));

        // RiskManager asset registry (categoryId → base collateral factor + max deposit cap).
        riskManager.registerAsset(METH_APR_24H, 8_000, 1_000_000_000 * 1e8); // 80% baseCf, $1B cap
        riskManager.registerAsset(USDY_APY_24H, 9_000, 1_000_000_000 * 1e8); // 90% baseCf (stablecoin), $1B cap

        // ── Switch the feed onto the real swarm math + register Monitor configs ───
        // Read the tuned calibration emitted by the backtest.
        string memory calib = vm.readFile("config/swarm-calibration.json");
        _configureCategory(compositeFeed, stressMonitor, calib, "METH_APR", METH_APR_24H);
        _configureCategory(compositeFeed, stressMonitor, calib, "AAVE_TVL", AAVE_MANTLE_TVL_24H);
        _configureCategory(compositeFeed, stressMonitor, calib, "USDY_APY", USDY_APY_24H);

        // Seed a recent Fear & Greed value (replaced live by the keeper). 22 ≈ the recent on-chain window.
        sentimentOracle.setFearGreed(22);
    }

    function _configureCategory(
        CompositeFeed _compositeFeed,
        MarketStressMonitor _stressMonitor,
        string memory calib,
        string memory key,
        bytes32 categoryId
    ) internal {
        string memory base = string.concat("$.categories.", key, ".");
        uint256 domainMin = vm.parseJsonUint(calib, string.concat(base, "domainMin"));
        uint256 domainMax = vm.parseJsonUint(calib, string.concat(base, "domainMax"));
        uint256 disagreeScale = vm.parseJsonUint(calib, string.concat(base, "disagreeScale"));
        uint256 dMed = vm.parseJsonUint(calib, string.concat(base, "dMed"));
        uint256 dHigh = vm.parseJsonUint(calib, string.concat(base, "dHigh"));
        uint256 sMed = vm.parseJsonUint(calib, string.concat(base, "surpriseMed"));
        uint256 sHigh = vm.parseJsonUint(calib, string.concat(base, "surpriseHigh"));

        _compositeFeed.setCategoryBounds(categoryId, domainMin, domainMax, disagreeScale);
        _stressMonitor.setStressConfig(
            categoryId, domainMin, domainMax, uint16(dMed), uint16(dHigh), uint16(sMed), uint16(sHigh)
        );
    }

    function _writeJson() internal {
        string memory net = vm.envOr("DEPLOY_NETWORK", string("mantle-sepolia"));
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "AgentRegistry", address(agentRegistry));
        vm.serializeAddress(key, "PredictionMarket", address(predictionMarket));
        vm.serializeAddress(key, "BonusDistributor", address(bonusDistributor));
        vm.serializeAddress(key, "ScoringEngine", address(scoringEngine));
        vm.serializeAddress(key, "RangeCrpsScorer", address(rangeCrpsScorer));
        vm.serializeAddress(key, "ResolutionEngine", address(resolutionEngine));
        vm.serializeAddress(key, "MockMethRateOracle", address(methOracle));
        vm.serializeAddress(key, "MockAavePool", address(aavePool));
        vm.serializeAddress(key, "MethAprResolver", address(methAprResolver));
        vm.serializeAddress(key, "AaveMantleTvlResolver", address(aaveTvlResolver));
        vm.serializeAddress(key, "CompositeFeed", address(compositeFeed));
        vm.serializeAddress(key, "SubscriptionGate", address(subscriptionGate));
        vm.serializeAddress(key, "DemoFeedConsumer", address(demoConsumer));
        vm.serializeAddress(key, "UsdyOracle", address(usdyOracle));
        vm.serializeAddress(key, "UsdyApyResolver", address(usdyApyResolver));
        vm.serializeAddress(key, "YieldAllocator", address(yieldAllocator));
        vm.serializeAddress(key, "RiskManager", address(riskManager));
        vm.serializeAddress(key, "SentimentOracle", address(sentimentOracle));
        string memory json = vm.serializeAddress(key, "MarketStressMonitor", address(stressMonitor));

        string memory path = string.concat("deployments/", net, ".json");
        vm.writeJson(json, path);
        console2.log("Wrote addresses to", path);
    }

    function _log() internal view {
        console2.log("=== Predictor Index deployment ===");
        console2.log("AgentRegistry        ", address(agentRegistry));
        console2.log("PredictionMarket     ", address(predictionMarket));
        console2.log("BonusDistributor     ", address(bonusDistributor));
        console2.log("ScoringEngine        ", address(scoringEngine));
        console2.log("RangeCrpsScorer      ", address(rangeCrpsScorer));
        console2.log("ResolutionEngine     ", address(resolutionEngine));
        console2.log("MockMethRateOracle   ", address(methOracle));
        console2.log("MockAavePool         ", address(aavePool));
        console2.log("MethAprResolver      ", address(methAprResolver));
        console2.log("AaveMantleTvlResolver", address(aaveTvlResolver));
        console2.log("CompositeFeed        ", address(compositeFeed));
        console2.log("SubscriptionGate     ", address(subscriptionGate));
        console2.log("DemoFeedConsumer     ", address(demoConsumer));
        console2.log("UsdyOracle           ", address(usdyOracle));
        console2.log("UsdyApyResolver      ", address(usdyApyResolver));
        console2.log("YieldAllocator       ", address(yieldAllocator));
        console2.log("RiskManager          ", address(riskManager));
        console2.log("SentimentOracle      ", address(sentimentOracle));
        console2.log("MarketStressMonitor  ", address(stressMonitor));
    }
}
