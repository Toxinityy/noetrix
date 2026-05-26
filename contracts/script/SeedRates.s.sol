// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockMethRateOracle} from "../src/mocks/MockMethRateOracle.sol";

/// @title SeedRates — populates MockMethRateOracle with synthetic mETH rate history
/// @notice Reads target oracle address from env var `MOCK_METH_ORACLE` and a base block from
///         `BASE_BLOCK`. Seeds DAYS+1 daily snapshots backward from BASE_BLOCK with a small
///         linear-growth assumption (≈0.0008%/day → ~3% APR), suitable for v1 demos.
///         Override DAILY_GROWTH_PPM env var to tune.
///
/// Usage (Mantle Sepolia):
///   forge script script/SeedRates.s.sol:SeedRates \
///     --rpc-url $MANTLE_SEPOLIA_RPC \
///     --private-key $DEPLOYER_KEY \
///     --broadcast
contract SeedRates is Script {
    uint256 internal constant BLOCKS_PER_DAY = 43_200;
    uint256 internal constant DEFAULT_DAYS = 14;
    uint256 internal constant DEFAULT_GROWTH_PPM = 8; // 0.0008% / day, ≈2.92% APR

    function run() external {
        address oracleAddr = vm.envAddress("MOCK_METH_ORACLE");
        uint256 baseBlock = vm.envOr("BASE_BLOCK", block.number);
        uint256 days_ = vm.envOr("SEED_DAYS", DEFAULT_DAYS);
        uint256 growthPpm = vm.envOr("DAILY_GROWTH_PPM", DEFAULT_GROWTH_PPM);

        MockMethRateOracle oracle = MockMethRateOracle(oracleAddr);

        uint256 startBlock = baseBlock - (days_ * BLOCKS_PER_DAY);
        uint256[] memory blocks = new uint256[](days_ + 1);
        uint256[] memory rates = new uint256[](days_ + 1);

        uint256 rate = 1e18;
        for (uint256 i = 0; i <= days_; ++i) {
            blocks[i] = startBlock + i * BLOCKS_PER_DAY;
            rates[i] = rate;
            // rate *= (1 + growthPpm / 1_000_000)
            rate = rate + (rate * growthPpm) / 1_000_000;
        }

        vm.startBroadcast();
        oracle.setRates(blocks, rates);
        vm.stopBroadcast();

        console2.log("Seeded MockMethRateOracle at:", oracleAddr);
        console2.log("Days seeded:", days_);
        console2.log("Start block:", startBlock);
        console2.log("End block:", blocks[days_]);
        console2.log("Final rate (1e18-scaled):", rates[days_]);
    }
}
