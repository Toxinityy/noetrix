// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";
import {IMethRateOracle} from "../interfaces/IMethRateOracle.sol";

/// @title MethAprResolver — resolves 24h trailing mETH APR in basis points
/// @notice Formula (PRD §7.3.1):
///         aprBps = ((rateNow × 1e18 / ratePrior - 1e18) × 365 × 10000) / 1e18
///         where rateNow = oracle.getRateAt(resolutionBlock),
///               ratePrior = oracle.getRateAt(resolutionBlock - 43200) ≈ 24h prior on Mantle (2s blocks).
///         Edge cases:
///           - ratePrior == 0 → 0
///           - rateNow <= ratePrior → 0 (mETH rate is monotonically non-decreasing; clamp negatives to 0)
///         Returns abi.encode(uint256 aprBps).
/// @dev v1 reads from a MockMethRateOracle seeded by an admin script (`script/SeedRates.s.sol`).
///      v2 swaps the oracle for a direct mETH staking-contract read against an archive RPC.
contract MethAprResolver is ICategoryResolver {
    uint256 public constant BLOCKS_PER_DAY = 43_200; // Mantle 2-second blocks ≈ 86400 / 2

    IMethRateOracle public immutable oracle;

    constructor(IMethRateOracle _oracle) {
        require(address(_oracle) != address(0), "oracle=0");
        oracle = _oracle;
    }

    /// @inheritdoc ICategoryResolver
    /// @dev `predictionValue` is ignored — APR is determined solely by oracle state at resolutionBlock.
    function resolve(bytes calldata, uint256 resolutionBlock) external view returns (bytes memory) {
        if (resolutionBlock < BLOCKS_PER_DAY) {
            return abi.encode(uint256(0));
        }
        uint256 rateNow = oracle.getRateAt(resolutionBlock);
        uint256 ratePrior = oracle.getRateAt(resolutionBlock - BLOCKS_PER_DAY);

        if (ratePrior == 0 || rateNow <= ratePrior) {
            return abi.encode(uint256(0));
        }

        // Safe: ratePrior > 0 and rateNow > ratePrior so the subtraction is positive.
        uint256 ratioMinusOne = (rateNow * 1e18) / ratePrior - 1e18;
        uint256 aprBps = (ratioMinusOne * 365 * 10_000) / 1e18;

        return abi.encode(aprBps);
    }
}
