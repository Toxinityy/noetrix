// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {CompositeFeed} from "../src/CompositeFeed.sol";
import {DemoFeedConsumer} from "../src/examples/DemoFeedConsumer.sol";
import {YieldAllocator} from "../src/examples/YieldAllocator.sol";
import {RiskManager} from "../src/examples/RiskManager.sol";

import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {ISubscriptionGate} from "../src/interfaces/ISubscriptionGate.sol";

/// @title RedeployFeed — ship the hold-last-good CompositeFeed + its 3 immutable consumers.
/// @notice The live CompositeFeed predates the "hold-last-good on empty refresh" fix: it overwrites the
///         published value with zero whenever every top agent's latest prediction has resolved (i.e. the
///         moment bots pause). This redeploys the FIXED CompositeFeed and ALSO redeploys
///         DemoFeedConsumer / YieldAllocator / RiskManager — each binds the feed as a
///         `ICompositeFeed public immutable feed` with NO setter, so the only way to point them at the new
///         feed is to redeploy them. AgentRegistry / PredictionMarket / SubscriptionGate / resolvers /
///         oracles are untouched and reused from the existing deployments JSON.
///
/// Usage (Mantle Sepolia):
///   forge script script/RedeployFeed.s.sol:RedeployFeed \
///     --rpc-url $MANTLE_SEPOLIA_RPC --private-key $PRIVATE_KEY \
///     --broadcast --verify
///
/// After broadcast it rewrites the 4 changed addresses into deployments/<network>.json (the other 13
/// contract addresses + chainId are read back and preserved), writes the exact env lines to
/// deployments/<network>-redeploy-env.txt, and logs them. Full runbook: docs/DEPLOY.md.
contract RedeployFeed is Script {
    bytes32 internal constant METH_APR_24H = keccak256("METH_APR_24H");
    bytes32 internal constant USDY_APY_24H = keccak256("USDY_APY_24H");

    // RiskManager asset config — must match Deploy.s.sol.
    uint256 internal constant METH_BASE_CF_BPS = 8_000; // 80%
    uint256 internal constant USDY_BASE_CF_BPS = 9_000; // 90% (stablecoin)
    uint256 internal constant ASSET_MAX_CAP = 1_000_000_000 * 1e8; // $1B (USD 8-dec)

    CompositeFeed compositeFeed;
    DemoFeedConsumer demoConsumer;
    YieldAllocator yieldAllocator;
    RiskManager riskManager;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        string memory path = _deploymentsPath();
        string memory cur = vm.readFile(path);
        address agentRegistry = vm.parseJsonAddress(cur, ".AgentRegistry");
        address predictionMarket = vm.parseJsonAddress(cur, ".PredictionMarket");
        address subscriptionGate = vm.parseJsonAddress(cur, ".SubscriptionGate");

        vm.startBroadcast(pk);

        // 1. CompositeFeed (fixed) + wiring (same three deps Deploy.s.sol sets).
        compositeFeed = new CompositeFeed(deployer);
        compositeFeed.setAgentRegistry(IAgentRegistry(agentRegistry));
        compositeFeed.setPredictionMarket(IPredictionMarket(predictionMarket));
        compositeFeed.setSubscriptionGate(ISubscriptionGate(subscriptionGate));

        // 2. Consumers — feed is immutable in each, so they must be redeployed against the new feed.
        demoConsumer = new DemoFeedConsumer(ICompositeFeed(address(compositeFeed)));
        yieldAllocator = new YieldAllocator(ICompositeFeed(address(compositeFeed)), METH_APR_24H, USDY_APY_24H);
        riskManager = new RiskManager(ICompositeFeed(address(compositeFeed)), deployer);
        riskManager.registerAsset(METH_APR_24H, METH_BASE_CF_BPS, ASSET_MAX_CAP);
        riskManager.registerAsset(USDY_APY_24H, USDY_BASE_CF_BPS, ASSET_MAX_CAP);

        vm.stopBroadcast();

        _patchJson(cur, path);
        _writeEnvFile();
        _log(agentRegistry, predictionMarket, subscriptionGate);
    }

    function _deploymentsPath() internal view returns (string memory) {
        string memory net = vm.envOr("DEPLOY_NETWORK", string("mantle-sepolia"));
        return string.concat("deployments/", net, ".json");
    }

    /// @dev Rewrites the file with the 4 changed addresses; the other 13 contract addresses + chainId
    ///      are read back from the existing JSON so nothing else drifts.
    function _patchJson(string memory cur, string memory path) internal {
        string memory key = "redeploy";
        vm.serializeUint(key, "chainId", block.chainid);
        // Preserved (unchanged) entries.
        vm.serializeAddress(key, "AgentRegistry", vm.parseJsonAddress(cur, ".AgentRegistry"));
        vm.serializeAddress(key, "PredictionMarket", vm.parseJsonAddress(cur, ".PredictionMarket"));
        vm.serializeAddress(key, "BonusDistributor", vm.parseJsonAddress(cur, ".BonusDistributor"));
        vm.serializeAddress(key, "ScoringEngine", vm.parseJsonAddress(cur, ".ScoringEngine"));
        vm.serializeAddress(key, "RangeCrpsScorer", vm.parseJsonAddress(cur, ".RangeCrpsScorer"));
        vm.serializeAddress(key, "ResolutionEngine", vm.parseJsonAddress(cur, ".ResolutionEngine"));
        vm.serializeAddress(key, "MockMethRateOracle", vm.parseJsonAddress(cur, ".MockMethRateOracle"));
        vm.serializeAddress(key, "MockAavePool", vm.parseJsonAddress(cur, ".MockAavePool"));
        vm.serializeAddress(key, "MethAprResolver", vm.parseJsonAddress(cur, ".MethAprResolver"));
        vm.serializeAddress(key, "AaveMantleTvlResolver", vm.parseJsonAddress(cur, ".AaveMantleTvlResolver"));
        vm.serializeAddress(key, "SubscriptionGate", vm.parseJsonAddress(cur, ".SubscriptionGate"));
        vm.serializeAddress(key, "UsdyOracle", vm.parseJsonAddress(cur, ".UsdyOracle"));
        vm.serializeAddress(key, "UsdyApyResolver", vm.parseJsonAddress(cur, ".UsdyApyResolver"));
        // Changed (new) entries.
        vm.serializeAddress(key, "CompositeFeed", address(compositeFeed));
        vm.serializeAddress(key, "DemoFeedConsumer", address(demoConsumer));
        vm.serializeAddress(key, "YieldAllocator", address(yieldAllocator));
        string memory json = vm.serializeAddress(key, "RiskManager", address(riskManager));

        vm.writeJson(json, path);
        console2.log("Patched 4 addresses in", path);
    }

    /// @dev Writes the env lines to a file (within the ./deployments fs-write sandbox) so the operator
    ///      can copy them instead of scraping console output mixed with broadcast logs.
    function _writeEnvFile() internal {
        string memory net = vm.envOr("DEPLOY_NETWORK", string("mantle-sepolia"));
        string memory feed = vm.toString(address(compositeFeed));
        string memory body = string.concat(
            "# RedeployFeed output - copy into your env, then REBUILD the frontend + restart the refresher.\n",
            "# frontend/.env (or Vercel env): NEXT_PUBLIC_* are baked at build, so rebuild after editing.\n",
            "NEXT_PUBLIC_ADDR_COMPOSITE_FEED=", feed, "\n",
            "NEXT_PUBLIC_ADDR_DEMO_CONSUMER=", vm.toString(address(demoConsumer)), "\n",
            "NEXT_PUBLIC_ADDR_YIELD_ALLOCATOR=", vm.toString(address(yieldAllocator)), "\n",
            "NEXT_PUBLIC_ADDR_RISK_MANAGER=", vm.toString(address(riskManager)), "\n",
            "# agents/refresher/.env:\n",
            "ADDR_COMPOSITE_FEED=", feed, "\n"
        );
        string memory path = string.concat("deployments/", net, "-redeploy-env.txt");
        vm.writeFile(path, body);
        console2.log("Wrote env patch to", path);
    }

    function _log(address agentRegistry, address predictionMarket, address subscriptionGate) internal view {
        console2.log("=== RedeployFeed: NEW addresses ===");
        console2.log("CompositeFeed    ", address(compositeFeed));
        console2.log("DemoFeedConsumer ", address(demoConsumer));
        console2.log("YieldAllocator   ", address(yieldAllocator));
        console2.log("RiskManager      ", address(riskManager));
        console2.log("--- reused (unchanged) ---");
        console2.log("AgentRegistry    ", agentRegistry);
        console2.log("PredictionMarket ", predictionMarket);
        console2.log("SubscriptionGate ", subscriptionGate);
        console2.log("=== set in frontend/.env then rebuild ===");
        console2.log("NEXT_PUBLIC_ADDR_COMPOSITE_FEED =", address(compositeFeed));
        console2.log("NEXT_PUBLIC_ADDR_DEMO_CONSUMER  =", address(demoConsumer));
        console2.log("NEXT_PUBLIC_ADDR_YIELD_ALLOCATOR=", address(yieldAllocator));
        console2.log("NEXT_PUBLIC_ADDR_RISK_MANAGER   =", address(riskManager));
        console2.log("=== set in agents/refresher/.env ===");
        console2.log("ADDR_COMPOSITE_FEED =", address(compositeFeed));
    }
}
