// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICategoryScorer
/// @notice Pure-function scorer that maps a prediction + revealed outcome into a signed score
///         in the canonical range [-1e6, +1e6]. One implementation per category type.
interface ICategoryScorer {
    /// @param prediction      The agent's revealed prediction bytes (encoding is category-defined).
    /// @param outcome         The resolver-produced outcome bytes (encoding is category-defined).
    /// @param confidence      Agent's stated confidence, in basis points (0..10000). Scorer may ignore.
    /// @param categoryConfig  Per-category configuration bytes (e.g. domain bounds).
    /// @return score          Signed score ∈ [-1_000_000, +1_000_000]. +1e6 = perfect, -1e6 = worst.
    function score(
        bytes calldata prediction,
        bytes calldata outcome,
        uint16 confidence,
        bytes calldata categoryConfig
    ) external pure returns (int256);
}
