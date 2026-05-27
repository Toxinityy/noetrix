// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBonusDistributor
/// @notice Interface used by ScoringEngine + PredictionMarket to forward slashed stake into the
///         current epoch's bonus pool and to record per-agent bonus claim contributions.
/// @dev `notifySlash` is payable and called by PredictionMarket on cancel/forfeit/settle paths.
///      `recordContribution` is non-payable and called by ScoringEngine on score apply to grow the
///      caller's pull-claim share of the current epoch pool. The full BonusDistributor lives in a
///      later prompt; this interface lets ScoringEngine + PredictionMarket compile against a stub.
interface IBonusDistributor {
    /// @notice Forwards slashed native currency into the current epoch's bonus pool for `categoryId`.
    function notifySlash(bytes32 categoryId) external payable;

    /// @notice Records an agent's bonus-eligibility share for the current epoch of `categoryId`.
    /// @dev `share` is computed by ScoringEngine as `max(0, score_norm)² × stake` in raw wei-scale.
    function recordContribution(bytes32 categoryId, uint256 agentId, uint256 share) external;
}
