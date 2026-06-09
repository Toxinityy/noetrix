// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";
import {ISentimentOracle} from "../interfaces/ISentimentOracle.sol";
import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";

interface IResolutionEngineView {
    function getCategory(bytes32 categoryId) external view returns (address resolver, address scorer, bytes memory config);
}

/// @title MarketStressMonitor — honest on-chain market-stress warning over the swarm feed.
/// @notice Combines THREE independent signals into a 3-level alert: (1) ensemble disagreement +
///         quorum + freshness from the swarm feed; (2) model-independent forecast-surprise read
///         best-effort from the category resolver; (3) external Fear & Greed sentiment. This is an
///         alert/labeling layer — RiskManager owns parameter gating off confidence. It does NOT claim
///         to predict shocks; it flags model-uncertainty + realized-surprise + market-fear.
contract MarketStressMonitor is Ownable {
    enum Level {
        Calm,
        Elevated,
        Stressed
    }

    uint256 public constant MIN_SWARM = 3;

    // reason bitmap flags
    uint256 internal constant R_STALE = 1 << 0;
    uint256 internal constant R_DISAGREE_HIGH = 1 << 1;
    uint256 internal constant R_DISAGREE_MED = 1 << 2;
    uint256 internal constant R_SURPRISE_HIGH = 1 << 3;
    uint256 internal constant R_SURPRISE_MED = 1 << 4;
    uint256 internal constant R_FEAR_EXTREME = 1 << 5;
    uint256 internal constant R_FEAR = 1 << 6;
    uint256 internal constant R_GREED = 1 << 7;
    uint256 internal constant R_LOW_QUORUM = 1 << 8;

    ICompositeFeed public immutable feed;
    IResolutionEngineView public immutable resolutionEngine;
    ISentimentOracle public immutable sentiment;

    uint256 public maxStaleBlocks = 50_000; // match RiskManager.MAX_STALE_BLOCKS
    uint256 public sentimentStaleBlocks = 50_000;
    uint8 public fearExtreme = 25;
    uint8 public fearMed = 45;
    uint8 public greedExtreme = 75;

    struct StressConfig {
        uint256 domainMin;
        uint256 domainMax;
        uint16 dMed;
        uint16 dHigh;
        uint16 surpriseMed;
        uint16 surpriseHigh;
        bool set;
    }

    mapping(bytes32 => StressConfig) public stressConfig;
    mapping(bytes32 => Level) public lastLevel;

    event StressConfigSet(bytes32 indexed categoryId);
    event ThresholdsSet(uint256 maxStaleBlocks, uint256 sentimentStaleBlocks, uint8 fearExtreme, uint8 fearMed, uint8 greedExtreme);
    event StressWarning(bytes32 indexed categoryId, Level level, uint256 reasons, uint256 blockNumber);

    constructor(address _feed, address _resolutionEngine, address _sentiment, address initialOwner)
        Ownable(initialOwner)
    {
        require(_feed != address(0) && _resolutionEngine != address(0) && _sentiment != address(0), "zero");
        feed = ICompositeFeed(_feed);
        resolutionEngine = IResolutionEngineView(_resolutionEngine);
        sentiment = ISentimentOracle(_sentiment);
    }

    function setStressConfig(
        bytes32 categoryId,
        uint256 domainMin,
        uint256 domainMax,
        uint16 dMed,
        uint16 dHigh,
        uint16 surpriseMed,
        uint16 surpriseHigh
    ) external onlyOwner {
        require(domainMax > domainMin, "bad domain");
        stressConfig[categoryId] =
            StressConfig(domainMin, domainMax, dMed, dHigh, surpriseMed, surpriseHigh, true);
        emit StressConfigSet(categoryId);
    }

    function setThresholds(
        uint256 _maxStaleBlocks,
        uint256 _sentimentStaleBlocks,
        uint8 _fearExtreme,
        uint8 _fearMed,
        uint8 _greedExtreme
    ) external onlyOwner {
        maxStaleBlocks = _maxStaleBlocks;
        sentimentStaleBlocks = _sentimentStaleBlocks;
        fearExtreme = _fearExtreme;
        fearMed = _fearMed;
        greedExtreme = _greedExtreme;
        emit ThresholdsSet(_maxStaleBlocks, _sentimentStaleBlocks, _fearExtreme, _fearMed, _greedExtreme);
    }

    /// @notice Best-effort model-independent forecast surprise: |resolverTruth(now) - ensemble| as bps
    ///         of the domain width. Skipped (ok=false) if the resolver can't price the current block.
    function _surpriseBps(bytes32 categoryId, uint256 ensemble, StressConfig memory c)
        internal
        view
        returns (uint256 sBps, bool ok)
    {
        (address resolver,,) = resolutionEngine.getCategory(categoryId);
        if (resolver == address(0)) return (0, false);
        try ICategoryResolver(resolver).resolve("", block.number) returns (bytes memory outcome) {
            if (outcome.length < 32) return (0, false);
            uint256 truth = abi.decode(outcome, (uint256));
            uint256 width = c.domainMax - c.domainMin;
            if (width == 0) return (0, false);
            uint256 gap = truth > ensemble ? truth - ensemble : ensemble - truth;
            return ((gap * 10_000) / width, true);
        } catch {
            return (0, false);
        }
    }

    function _assess(bytes32 categoryId) internal view returns (Level level, uint256 reasons) {
        StressConfig memory c = stressConfig[categoryId];
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);

        bool stressed;
        bool elevated;

        // freshness
        bool fresh = f.lastUpdatedBlock != 0 && block.number - f.lastUpdatedBlock <= maxStaleBlocks;
        if (!fresh) {
            stressed = true;
            reasons |= R_STALE;
        }

        if (c.set) {
            // disagreement (model consensus)
            if (f.disagreementBps >= c.dHigh) {
                stressed = true;
                reasons |= R_DISAGREE_HIGH;
            } else if (f.disagreementBps >= c.dMed) {
                elevated = true;
                reasons |= R_DISAGREE_MED;
            }
            // forecast surprise (model-independent, best-effort)
            uint256 ensemble = f.value.length >= 32 ? abi.decode(f.value, (uint256)) : 0;
            (uint256 sBps, bool ok) = _surpriseBps(categoryId, ensemble, c);
            if (ok) {
                if (sBps >= c.surpriseHigh) {
                    stressed = true;
                    reasons |= R_SURPRISE_HIGH;
                } else if (sBps >= c.surpriseMed) {
                    elevated = true;
                    reasons |= R_SURPRISE_MED;
                }
            }
        }

        // quorum
        if (f.contributingAgents < MIN_SWARM) {
            elevated = true;
            reasons |= R_LOW_QUORUM;
        }

        // sentiment (external, absolute)
        (uint8 fg, uint256 fgBlock) = sentiment.latest();
        bool fgFresh = fgBlock != 0 && block.number - fgBlock <= sentimentStaleBlocks;
        if (fgFresh) {
            if (fg <= fearExtreme) {
                stressed = true;
                reasons |= R_FEAR_EXTREME;
            } else if (fg <= fearMed) {
                elevated = true;
                reasons |= R_FEAR;
            } else if (fg >= greedExtreme) {
                elevated = true;
                reasons |= R_GREED;
            }
        }

        level = stressed ? Level.Stressed : (elevated ? Level.Elevated : Level.Calm);
    }

    /// @notice Current stress level + the reason bitmap. Read-only.
    function stressLevel(bytes32 categoryId) external view returns (Level level, uint256 reasons) {
        return _assess(categoryId);
    }

    /// @notice Permissionless: recompute and emit StressWarning on a level transition.
    function poke(bytes32 categoryId) external returns (Level level) {
        uint256 reasons;
        (level, reasons) = _assess(categoryId);
        if (level != lastLevel[categoryId]) {
            lastLevel[categoryId] = level;
            emit StressWarning(categoryId, level, reasons, block.number);
        }
    }
}
