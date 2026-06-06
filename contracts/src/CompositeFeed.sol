// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";
import {ISubscriptionGate} from "./interfaces/ISubscriptionGate.sol";
import {ICompositeFeed} from "./interfaces/ICompositeFeed.sol";

/// @title CompositeFeed — rank-weighted ensemble of top agents' active forecasts (PRD §7.5)
/// @notice `refresh` re-aggregates the latest revealed prediction of each top-20 agent into a single
///         ensemble value + outlier-resistant confidence. `read` exposes it to consumers, gated by
///         SubscriptionGate (open in v1).
/// @dev Weighting (§7.5.1): rank r (1-indexed, after skipping non-contributors) gets weight
///        (N+1-r) / (N(N+1)/2), so weights are linearly decreasing and sum to 1.
///      Confidence is rank-weighted stated confidence times a calibration multiplier in [0.5, 1.0];
///      each agent's calibration drag is clipped at -0.5 so one badly-calibrated agent can't crater it.
contract CompositeFeed is ICompositeFeed, Ownable {
    uint256 public constant REFRESH_RATE_LIMIT_BLOCKS = 100;
    uint256 public constant TOP_SLOTS = 20;
    uint256 private constant WEIGHT_SCALE = 1e18;
    uint256 private constant CAL_SCALE = 1_000_000; // calibration fixed-point (1.0)
    int256 private constant CAL_FLOOR = -500_000; // -0.5 in CAL_SCALE
    uint16 private constant MAX_CONFIDENCE_BPS = 10_000;

    error ZeroAddress();
    error NotConfigured();
    error RateLimited();
    error NoAccess();

    event AgentRegistrySet(address indexed agentRegistry);
    event PredictionMarketSet(address indexed predictionMarket);
    event SubscriptionGateSet(address indexed subscriptionGate);
    event CompositeFeedRefreshed(
        bytes32 indexed categoryId, uint256 value, uint16 confidence, uint256 contributorCount, uint256 blockNumber
    );
    /// @dev Emitted when a refresh finds no active contributors but a previously published value
    ///      exists — the last-good snapshot is held (not zeroed). Freshness stays observable via the
    ///      held `lastUpdatedBlock` (consumers can still detect staleness).
    event CompositeFeedStale(
        bytes32 indexed categoryId, uint256 heldContributors, uint256 heldSinceBlock, uint256 refreshBlock
    );

    IAgentRegistry public agentRegistry;
    IPredictionMarket public predictionMarket;
    ISubscriptionGate public subscriptionGate;

    mapping(bytes32 => CompositeForecast) internal _feeds;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setAgentRegistry(IAgentRegistry registry) external onlyOwner {
        if (address(registry) == address(0)) revert ZeroAddress();
        agentRegistry = registry;
        emit AgentRegistrySet(address(registry));
    }

    function setPredictionMarket(IPredictionMarket market) external onlyOwner {
        if (address(market) == address(0)) revert ZeroAddress();
        predictionMarket = market;
        emit PredictionMarketSet(address(market));
    }

    /// @dev Optional. While unset the feed is fully open (v1 default).
    function setSubscriptionGate(ISubscriptionGate gate) external onlyOwner {
        subscriptionGate = gate;
        emit SubscriptionGateSet(address(gate));
    }

    // ─── Read (gated) ──────────────────────────────────────────────────────────────

    /// @inheritdoc ICompositeFeed
    function read(bytes32 categoryId) external view returns (CompositeForecast memory) {
        if (address(subscriptionGate) != address(0) && !subscriptionGate.hasAccess(msg.sender, categoryId)) {
            revert NoAccess();
        }
        return _feeds[categoryId];
    }

    // ─── Refresh ───────────────────────────────────────────────────────────────────

    /// @notice Re-aggregate the ensemble. Permissionless, rate-limited to once / 100 blocks per category.
    function refresh(bytes32 categoryId) external {
        if (address(agentRegistry) == address(0) || address(predictionMarket) == address(0)) revert NotConfigured();

        uint256 last = _feeds[categoryId].lastUpdatedBlock;
        if (last != 0 && block.number - last < REFRESH_RATE_LIMIT_BLOCKS) revert RateLimited();

        (uint256[] memory points, uint16[] memory stated, int256[] memory cals, uint256 n) = _gather(categoryId);

        // Hold-last-good: an empty aggregate must NOT wipe a previously published value to zero —
        // that overwrite is exactly what made the live feed read 0 whenever the agents paused (the
        // feed only counts still-Revealed predictions). Only the very first empty refresh writes an
        // explicit zero so `value` stays abi-decodable for consumers; afterwards an empty refresh
        // leaves the last good snapshot intact. `lastUpdatedBlock` is left unchanged on a hold, so
        // freshness stays observable (DemoFeedConsumer.valueFresh still reports staleness).
        if (n == 0) {
            CompositeForecast storage existing = _feeds[categoryId];
            if (existing.value.length == 0) {
                existing.value = abi.encode(uint256(0));
                existing.lastUpdatedBlock = block.number;
                emit CompositeFeedRefreshed(categoryId, 0, 0, 0, block.number);
            } else {
                emit CompositeFeedStale(
                    categoryId, existing.contributingAgents, existing.lastUpdatedBlock, block.number
                );
            }
            return;
        }

        (uint256 ensemble, uint16 confidence) = _aggregate(points, stated, cals, n);

        _feeds[categoryId] = CompositeForecast({
            value: abi.encode(ensemble),
            confidence: confidence,
            contributingAgents: n,
            lastUpdatedBlock: block.number
        });

        emit CompositeFeedRefreshed(categoryId, ensemble, confidence, n, block.number);
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    /// @dev Walks the top-20 (already sorted, resolvedCount>=10) and pulls each agent's latest
    ///      still-Revealed prediction in this category. Order preserved = rank order.
    function _gather(bytes32 categoryId)
        internal
        view
        returns (uint256[] memory points, uint16[] memory stated, int256[] memory cals, uint256 n)
    {
        uint256[TOP_SLOTS] memory topIds = agentRegistry.getTopAgents(categoryId);

        uint256[] memory pBuf = new uint256[](TOP_SLOTS);
        uint16[] memory sBuf = new uint16[](TOP_SLOTS);
        int256[] memory cBuf = new int256[](TOP_SLOTS);

        for (uint256 i = 0; i < TOP_SLOTS; ++i) {
            uint256 agentId = topIds[i];
            if (agentId == 0) continue;

            (bool ok, uint256 point, uint16 stated_, int256 cal) = _contributor(categoryId, agentId);
            if (!ok) continue;

            pBuf[n] = point;
            sBuf[n] = stated_;
            cBuf[n] = cal;
            unchecked {
                ++n;
            }
        }

        points = new uint256[](n);
        stated = new uint16[](n);
        cals = new int256[](n);
        for (uint256 j = 0; j < n; ++j) {
            points[j] = pBuf[j];
            stated[j] = sBuf[j];
            cals[j] = cBuf[j];
        }
    }

    /// @dev Resolves one top-agent's contribution: its latest still-Revealed prediction's point
    ///      estimate, stated confidence, and calibration. ok=false means skip (no/stale prediction).
    function _contributor(bytes32 categoryId, uint256 agentId)
        internal
        view
        returns (bool ok, uint256 point, uint16 stated, int256 cal)
    {
        uint256 predId = predictionMarket.latestRevealedPrediction(agentId, categoryId);
        if (predId == 0) return (false, 0, 0, 0);

        IPredictionMarket.Prediction memory p = predictionMarket.getPrediction(predId);
        if (p.status != IPredictionMarket.PredictionStatus.Revealed || p.value.length == 0) {
            return (false, 0, 0, 0);
        }

        (uint256 low, uint256 high) = abi.decode(p.value, (uint256, uint256));
        point = (low + high) / 2;
        stated = p.confidence;
        cal = agentRegistry.getReputation(agentId, categoryId).calibrationScore;
        ok = true;
    }

    /// @dev Rank-weighted ensemble value + outlier-resistant confidence.
    function _aggregate(uint256[] memory points, uint16[] memory stated, int256[] memory cals, uint256 n)
        internal
        pure
        returns (uint256 ensemble, uint16 confidence)
    {
        if (n == 0) return (0, 0);

        uint256 denom = (n * (n + 1)) / 2; // Σ ranks

        uint256 weightedStated; // WEIGHT_SCALE-scaled bps
        int256 sumClipped; // CAL_SCALE-scaled
        for (uint256 j = 0; j < n; ++j) {
            // rank r = j+1 → rank weight numerator (N+1-r) = (n - j)
            uint256 wScaled = ((n - j) * WEIGHT_SCALE) / denom;
            ensemble += (wScaled * points[j]) / WEIGHT_SCALE;
            weightedStated += wScaled * uint256(stated[j]); // keep WEIGHT_SCALE factor for precision

            int256 clipped = cals[j] < CAL_FLOOR ? CAL_FLOOR : cals[j];
            if (clipped > 0) clipped = 0; // calibration is non-positive by construction
            sumClipped += clipped;
        }

        // multiplier = 1 + mean(clipped) ∈ [0.5, 1.0], in CAL_SCALE
        int256 meanClipped = sumClipped / int256(n);
        uint256 multiplier = uint256(int256(CAL_SCALE) + meanClipped);

        // weightedStated is bps × WEIGHT_SCALE; fold out WEIGHT_SCALE and apply multiplier.
        uint256 finalConf = (weightedStated * multiplier) / (WEIGHT_SCALE * CAL_SCALE);
        if (finalConf > MAX_CONFIDENCE_BPS) finalConf = MAX_CONFIDENCE_BPS;
        confidence = uint16(finalConf);
    }
}
