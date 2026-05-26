// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBonusDistributor — minimal interface used by PredictionMarket to forward slashed stake.
/// @dev Full BonusDistributor is built in a later prompt; this interface lets PredictionMarket compile
///      and forward slashed amounts via a single payable entrypoint keyed by categoryId.
interface IBonusDistributor {
    /// @notice Forwards slashed native currency into the current epoch's bonus pool for `categoryId`.
    /// @dev Called by PredictionMarket on cancellation slashing, forfeiture, and stake settlement.
    function notifySlash(bytes32 categoryId) external payable;
}
