// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IMethRateOracle — historical mETH exchange-rate snapshot reader
/// @notice Mantle's mETH exchange rate is a monotonically non-decreasing 1e18-scaled value.
///         In production this comes from the mETH staking contract; v1 uses a mock-seeded oracle.
interface IMethRateOracle {
    /// @notice Returns the mETH exchange rate snapshot at `blockNumber`. Zero means "not set".
    function getRateAt(uint256 blockNumber) external view returns (uint256 rate);
}
