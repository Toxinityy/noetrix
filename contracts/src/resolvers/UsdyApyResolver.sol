// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";
import {IMethRateOracle} from "../interfaces/IMethRateOracle.sol";

/// @title UsdyApyResolver — resolves 24h trailing USDY APY in basis points
/// @notice USDY (Ondo) is a yield-bearing RWA stablecoin whose price-per-share rises monotonically.
///         aprBps = ((rateNow × 1e18 / ratePrior − 1e18) × 365 × 10000) / 1e18, same annualization
///         as mETH. Reads a generic rate oracle (IMethRateOracle: getRateAt(block)→1e18-scaled rate).
///         v1 uses a mock-seeded oracle (archive RPC needed for live Ondo reads); v2 swaps the addr.
contract UsdyApyResolver is ICategoryResolver {
    uint256 public constant BLOCKS_PER_DAY = 43_200; // Mantle 2s blocks

    IMethRateOracle public immutable oracle;

    constructor(IMethRateOracle _oracle) {
        require(address(_oracle) != address(0), "oracle=0");
        oracle = _oracle;
    }

    /// @inheritdoc ICategoryResolver
    function resolve(bytes calldata, uint256 resolutionBlock) external view returns (bytes memory) {
        if (resolutionBlock < BLOCKS_PER_DAY) return abi.encode(uint256(0));
        uint256 rateNow = oracle.getRateAt(resolutionBlock);
        uint256 ratePrior = oracle.getRateAt(resolutionBlock - BLOCKS_PER_DAY);
        if (ratePrior == 0 || rateNow <= ratePrior) return abi.encode(uint256(0));
        uint256 ratioMinusOne = (rateNow * 1e18) / ratePrior - 1e18;
        uint256 aprBps = (ratioMinusOne * 365 * 10_000) / 1e18;
        return abi.encode(aprBps);
    }
}
