// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";

/// @title RiskManager — advisory automated risk management driven by forecast confidence + freshness
/// @notice For each registered RWA asset (keyed by categoryId), derives a collateral factor, deposit
///         cap, and risk state from the composite feed's confidence + staleness. Read-only/advisory:
///         a lending market embeds this to gate parameters; no funds are touched here.
contract RiskManager is Ownable {
    enum State {
        Normal,
        Caution,
        Frozen
    }

    uint256 public constant MAX_STALE_BLOCKS = 50_000; // ~28h
    uint16 public constant CONF_FLOOR_BPS = 4_000; // below → Frozen
    uint16 public constant CONF_CAUTION_BPS = 7_500; // [floor, caution) → Caution
    uint256 public constant FLOOR_CF_BPS = 2_000; // collateral factor never below 20%

    struct Asset {
        uint256 baseCfBps;
        uint256 maxCap;
        bool registered;
    }

    ICompositeFeed public immutable feed;
    mapping(bytes32 => Asset) public assets;

    constructor(ICompositeFeed _feed, address initialOwner) Ownable(initialOwner) {
        require(address(_feed) != address(0), "feed=0");
        feed = _feed;
    }

    function registerAsset(bytes32 categoryId, uint256 baseCfBps, uint256 maxCap) external onlyOwner {
        assets[categoryId] = Asset({baseCfBps: baseCfBps, maxCap: maxCap, registered: true});
    }

    function _fresh(ICompositeFeed.CompositeForecast memory f) internal view returns (bool) {
        return f.lastUpdatedBlock != 0 && block.number - f.lastUpdatedBlock <= MAX_STALE_BLOCKS;
    }

    function riskState(bytes32 categoryId) public view returns (State) {
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        if (!_fresh(f) || f.confidence < CONF_FLOOR_BPS) return State.Frozen;
        if (f.confidence < CONF_CAUTION_BPS) return State.Caution;
        return State.Normal;
    }

    function isPaused(bytes32 categoryId) external view returns (bool) {
        return riskState(categoryId) == State.Frozen;
    }

    /// @notice Collateral factor (bps): baseCf × confidence / 10000, clamped to [FLOOR_CF, baseCf].
    ///         Returns 0 when Frozen.
    function collateralFactor(bytes32 categoryId) external view returns (uint256) {
        if (riskState(categoryId) == State.Frozen) return 0;
        Asset memory a = assets[categoryId];
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        uint256 cf = (a.baseCfBps * f.confidence) / 10_000;
        if (cf < FLOOR_CF_BPS) cf = FLOOR_CF_BPS;
        if (cf > a.baseCfBps) cf = a.baseCfBps;
        return cf;
    }

    /// @notice Deposit cap: maxCap × confidence / 10000. Returns 0 when Frozen.
    function depositCap(bytes32 categoryId) external view returns (uint256) {
        if (riskState(categoryId) == State.Frozen) return 0;
        Asset memory a = assets[categoryId];
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);
        return (a.maxCap * f.confidence) / 10_000;
    }
}
