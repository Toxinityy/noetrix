// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";

/// @title DemoFeedConsumer — reference integration of the Predictor Index composite feed
/// @notice Example for the protocols that subscribe to the feed (PRD §7.5 / §9.2). Reads the
///         ensemble forecast for a category, decodes the packed point estimate, and exposes a
///         consumer-friendly view plus an optional staleness guard. This is what a Mantle protocol
///         (e.g. a lending market adjusting parameters off mETH APR) would embed.
/// @dev Example business logic a protocol might run off the feed:
///      - `shouldAllowDeposits()` — enable deposits only when the mETH APR forecast clears a floor.
///      - `shouldThrottleRisk()`  — de-risk when the Aave-on-Mantle TVL forecast falls below a floor.
///      These are illustrative thresholds, not financial advice; a real consumer would gate on
///      `confidence` and freshness (see `valueFresh`) before acting.
contract DemoFeedConsumer {
    error FeedStale();

    /// Category ids — keccak256 of the labels, matching the on-chain registration (Deploy.s.sol).
    bytes32 public constant METH_APR_24H = keccak256("METH_APR_24H");
    bytes32 public constant AAVE_MANTLE_TVL_24H = keccak256("AAVE_MANTLE_TVL_24H");

    /// Allow deposits when forecast mETH APR exceeds this (bps). 150 bps = 1.5% APR — a
    /// minimum-attractiveness floor calibrated to real mETH staking yield (~2.5%), so the gate
    /// reads sensibly against the live real-rate feed rather than the old synthetic ~30% regime.
    uint256 public constant METH_APR_DEPOSIT_THRESHOLD_BPS = 150;
    /// Throttle risk when forecast Aave-Mantle TVL is below this. USD 8-dec: $100M = 100e6 * 1e8 —
    /// a systemic floor below live Mantle-scale TVL (~$136M) so a healthy market doesn't read throttled.
    uint256 public constant AAVE_TVL_THROTTLE_THRESHOLD = 100_000_000 * 1e8;

    ICompositeFeed public immutable feed;

    constructor(ICompositeFeed _feed) {
        require(address(_feed) != address(0), "feed=0");
        feed = _feed;
    }

    // ─── Business-logic views (Prompt 12 Part A) ───────────────────────────────

    /// @notice Current ensemble mETH APR forecast.
    /// @return value APR in bps. @return confidence Aggregated confidence in bps.
    function getCurrentMethApr() public view returns (uint256 value, uint16 confidence) {
        return _decode(METH_APR_24H);
    }

    /// @notice Current ensemble Aave-on-Mantle TVL forecast.
    /// @return value TVL in USD 8-dec. @return confidence Aggregated confidence in bps.
    function getCurrentAaveTvl() public view returns (uint256 value, uint16 confidence) {
        return _decode(AAVE_MANTLE_TVL_24H);
    }

    /// @notice Example gate: allow deposits when forecast mETH APR clears the floor.
    function shouldAllowDeposits() external view returns (bool) {
        (uint256 apr,) = getCurrentMethApr();
        return apr > METH_APR_DEPOSIT_THRESHOLD_BPS;
    }

    /// @notice Example gate: throttle risk when forecast TVL is below the floor (an unset feed reads
    ///         as 0, which throttles — the safe default when there's no data to act on).
    function shouldThrottleRisk() external view returns (bool) {
        (uint256 tvl,) = getCurrentAaveTvl();
        return tvl < AAVE_TVL_THROTTLE_THRESHOLD;
    }

    function _decode(bytes32 categoryId) internal view returns (uint256 value, uint16 confidence) {
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        value = f.value.length == 0 ? 0 : abi.decode(f.value, (uint256));
        confidence = f.confidence;
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
