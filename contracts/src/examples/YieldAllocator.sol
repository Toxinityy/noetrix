// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";

/// @title YieldAllocator — advisory dynamic yield strategy across two RWA yield assets
/// @notice Reads the composite feed's forecast yield + confidence for mETH and USDY and outputs a
///         confidence-weighted target allocation (bps, summing to 10000). Read-only/advisory: a real
///         RWA vault embeds this to decide deposit routing; no funds are custodied here.
contract YieldAllocator {
    uint256 public constant MAX_STALE_BLOCKS = 50_000; // ~28h on 2s blocks; tolerates a missed refresh
    uint256 public constant REBALANCE_THRESHOLD_BPS = 500; // 5% drift triggers a rebalance signal

    ICompositeFeed public immutable feed;
    bytes32 public immutable methCategory;
    bytes32 public immutable usdyCategory;

    /// Baseline allocation the rebalance signal compares against (defaults 50/50).
    uint256 public baselineMethBps = 5_000;

    constructor(ICompositeFeed _feed, bytes32 _meth, bytes32 _usdy) {
        require(address(_feed) != address(0), "feed=0");
        feed = _feed;
        methCategory = _meth;
        usdyCategory = _usdy;
    }

    /// @dev Effective yield = forecastYield × confidence / 10000, plus a usability flag (false if the
    ///      feed is stale or never refreshed). A stale feed is treated as unusable rather than zero so
    ///      one briefly-stale oracle can't force 100% concentration into the other asset.
    function _effectiveYield(bytes32 id) internal view returns (uint256 eff, bool usable) {
        ICompositeFeed.CompositeForecast memory f = feed.read(id);
        if (f.value.length == 0 || f.lastUpdatedBlock == 0) return (0, false);
        if (block.number - f.lastUpdatedBlock > MAX_STALE_BLOCKS) return (0, false);
        uint256 y = abi.decode(f.value, (uint256));
        return ((y * f.confidence) / 10_000, true);
    }

    /// @notice Target allocation across mETH and USDY plus the raw forecast yields driving it.
    /// @return allocMethBps mETH share (bps).
    /// @return allocUsdyBps USDY share (bps).
    /// @return methYield mETH forecast yield (bps).
    /// @return usdyYield USDY forecast yield (bps).
    function getAllocation()
        public
        view
        returns (uint256 allocMethBps, uint256 allocUsdyBps, uint256 methYield, uint256 usdyYield)
    {
        (uint256 em, bool mUsable) = _effectiveYield(methCategory);
        (uint256 eu, bool uUsable) = _effectiveYield(usdyCategory);
        ICompositeFeed.CompositeForecast memory fm = feed.read(methCategory);
        ICompositeFeed.CompositeForecast memory fu = feed.read(usdyCategory);
        methYield = fm.value.length == 0 ? 0 : abi.decode(fm.value, (uint256));
        usdyYield = fu.value.length == 0 ? 0 : abi.decode(fu.value, (uint256));

        uint256 total = em + eu;
        // Safe 50/50 default when either feed is unusable (stale/empty) or both yields are zero —
        // avoids div-by-zero and avoids one stale oracle forcing 100% concentration into the other.
        if (!mUsable || !uUsable || total == 0) {
            return (5_000, 5_000, methYield, usdyYield);
        }
        allocMethBps = (em * 10_000) / total;
        allocUsdyBps = 10_000 - allocMethBps;
    }

    /// @notice True if the current mETH allocation has drifted past the rebalance threshold.
    function rebalanceSignal() external view returns (bool) {
        (uint256 m,,,) = getAllocation();
        uint256 diff = m > baselineMethBps ? m - baselineMethBps : baselineMethBps - m;
        return diff > REBALANCE_THRESHOLD_BPS;
    }
}
