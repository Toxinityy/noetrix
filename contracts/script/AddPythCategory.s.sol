// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PythSpotResolver} from "../src/resolvers/PythSpotResolver.sol";
import {IPyth} from "../src/interfaces/IPyth.sol";
import {ResolutionEngine} from "../src/ResolutionEngine.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";

/// @notice Standalone: deploys the keeper-snapshot PythSpotResolver and registers the MNT_USD_SPOT
///         category against the ALREADY-DEPLOYED ResolutionEngine / PredictionMarket / RangeCrpsScorer /
///         CompositeFeed. Nothing else is redeployed. Adds one key (`PythSpotResolver`) to
///         deployments/<net>.json, preserving the rest.
///
/// Env:
///   PRIVATE_KEY   deployer (becomes resolver owner)
///   PYTH_ADDRESS  deployed Pyth pull-oracle on this chain (CONFIRM the Mantle Sepolia address)
///   PYTH_FEED_ID  bytes32 price-feed id (MNT/USD 0x4e3037c8…fb0585, confirm via Hermes)
///   KEEPER        (optional) resolver-bot hot wallet allowed to record(); defaults to deployer
///
/// Run:
///   forge script script/AddPythCategory.s.sol:AddPythCategory --rpc-url $MANTLE_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY --broadcast
contract AddPythCategory is Script {
    bytes32 internal constant MNT_USD_SPOT = keccak256("MNT_USD_SPOT");
    uint256 internal constant DOMAIN_MIN = 0;
    uint256 internal constant DOMAIN_MAX = 500_000_000; // $5.00 in 8-dec → $0.05/bucket over 100 buckets

    uint256 internal constant MIN_STAKE = 0.05 ether;
    uint256 internal constant WINDOW_START = 300; // == MIN_RESOLUTION_OFFSET floor
    uint256 internal constant WINDOW_END = 50_000; // ~27h max horizon (short-horizon spot picks ~1800 ≈ 1h)
    // Disagreement scale for the composite feed's uncertainty math. Tunable — set to $0.25 (5% of the
    // $5 domain) until the backtest calibrates it; the leaderboard/scoring path doesn't depend on it.
    uint256 internal constant DISAGREE_SCALE = 25_000_000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address pyth = vm.envAddress("PYTH_ADDRESS");
        bytes32 feedId = vm.envBytes32("PYTH_FEED_ID");
        address keeper = vm.envOr("KEEPER", deployer);

        string memory path = _path();
        string memory cur = vm.readFile(path);
        ResolutionEngine resolutionEngine = ResolutionEngine(vm.parseJsonAddress(cur, ".ResolutionEngine"));
        PredictionMarket predictionMarket = PredictionMarket(vm.parseJsonAddress(cur, ".PredictionMarket"));
        address scorer = vm.parseJsonAddress(cur, ".RangeCrpsScorer");
        CompositeFeed compositeFeed = CompositeFeed(vm.parseJsonAddress(cur, ".CompositeFeed"));

        bytes memory config = abi.encode(DOMAIN_MIN, DOMAIN_MAX);

        vm.startBroadcast(pk);
        PythSpotResolver resolver = new PythSpotResolver(IPyth(pyth), feedId, deployer, keeper);
        resolutionEngine.registerCategory(MNT_USD_SPOT, address(resolver), scorer, config);
        predictionMarket.registerCategory(
            MNT_USD_SPOT, address(resolver), scorer, MIN_STAKE, WINDOW_START, WINDOW_END, config
        );
        compositeFeed.setCategoryBounds(MNT_USD_SPOT, DOMAIN_MIN, DOMAIN_MAX, DISAGREE_SCALE);
        vm.stopBroadcast();

        _patchJson(cur, path, address(resolver));

        console2.log("PythSpotResolver:", address(resolver));
        console2.log("keeper:", keeper);
        console2.log("pyth:", pyth);
        console2.logBytes32(feedId);
        console2.log("MNT_USD_SPOT registered on ResolutionEngine + PredictionMarket + CompositeFeed");
    }

    function _path() internal view returns (string memory) {
        string memory net = vm.envOr("DEPLOY_NETWORK", string("mantle-sepolia"));
        return string.concat("deployments/", net, ".json");
    }

    /// Re-serialize every existing key + the new PythSpotResolver, preserving the file (repo idiom).
    function _patchJson(string memory cur, string memory path, address resolver) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "AaveMantleTvlResolver", vm.parseJsonAddress(cur, ".AaveMantleTvlResolver"));
        vm.serializeAddress(key, "AgentRegistry", vm.parseJsonAddress(cur, ".AgentRegistry"));
        vm.serializeAddress(key, "BonusDistributor", vm.parseJsonAddress(cur, ".BonusDistributor"));
        vm.serializeAddress(key, "CompositeFeed", vm.parseJsonAddress(cur, ".CompositeFeed"));
        vm.serializeAddress(key, "DemoFeedConsumer", vm.parseJsonAddress(cur, ".DemoFeedConsumer"));
        vm.serializeAddress(key, "MarketStressMonitor", vm.parseJsonAddress(cur, ".MarketStressMonitor"));
        vm.serializeAddress(key, "MethAprResolver", vm.parseJsonAddress(cur, ".MethAprResolver"));
        vm.serializeAddress(key, "MockAavePool", vm.parseJsonAddress(cur, ".MockAavePool"));
        vm.serializeAddress(key, "MockMethRateOracle", vm.parseJsonAddress(cur, ".MockMethRateOracle"));
        vm.serializeAddress(key, "PredictionMarket", vm.parseJsonAddress(cur, ".PredictionMarket"));
        vm.serializeAddress(key, "PythSpotResolver", resolver); // the new key
        vm.serializeAddress(key, "RangeCrpsScorer", vm.parseJsonAddress(cur, ".RangeCrpsScorer"));
        vm.serializeAddress(key, "ResolutionEngine", vm.parseJsonAddress(cur, ".ResolutionEngine"));
        vm.serializeAddress(key, "RiskManager", vm.parseJsonAddress(cur, ".RiskManager"));
        vm.serializeAddress(key, "ScoringEngine", vm.parseJsonAddress(cur, ".ScoringEngine"));
        vm.serializeAddress(key, "SentimentOracle", vm.parseJsonAddress(cur, ".SentimentOracle"));
        vm.serializeAddress(key, "SubscriptionGate", vm.parseJsonAddress(cur, ".SubscriptionGate"));
        vm.serializeAddress(key, "UsdyApyResolver", vm.parseJsonAddress(cur, ".UsdyApyResolver"));
        vm.serializeAddress(key, "UsdyOracle", vm.parseJsonAddress(cur, ".UsdyOracle"));
        string memory json = vm.serializeAddress(key, "YieldAllocator", vm.parseJsonAddress(cur, ".YieldAllocator"));
        vm.writeJson(json, path);
        console2.log("Patched", path);
    }
}
