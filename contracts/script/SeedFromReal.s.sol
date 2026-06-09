// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";

/// @title SeedFromReal -- seed on-chain oracles from the committed real market data
///
/// @notice Reads the latest data point from the committed JSON snapshots in
///         agents/market-data/data/ and calls:
///           1. SentimentOracle.setFearGreed(latestFearGreed)
///           2. MockMethRateOracle.setSynthetic(anchor, 1e18, methPpm) -- mETH oracle
///           3. MockMethRateOracle.setSynthetic(anchor, 1e18, usdyPpm) -- USDY oracle
///         so that the resolved APRs approximate the latest real data.
///
///         The ppm mapping: ppm ~= latestBps / 3.65
///         (because resolvedApr ~= ppm * 3.65 bps at daily compound rate).
///
/// @dev Idempotent -- re-running overwrites the synthetic curves with the same values.
///      Requires a prior Deploy.s.sol run that wrote deployments/<DEPLOY_NETWORK>.json.
///      Uses FFI + jq to extract the last point value from each JSON file efficiently.
///      ffi = true must be set in foundry.toml (it is).
///
/// Usage (Mantle Sepolia, after Deploy):
///   forge script script/SeedFromReal.s.sol:SeedFromReal \
///     --rpc-url $MANTLE_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast
///
/// Dry-run (no keys needed -- simulation only):
///   forge script script/SeedFromReal.s.sol:SeedFromReal --sig "run()"
contract SeedFromReal is Script {
    using stdJson for string;

    // Path constants (relative to the contracts/ directory where forge runs).
    string internal constant FEAR_GREED_PATH = "../agents/market-data/data/FEAR_GREED.json";
    string internal constant METH_APR_PATH = "../agents/market-data/data/METH_APR.json";
    string internal constant USDY_APY_PATH = "../agents/market-data/data/USDY_APY.json";

    // Resolved APR in bps ~= dailyGrowthPpm * 3.65.
    // Invert: ppm = latestBps * 100 / 365 (integer arithmetic, rounds down).
    uint256 internal constant BPS_TO_PPM_NUM = 100;
    uint256 internal constant BPS_TO_PPM_DEN = 365;

    // Fallback values (from last known data as of 2026-06-08).
    // Used when FFI is unavailable or the JSON parse fails.
    uint256 internal constant FALLBACK_FEAR_GREED = 8; // extreme fear
    uint256 internal constant FALLBACK_METH_BPS = 211; // ~2.11% APR
    uint256 internal constant FALLBACK_USDY_BPS = 355; // ~3.55% APY

    // Anchor lookback: the synthetic curve must sit below the earliest queried block
    // (first resolutionBlock - 43200, roughly one day behind current block).
    uint256 internal constant ANCHOR_LOOKBACK = 50_000;

    function run() external {
        // -- 1. Load the deployments JSON -----------------------------------------
        string memory net = vm.envOr("DEPLOY_NETWORK", string("mantle-sepolia"));
        string memory depPath = string.concat("deployments/", net, ".json");

        string memory dep = vm.readFile(depPath);
        address sentimentOracleAddr = dep.readAddress(".SentimentOracle");
        address methOracleAddr = dep.readAddress(".MockMethRateOracle");
        address usdyOracleAddr = dep.readAddress(".UsdyOracle");

        // -- 2. Parse the latest values from the committed JSON files --------------
        // Uses FFI + jq to extract the last point value efficiently.
        uint256 latestFearGreed = _latestValueFfi(FEAR_GREED_PATH, FALLBACK_FEAR_GREED);
        uint256 latestMethBps = _latestValueFfi(METH_APR_PATH, FALLBACK_METH_BPS);
        uint256 latestUsdyBps = _latestValueFfi(USDY_APY_PATH, FALLBACK_USDY_BPS);

        // Clamp Fear & Greed to [0, 100] (uint8 range).
        if (latestFearGreed > 100) latestFearGreed = 100;

        // Compute synthetic curve ppm from real bps.
        uint256 methPpm = latestMethBps > 0 ? (latestMethBps * BPS_TO_PPM_NUM) / BPS_TO_PPM_DEN : 58;
        uint256 usdyPpm = latestUsdyBps > 0 ? (latestUsdyBps * BPS_TO_PPM_NUM) / BPS_TO_PPM_DEN : 97;
        // Ensure at least 1 ppm so the synthetic curve is not flat.
        if (methPpm == 0) methPpm = 1;
        if (usdyPpm == 0) usdyPpm = 1;

        // Anchor: safely behind the earliest resolution block.
        uint256 anchor = block.number > ANCHOR_LOOKBACK ? block.number - ANCHOR_LOOKBACK : 0;

        // -- 3. Log computed seed values -----------------------------------------
        console2.log("=== SeedFromReal ===");
        console2.log("Network            :", net);
        console2.log("SentimentOracle    :", sentimentOracleAddr);
        console2.log("MockMethRateOracle :", methOracleAddr);
        console2.log("UsdyOracle         :", usdyOracleAddr);
        console2.log("Latest Fear&Greed  :", latestFearGreed);
        console2.log("Latest mETH APR bps:", latestMethBps);
        console2.log("  => methPpm       :", methPpm);
        console2.log("Latest USDY APY bps:", latestUsdyBps);
        console2.log("  => usdyPpm       :", usdyPpm);
        console2.log("Anchor block       :", anchor);

        // -- 4. Broadcast the seed transactions ----------------------------------
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        // 4a. Fear & Greed -> SentimentOracle
        // forge-lint: disable-next-line(unsafe-typecast)
        SentimentOracle(sentimentOracleAddr).setFearGreed(uint8(latestFearGreed));
        console2.log("setFearGreed done:", latestFearGreed);

        // 4b. mETH synthetic curve: resolved APR ~= methPpm * 3.65 bps
        MockMethRateOracle(methOracleAddr).setSynthetic(anchor, 1e18, methPpm);
        console2.log("mETH setSynthetic done, ppm:", methPpm);

        // 4c. USDY synthetic curve: resolved APY ~= usdyPpm * 3.65 bps
        MockMethRateOracle(usdyOracleAddr).setSynthetic(anchor, 1e18, usdyPpm);
        console2.log("USDY setSynthetic done, ppm:", usdyPpm);

        vm.stopBroadcast();

        console2.log("=== SeedFromReal complete ===");
    }

    /// @dev Use FFI (jq) to extract the LAST point value from a market-data JSON file.
    ///      The JSON shape is {"metric":"...","points":[{"ts":N,"value":N},...]}
    ///      Falls back to `fallback_` if the FFI call fails.
    function _latestValueFfi(string memory filePath, uint256 fallback_) internal returns (uint256) {
        // jq query: get last point's value field
        string[] memory cmd = new string[](3);
        cmd[0] = "jq";
        cmd[1] = ".points[-1].value";
        cmd[2] = filePath;

        try vm.ffi(cmd) returns (bytes memory result) {
            if (result.length == 0) return fallback_;
            // result is a UTF-8 string of the decimal number (possibly with a newline)
            uint256 val = _parseDecimal(result);
            return val;
        } catch {
            console2.log("FFI jq failed for", filePath, "-- using fallback:", fallback_);
            return fallback_;
        }
    }

    /// @dev Parse a decimal ASCII byte array (as returned by ffi) to uint256.
    ///      Strips leading/trailing whitespace and newlines.
    function _parseDecimal(bytes memory raw) internal pure returns (uint256 result) {
        bool started = false;
        for (uint256 i = 0; i < raw.length; ++i) {
            uint8 c = uint8(raw[i]);
            if (c >= 0x30 && c <= 0x39) {
                // digit 0-9
                result = result * 10 + (c - 0x30);
                started = true;
            } else if (started) {
                // non-digit after we've started -- stop (handles trailing newline)
                break;
            }
            // else: skip leading non-digits (shouldn't happen with jq output)
        }
    }
}
