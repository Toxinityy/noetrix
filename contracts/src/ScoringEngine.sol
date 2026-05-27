// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IBonusDistributor} from "./interfaces/IBonusDistributor.sol";
import {ICategoryScorer} from "./interfaces/ICategoryScorer.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";
import {IScoringEngine} from "./interfaces/IScoringEngine.sol";

/// @title ScoringEngine
/// @notice The single contract that consumes a resolved prediction, asks the per-category scorer for
///         a score, updates the agent's per-category reputation (accuracy EMA + calibration buckets),
///         records the agent's bonus-pool contribution share, and computes the stake split that
///         PredictionMarket then physically settles.
/// @dev Invariants enforced here:
///        - score ∈ [-1e6, +1e6] (clamped before use).
///        - resolver_reward + returned_to_agent + slashed_to_pool == stake (PRD §7.2.4).
///        - resolver paid first downstream by PredictionMarket.settleStake.
///        - calibration uses §7.4.2 EMA (α = 0.1) plus the computed-on-read squared-error formula.
contract ScoringEngine is IScoringEngine, Ownable {
    int256 private constant SCORE_MAX = 1_000_000;
    int256 private constant SCORE_MIN = -1_000_000;
    int256 private constant SCORE_SCALE = 1_000_000; // 1.0 in score-fixed-point
    uint256 private constant SCORE_SCALE_U = 1_000_000;
    uint256 private constant ALPHA_NUM = 1;
    uint256 private constant ALPHA_DEN = 10;
    uint256 private constant BUCKET_COUNT = 10;
    uint256 private constant CONFIDENCE_PER_BUCKET = 1_000; // 10000 bps / 10 buckets
    uint256 private constant RESOLVER_REWARD_BPS = 200;     // 2%
    uint256 private constant BPS_DENOMINATOR = 10_000;

    error NotResolutionEngine();
    error BonusDistributorNotSet();
    error PredictionNotRevealed();
    error ZeroAddress();
    error StakeConservationViolated();

    event PredictionScored(
        uint256 indexed predictionId,
        uint256 indexed agentId,
        bytes32 indexed categoryId,
        int256 score,
        int256 newAccuracyScore,
        int256 newCalibrationScore,
        uint256 returnedToAgent,
        uint256 slashedToPool,
        uint256 resolverReward,
        uint256 bonusContribution
    );
    event ResolutionEngineSet(address indexed resolutionEngine);
    event BonusDistributorSet(address indexed bonusDistributor);

    IPredictionMarket public immutable predictionMarket;
    IAgentRegistry public immutable agentRegistry;
    address public resolutionEngine;
    address public bonusDistributor;

    modifier onlyResolutionEngine() {
        if (msg.sender != resolutionEngine) revert NotResolutionEngine();
        _;
    }

    constructor(address initialOwner, IPredictionMarket market, IAgentRegistry registry) Ownable(initialOwner) {
        if (address(market) == address(0) || address(registry) == address(0)) revert ZeroAddress();
        predictionMarket = market;
        agentRegistry = registry;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setResolutionEngine(address newResolutionEngine) external onlyOwner {
        if (newResolutionEngine == address(0)) revert ZeroAddress();
        resolutionEngine = newResolutionEngine;
        emit ResolutionEngineSet(newResolutionEngine);
    }

    function setBonusDistributor(address newBonusDistributor) external onlyOwner {
        if (newBonusDistributor == address(0)) revert ZeroAddress();
        bonusDistributor = newBonusDistributor;
        emit BonusDistributorSet(newBonusDistributor);
    }

    // ─── Main entrypoint ─────────────────────────────────────────────────────────

    /// @inheritdoc IScoringEngine
    function applyScore(
        uint256 predictionId,
        bytes calldata outcome,
        address scorer,
        bytes calldata categoryConfig,
        address resolverCaller
    ) external override onlyResolutionEngine {
        if (bonusDistributor == address(0)) revert BonusDistributorNotSet();

        IPredictionMarket.Prediction memory p = predictionMarket.getPrediction(predictionId);
        if (p.status != IPredictionMarket.PredictionStatus.Revealed) revert PredictionNotRevealed();

        int256 rawScore = ICategoryScorer(scorer).score(p.value, outcome, p.confidence, categoryConfig);
        if (rawScore > SCORE_MAX) rawScore = SCORE_MAX;
        if (rawScore < SCORE_MIN) rawScore = SCORE_MIN;

        (int256 newAccuracy, int256 newCalibration) =
            _applyReputation(p.agentId, p.categoryId, p.confidence, rawScore);

        _settleAndEmit(predictionId, p, rawScore, resolverCaller, newAccuracy, newCalibration);
    }

    // ─── Pure views (also re-exported for indexer/UI consistency) ────────────────

    /// @notice Pure computed-on-read calibration formula per PRD §7.4.2.
    function computeCalibration(int256[10] memory buckets, uint256[10] memory counts)
        external
        pure
        returns (int256)
    {
        return _calibration(buckets, counts);
    }

    /// @notice Pure stake-split helper, exposed for off-chain verification.
    function previewStakeSplit(uint256 stake, int256 score)
        external
        pure
        returns (uint256 resolverReward, uint256 returnedToAgent, uint256 slashedToPool)
    {
        if (score > SCORE_MAX) score = SCORE_MAX;
        if (score < SCORE_MIN) score = SCORE_MIN;
        return _stakeSplit(stake, score);
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    function _applyReputation(uint256 agentId, bytes32 categoryId, uint16 confidence, int256 score)
        internal
        returns (int256 newAccuracy, int256 newCalibration)
    {
        IAgentRegistry.Reputation memory rep = agentRegistry.getReputation(agentId, categoryId);
        int256[10] memory newBuckets = rep.bucketAccuracy;
        uint256[10] memory newCounts = rep.bucketCount;

        uint256 bucketIdx = uint256(confidence) / CONFIDENCE_PER_BUCKET;
        if (bucketIdx >= BUCKET_COUNT) bucketIdx = BUCKET_COUNT - 1;

        // realized accuracy mapped to [0, 1e6]: realized = (score + 1) / 2 in fixed point.
        int256 realizedScaled = (score + SCORE_SCALE) / 2;

        // EMA: new = ((ALPHA_DEN - ALPHA_NUM) * old + ALPHA_NUM * realized) / ALPHA_DEN
        newBuckets[bucketIdx] = (
            int256(ALPHA_DEN - ALPHA_NUM) * newBuckets[bucketIdx] + int256(ALPHA_NUM) * realizedScaled
        ) / int256(ALPHA_DEN);
        newCounts[bucketIdx] += 1;

        newAccuracy =
            (int256(ALPHA_DEN - ALPHA_NUM) * rep.accuracyScore + int256(ALPHA_NUM) * score) / int256(ALPHA_DEN);
        newCalibration = _calibration(newBuckets, newCounts);

        agentRegistry.updateReputation(agentId, categoryId, newAccuracy, newCalibration, newBuckets, newCounts);
    }

    function _settleAndEmit(
        uint256 predictionId,
        IPredictionMarket.Prediction memory p,
        int256 score,
        address resolverCaller,
        int256 newAccuracy,
        int256 newCalibration
    ) internal {
        (uint256 resolverReward, uint256 returnedToAgent, uint256 slashedToPool) = _stakeSplit(p.stake, score);
        if (resolverReward + returnedToAgent + slashedToPool != p.stake) revert StakeConservationViolated();

        uint256 contribShare = _bonusContribution(score, p.stake);

        predictionMarket.setScore(predictionId, score);
        if (contribShare > 0) {
            IBonusDistributor(bonusDistributor).recordContribution(p.categoryId, p.agentId, contribShare);
        }
        predictionMarket.settleStake(predictionId, returnedToAgent, slashedToPool, resolverReward, resolverCaller);

        emit PredictionScored(
            predictionId,
            p.agentId,
            p.categoryId,
            score,
            newAccuracy,
            newCalibration,
            returnedToAgent,
            slashedToPool,
            resolverReward,
            contribShare
        );
    }

    function _calibration(int256[10] memory buckets, uint256[10] memory counts) internal pure returns (int256) {
        uint256 total;
        for (uint256 i = 0; i < BUCKET_COUNT; ++i) {
            total += counts[i];
        }
        if (total < BUCKET_COUNT) return 0;

        int256 sumWeightedSq;
        for (uint256 i = 0; i < BUCKET_COUNT; ++i) {
            int256 midpoint = int256(i * 100_000 + 50_000);
            int256 diff = midpoint - buckets[i];
            int256 sq = diff * diff;
            sumWeightedSq += sq * int256(counts[i]);
        }

        int256 denom = int256(total * SCORE_SCALE_U);
        int256 cal = -((sumWeightedSq * 4) / denom);
        if (cal < -SCORE_SCALE) cal = -SCORE_SCALE;
        if (cal > 0) cal = 0;
        return cal;
    }

    function _stakeSplit(uint256 stake, int256 score)
        internal
        pure
        returns (uint256 resolverReward, uint256 returnedToAgent, uint256 slashedToPool)
    {
        resolverReward = (stake * RESOLVER_REWARD_BPS) / BPS_DENOMINATOR;
        uint256 remaining = stake - resolverReward;

        // return_rate = 0.5 + 0.5 * score_norm; scaled by 1e6 → 5e5 + score/2.
        int256 rateScaled = (SCORE_SCALE / 2) + (score / 2);
        if (rateScaled < 0) rateScaled = 0;
        if (rateScaled > SCORE_SCALE) rateScaled = SCORE_SCALE;

        returnedToAgent = (remaining * uint256(rateScaled)) / SCORE_SCALE_U;
        slashedToPool = remaining - returnedToAgent;
    }

    function _bonusContribution(int256 score, uint256 stake) internal pure returns (uint256) {
        if (score <= 0) return 0;
        uint256 s = uint256(score);
        // share = (max(0, score_norm))^2 * stake = (score * score * stake) / (SCALE * SCALE)
        return (s * s * stake) / (SCORE_SCALE_U * SCORE_SCALE_U);
    }
}
