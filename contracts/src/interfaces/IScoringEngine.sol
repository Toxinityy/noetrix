// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IScoringEngine — entrypoint called by ResolutionEngine.resolve()
/// @notice Receives the resolved outcome plus the scorer/config indirection and the EOA/contract
///         that triggered resolution (paid the 2% gas reward inside settleStake).
interface IScoringEngine {
    function applyScore(
        uint256 predictionId,
        bytes calldata outcome,
        address scorer,
        bytes calldata categoryConfig,
        address resolverCaller
    ) external;
}
