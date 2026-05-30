// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMethRateOracle} from "../interfaces/IMethRateOracle.sol";

/// @title MockMethRateOracle — admin-seeded historical mETH exchange rate store
/// @notice v1 substitute for direct mETH-contract reads at historical blocks (which require
///         an archive node). Two ways to answer `getRateAt`:
///           1. Explicit overrides seeded via `setRate` / `setRates` (exact block → rate).
///           2. A synthetic linear-growth curve (configured via `setSynthetic`) that returns a
///              rate for ANY block ≥ anchor. This makes resolution robust: agents pick an
///              arbitrary `resolutionBlock`, and the resolver reads it + `resolutionBlock − 43200`
///              without those exact blocks having been pre-seeded.
///         Lookup order: explicit override → synthetic (if enabled) → revert `RateNotSet`.
///         v2 replaces this with a direct read against mETH on an archive RPC.
contract MockMethRateOracle is Ownable, IMethRateOracle {
    error RateNotSet();
    error LengthMismatch();

    event RateSet(uint256 indexed blockNumber, uint256 rate);
    event SyntheticConfigured(uint256 anchorBlock, uint256 baseRate, uint256 dailyGrowthPpm);

    uint256 internal constant BLOCKS_PER_DAY = 43_200; // Mantle 2-second blocks

    /// @dev blockNumber => 1e18-scaled exchange rate override. Zero means not explicitly set.
    mapping(uint256 => uint256) internal _rates;

    /// Synthetic curve: rate(block) = baseRate · (1 + dailyGrowthPpm/1e6 · (block − anchorBlock)/43200).
    bool public syntheticEnabled;
    uint256 public anchorBlock;
    uint256 public baseRate;
    uint256 public dailyGrowthPpm;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Explicit overrides ──────────────────────────────────────────────────────

    function setRate(uint256 blockNumber, uint256 rate) external onlyOwner {
        _rates[blockNumber] = rate;
        emit RateSet(blockNumber, rate);
    }

    function setRates(uint256[] calldata blockNumbers, uint256[] calldata rates) external onlyOwner {
        if (blockNumbers.length != rates.length) revert LengthMismatch();
        for (uint256 i = 0; i < blockNumbers.length; ++i) {
            _rates[blockNumbers[i]] = rates[i];
            emit RateSet(blockNumbers[i], rates[i]);
        }
    }

    // ─── Synthetic curve ───────────────────────────────────────────────────────────

    /// @notice Enable a deterministic linear-growth curve answered for any block ≥ anchor.
    /// @param anchorBlock_ Block where the curve equals `baseRate_`. Set safely BELOW the earliest
    ///        block any resolver will query (i.e. ≤ first resolutionBlock − 43200).
    /// @param baseRate_ 1e18-scaled rate at `anchorBlock_` (typically 1e18).
    /// @param dailyGrowthPpm_ Per-day growth in parts-per-million. The resolved APR is
    ///        ≈ dailyGrowthPpm_ × 3.65 bps (e.g. 822 ppm → ~3000 bps ≈ 30% in the bps domain).
    function setSynthetic(uint256 anchorBlock_, uint256 baseRate_, uint256 dailyGrowthPpm_) external onlyOwner {
        anchorBlock = anchorBlock_;
        baseRate = baseRate_;
        dailyGrowthPpm = dailyGrowthPpm_;
        syntheticEnabled = true;
        emit SyntheticConfigured(anchorBlock_, baseRate_, dailyGrowthPpm_);
    }

    function _synthetic(uint256 blockNumber) internal view returns (uint256) {
        if (blockNumber <= anchorBlock) return baseRate;
        uint256 delta = blockNumber - anchorBlock;
        // baseRate · dailyGrowthPpm · delta / (43200 · 1e6)
        uint256 growth = (baseRate * dailyGrowthPpm * delta) / (BLOCKS_PER_DAY * 1_000_000);
        return baseRate + growth;
    }

    // ─── Reads ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc IMethRateOracle
    function getRateAt(uint256 blockNumber) external view returns (uint256) {
        uint256 r = _rates[blockNumber];
        if (r != 0) return r;
        if (syntheticEnabled) return _synthetic(blockNumber);
        revert RateNotSet();
    }

    /// @notice Probe accessor that returns 0 instead of reverting when neither override nor synthetic set.
    function rateOrZero(uint256 blockNumber) external view returns (uint256) {
        uint256 r = _rates[blockNumber];
        if (r != 0) return r;
        if (syntheticEnabled) return _synthetic(blockNumber);
        return 0;
    }
}
