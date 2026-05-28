// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";

/// @title DemoFeedConsumer — reference integration of the Predictor Index composite feed
/// @notice Example for the protocols that subscribe to the feed (PRD §7.5 / §9.2). Reads the
///         ensemble forecast for a category, decodes the packed point estimate, and exposes a
///         consumer-friendly view plus an optional staleness guard. This is what a Mantle protocol
///         (e.g. a lending market adjusting parameters off mETH APR) would embed.
contract DemoFeedConsumer {
    error FeedStale();

    ICompositeFeed public immutable feed;

    constructor(ICompositeFeed _feed) {
        require(address(_feed) != address(0), "feed=0");
        feed = _feed;
    }

    /// @notice Decoded latest composite forecast for `categoryId`.
    /// @return value Ensemble point estimate (units are category-specific: bps for APR, USD-8dec for TVL).
    /// @return confidence Aggregated confidence in bps [0, 10000].
    /// @return contributors Number of agents that fed this snapshot.
    /// @return updatedBlock Block at which the feed was last refreshed.
    function latest(bytes32 categoryId)
        external
        view
        returns (uint256 value, uint16 confidence, uint256 contributors, uint256 updatedBlock)
    {
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        value = f.value.length == 0 ? 0 : abi.decode(f.value, (uint256));
        confidence = f.confidence;
        contributors = f.contributingAgents;
        updatedBlock = f.lastUpdatedBlock;
    }

    /// @notice Returns the ensemble value, reverting if the feed has not refreshed within
    ///         `maxStaleBlocks`. Consumers that act on the value should gate on freshness.
    function valueFresh(bytes32 categoryId, uint256 maxStaleBlocks) external view returns (uint256 value) {
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        if (f.lastUpdatedBlock == 0 || block.number - f.lastUpdatedBlock > maxStaleBlocks) revert FeedStale();
        value = f.value.length == 0 ? 0 : abi.decode(f.value, (uint256));
    }
}
