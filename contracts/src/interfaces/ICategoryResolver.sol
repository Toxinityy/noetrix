// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICategoryResolver — per-category outcome resolver
/// @notice Implementations read external state (oracles, contracts) at `resolutionBlock`
///         and return an outcome-encoded bytes blob consumable by the matching scorer.
interface ICategoryResolver {
    function resolve(bytes calldata predictionValue, uint256 resolutionBlock)
        external
        view
        returns (bytes memory outcome);
}
