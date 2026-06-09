// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
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
    uint256 internal constant AGREE_FLOOR = 400_000; // 0.4 in CAL_SCALE — agreement multiplier floor
    uint256 internal constant MIN_SWARM = 3; // quorum: below this, confidence is capped (single-source)
    uint256 internal constant SINGLE_SOURCE_CEILING_BPS = 5_000;
    uint16 internal constant MIN_CONTRIB_CONF_BPS = 500; // a contributor must stake >= this stated confidence

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

    struct CategoryBounds {
        uint256 domainMin;
        uint256 domainMax;
        uint256 disagreeScale; // 0 = legacy (agreement+quorum disabled, fully backward-compatible)
    }

    mapping(bytes32 => CategoryBounds) public categoryBounds;

    event CategoryBoundsSet(bytes32 indexed categoryId, uint256 domainMin, uint256 domainMax, uint256 disagreeScale);

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Admin ───────────────────────────────────────────────────────────────────

    /// @notice Owner sets the per-category domain + disagreement scale. While disagreeScale==0 the feed
    ///         behaves exactly as before (legacy confidence). Deploy sets these from the backtest.
    function setCategoryBounds(bytes32 categoryId, uint256 domainMin, uint256 domainMax, uint256 disagreeScale)
        external
        onlyOwner
    {
        require(domainMax > domainMin, "bad domain");
        categoryBounds[categoryId] = CategoryBounds(domainMin, domainMax, disagreeScale);
        emit CategoryBoundsSet(categoryId, domainMin, domainMax, disagreeScale);
    }

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
            lastUpdatedBlock: block.number,
            disagreementBps: 0
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

    /// @dev Clamp bands to domain, compute midpoints/widths/ensemble/weightedStated in one pass.
    ///      Returns (mid[], width[], ensemble, weightedStated). Extracted to avoid stack-too-deep.
    function _clampAndWeigh(
        uint256[] memory lo,
        uint256[] memory hi,
        uint16[] memory stated,
        uint256 domainMin,
        uint256 domainMax
    ) internal pure returns (uint256[] memory mid, uint256[] memory width, uint256 ensemble, uint256 weightedStated) {
        uint256 n = lo.length;
        mid = new uint256[](n);
        width = new uint256[](n);
        uint256 denom = (n * (n + 1)) / 2;
        for (uint256 i = 0; i < n; ++i) {
            uint256 a = lo[i] < domainMin ? domainMin : (lo[i] > domainMax ? domainMax : lo[i]);
            uint256 b = hi[i] < domainMin ? domainMin : (hi[i] > domainMax ? domainMax : hi[i]);
            mid[i] = (a + b) / 2;
            width[i] = b - a;
            uint256 w = ((n - i) * WEIGHT_SCALE) / denom;
            ensemble += (w * mid[i]) / WEIGHT_SCALE;
            weightedStated += w * uint256(stated[i]);
        }
    }

    /// @dev Compute raw disagreement = floor(sqrt(weighted variance)) + weightedMeanBandWidth/2.
    ///      Extracted to avoid stack-too-deep in aggregatePreview.
    function _rawDisagreement(uint256[] memory mid, uint256[] memory width, uint256 ensemble)
        internal
        pure
        returns (uint256 dRaw)
    {
        uint256 n = mid.length;
        uint256 denom = (n * (n + 1)) / 2;
        uint256 V;
        uint256 Wbar;
        for (uint256 i = 0; i < n; ++i) {
            uint256 w = ((n - i) * WEIGHT_SCALE) / denom;
            uint256 diff = mid[i] > ensemble ? mid[i] - ensemble : ensemble - mid[i];
            V += (w * (diff * diff)) / WEIGHT_SCALE;
            Wbar += (w * width[i]) / WEIGHT_SCALE;
        }
        dRaw = Math.sqrt(V) + Wbar / 2;
    }

    /// @notice Pure Solidity mirror of forecasters/aggregateSwarm. Contributors in RANK ORDER. When
    ///         disagreeScale==0, reproduces the legacy confidence (no agreement, no quorum, disagreement 0).
    /// @dev Bit-parity with the TS golden vectors (test/SwarmParity.t.sol). All scaled-integer.
    function aggregatePreview(
        uint256[] memory lo,
        uint256[] memory hi,
        uint16[] memory stated,
        int256[] memory cals,
        uint256 domainMin,
        uint256 domainMax,
        uint256 disagreeScale
    ) public pure returns (uint256 ensemble, uint16 confidence, uint32 disagreementBps) {
        uint256 n = lo.length;
        if (n == 0) return (0, 0, 0);

        uint256[] memory mid;
        uint256[] memory width;
        uint256 weightedStated;
        (mid, width, ensemble, weightedStated) = _clampAndWeigh(lo, hi, stated, domainMin, domainMax);

        // Calibration multiplier (existing derivation): mean of clipped (<=0, floored at CAL_FLOOR) + 1.
        uint256 calMult = _calMult(cals, n);

        // Legacy path: agreement + quorum disabled, fully backward-compatible.
        if (disagreeScale == 0) {
            uint256 legacy = (weightedStated * calMult) / (WEIGHT_SCALE * CAL_SCALE);
            if (legacy > MAX_CONFIDENCE_BPS) legacy = MAX_CONFIDENCE_BPS;
            return (ensemble, uint16(legacy), 0);
        }

        // Dispersion → normalized disagreement d in [0, CAL_SCALE].
        uint256 dRaw = _rawDisagreement(mid, width, ensemble);
        uint256 d = (dRaw * CAL_SCALE) / disagreeScale;
        if (d > CAL_SCALE) d = CAL_SCALE;

        // Agreement multiplier g = max(AGREE_FLOOR, CAL_SCALE - d).
        uint256 g = CAL_SCALE - d;
        if (g < AGREE_FLOOR) g = AGREE_FLOOR;

        // Combine penalties with MIN (not product).
        uint256 mult = calMult < g ? calMult : g;
        uint256 finalConf = (weightedStated * mult) / (WEIGHT_SCALE * CAL_SCALE);
        if (finalConf > MAX_CONFIDENCE_BPS) finalConf = MAX_CONFIDENCE_BPS;

        // Quorum cap: a sub-MIN_SWARM swarm cannot claim full consensus confidence.
        if (n < MIN_SWARM && finalConf > SINGLE_SOURCE_CEILING_BPS) finalConf = SINGLE_SOURCE_CEILING_BPS;

        confidence = uint16(finalConf);
        disagreementBps = uint32((d * MAX_CONFIDENCE_BPS) / CAL_SCALE);
    }

    /// @dev Calibration multiplier = 1 + mean(clipped cal) in CAL_SCALE. Extracted to avoid stack-too-deep.
    function _calMult(int256[] memory cals, uint256 n) internal pure returns (uint256) {
        int256 sumClipped;
        for (uint256 i = 0; i < n; ++i) {
            int256 c = cals[i] < CAL_FLOOR ? CAL_FLOOR : cals[i];
            if (c > 0) c = 0;
            sumClipped += c;
        }
        return uint256(int256(CAL_SCALE) + sumClipped / int256(n));
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
