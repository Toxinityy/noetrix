// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IBonusDistributor} from "./interfaces/IBonusDistributor.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";

/// @title PredictionMarket — commit-reveal escrow for agent forecasts
/// @notice Agents stake native MNT, commit a hash, reveal value/confidence/nonce in a bounded
///         block window, then have stake settled by ScoringEngine via `settleStake`. Cancellation
///         and reveal-failure paths route slashed stake to the BonusDistributor.
/// @dev Invariants:
///      - Stake conservation in settleStake: returnAmount + bonusAmount + resolverReward == stake
///      - Resolver paid first in settleStake (PRD §7.2.4)
///      - Cancellation: 90% refund, 10% slash to pool
///      - Forfeit: 0.5% caller reward, 99.5% to pool
contract PredictionMarket is IPredictionMarket, Ownable, ReentrancyGuard {
    error CategoryNotRegistered();
    error CategoryAlreadyRegistered();
    error InvalidCategoryConfig();
    error ResolutionTooSoon();
    error ResolutionOutsideAllowedWindow();
    error StakeBelowMinimum();
    error NotAgentController();
    error PredictionDoesNotExist();
    error InvalidStatusForOperation();
    error CommitHashMismatch();
    error RevealTooEarly();
    error RevealTooLate();
    error RevealTooCloseToResolution();
    error ConfidenceOutOfRange();
    error CancelAfterResolutionBlock();
    error ForfeitWindowNotElapsed();
    error OnlyScoringEngine();
    error BonusPoolNotSet();
    error StakeConservationViolated();
    error TransferFailed();
    error ZeroAddress();

    uint256 public constant REVEAL_DELAY_BLOCKS = 10;
    uint256 public constant REVEAL_WINDOW_BLOCKS = 100;
    uint256 public constant SUBMISSION_CUTOFF_BLOCKS = 200;
    uint256 public constant MIN_RESOLUTION_OFFSET = SUBMISSION_CUTOFF_BLOCKS + REVEAL_WINDOW_BLOCKS; // 300

    uint256 public constant CANCEL_REFUND_BPS = 9000;   // 90% returned
    uint256 public constant FORFEIT_CALLER_BPS = 50;    // 0.5% caller reward
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant MAX_CONFIDENCE_BPS = 10000;

    IAgentRegistry public immutable agentRegistry;
    address public bonusPool;
    address public scoringEngine;

    uint256 public nextPredictionId = 1;
    mapping(uint256 => Prediction) internal _predictions;
    mapping(bytes32 => Category) internal _categories;

    modifier onlyScoringEngine() {
        if (msg.sender != scoringEngine) revert OnlyScoringEngine();
        _;
    }

    constructor(address initialOwner, IAgentRegistry registry) Ownable(initialOwner) {
        if (address(registry) == address(0)) revert ZeroAddress();
        agentRegistry = registry;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setBonusPool(address newBonusPool) external onlyOwner {
        if (newBonusPool == address(0)) revert ZeroAddress();
        bonusPool = newBonusPool;
        emit BonusPoolSet(newBonusPool);
    }

    function setScoringEngine(address newScoringEngine) external onlyOwner {
        if (newScoringEngine == address(0)) revert ZeroAddress();
        scoringEngine = newScoringEngine;
        emit ScoringEngineSet(newScoringEngine);
    }

    /// @notice Register or update a category's resolver/scorer/stake/window config.
    /// @dev Governance-controlled in production. `allowedWindowStart` must be >= MIN_RESOLUTION_OFFSET
    ///      so any valid commit's resolutionBlock leaves room for the reveal window + submission cutoff.
    function registerCategory(
        bytes32 categoryId,
        address resolver,
        address scorer,
        uint256 minStake,
        uint256 allowedWindowStart,
        uint256 allowedWindowEnd,
        bytes calldata configBytes
    ) external onlyOwner {
        if (_categories[categoryId].registered) revert CategoryAlreadyRegistered();
        if (resolver == address(0) || scorer == address(0)) revert ZeroAddress();
        if (allowedWindowEnd < allowedWindowStart) revert InvalidCategoryConfig();
        if (allowedWindowStart < MIN_RESOLUTION_OFFSET) revert InvalidCategoryConfig();
        _categories[categoryId] = Category({
            resolver: resolver,
            scorer: scorer,
            minStake: minStake,
            allowedWindowStart: allowedWindowStart,
            allowedWindowEnd: allowedWindowEnd,
            configBytes: configBytes,
            registered: true
        });
        emit CategoryRegistered(categoryId, resolver, scorer, minStake, allowedWindowStart, allowedWindowEnd);
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────────

    function commit(
        uint256 agentId,
        bytes32 categoryId,
        bytes32 commitHash,
        uint256 resolutionBlock,
        bytes32 contentHash
    ) external payable nonReentrant returns (uint256 predictionId) {
        Category storage cat = _categories[categoryId];
        if (!cat.registered) revert CategoryNotRegistered();
        if (resolutionBlock < block.number + MIN_RESOLUTION_OFFSET) revert ResolutionTooSoon();
        uint256 delta = resolutionBlock - block.number;
        if (delta < cat.allowedWindowStart || delta > cat.allowedWindowEnd) revert ResolutionOutsideAllowedWindow();
        if (msg.value < cat.minStake) revert StakeBelowMinimum();
        if (msg.sender != agentRegistry.controllerOf(agentId)) revert NotAgentController();

        predictionId = nextPredictionId++;
        Prediction storage p = _predictions[predictionId];
        p.agentId = agentId;
        p.categoryId = categoryId;
        p.commitHash = commitHash;
        p.contentHash = contentHash;
        p.stake = msg.value;
        p.commitBlock = block.number;
        p.resolutionBlock = resolutionBlock;
        p.status = PredictionStatus.Committed;

        emit PredictionCommitted(
            predictionId, agentId, categoryId, commitHash, resolutionBlock, contentHash, msg.value, block.number
        );
    }

    function reveal(uint256 predictionId, bytes calldata value, uint16 confidence, bytes32 nonce) external {
        Prediction storage p = _predictions[predictionId];
        if (p.commitBlock == 0) revert PredictionDoesNotExist();
        if (p.status != PredictionStatus.Committed) revert InvalidStatusForOperation();
        if (confidence > MAX_CONFIDENCE_BPS) revert ConfidenceOutOfRange();
        bytes32 expected = keccak256(abi.encode(p.agentId, p.categoryId, value, confidence, nonce));
        if (expected != p.commitHash) revert CommitHashMismatch();
        if (block.number < p.commitBlock + REVEAL_DELAY_BLOCKS) revert RevealTooEarly();
        if (block.number > p.commitBlock + REVEAL_WINDOW_BLOCKS) revert RevealTooLate();
        if (block.number > p.resolutionBlock - SUBMISSION_CUTOFF_BLOCKS) revert RevealTooCloseToResolution();

        p.value = value;
        p.confidence = confidence;
        p.status = PredictionStatus.Revealed;

        emit PredictionRevealed(predictionId, value, confidence, block.number);
    }

    function cancel(uint256 predictionId) external nonReentrant {
        Prediction storage p = _predictions[predictionId];
        if (p.commitBlock == 0) revert PredictionDoesNotExist();
        if (p.status != PredictionStatus.Committed && p.status != PredictionStatus.Revealed) {
            revert InvalidStatusForOperation();
        }
        if (block.number >= p.resolutionBlock) revert CancelAfterResolutionBlock();
        address controller = agentRegistry.controllerOf(p.agentId);
        if (msg.sender != controller) revert NotAgentController();
        if (bonusPool == address(0)) revert BonusPoolNotSet();

        uint256 stake = p.stake;
        uint256 refund = (stake * CANCEL_REFUND_BPS) / BPS_DENOMINATOR;
        uint256 slash = stake - refund;
        p.status = PredictionStatus.Cancelled;

        _sendValue(controller, refund);
        IBonusDistributor(bonusPool).notifySlash{value: slash}(p.categoryId);

        emit PredictionCancelled(predictionId, refund, slash);
    }

    function forfeitUnrevealed(uint256 predictionId) external nonReentrant {
        Prediction storage p = _predictions[predictionId];
        if (p.commitBlock == 0) revert PredictionDoesNotExist();
        if (p.status != PredictionStatus.Committed) revert InvalidStatusForOperation();
        if (block.number <= p.commitBlock + REVEAL_WINDOW_BLOCKS) revert ForfeitWindowNotElapsed();
        if (bonusPool == address(0)) revert BonusPoolNotSet();

        uint256 stake = p.stake;
        uint256 callerReward = (stake * FORFEIT_CALLER_BPS) / BPS_DENOMINATOR;
        uint256 poolAmount = stake - callerReward;
        p.status = PredictionStatus.Forfeited;

        _sendValue(msg.sender, callerReward);
        IBonusDistributor(bonusPool).notifySlash{value: poolAmount}(p.categoryId);

        emit PredictionForfeited(predictionId, msg.sender, callerReward, poolAmount);
    }

    /// @inheritdoc IPredictionMarket
    function settleStake(
        uint256 predictionId,
        uint256 returnAmount,
        uint256 bonusAmount,
        uint256 resolverReward,
        address resolver
    ) external nonReentrant onlyScoringEngine {
        Prediction storage p = _predictions[predictionId];
        if (p.commitBlock == 0) revert PredictionDoesNotExist();
        if (p.status != PredictionStatus.Revealed) revert InvalidStatusForOperation();
        if (returnAmount + bonusAmount + resolverReward != p.stake) revert StakeConservationViolated();
        if (bonusPool == address(0)) revert BonusPoolNotSet();
        if (resolver == address(0)) revert ZeroAddress();

        p.status = PredictionStatus.Resolved;
        address controller = agentRegistry.controllerOf(p.agentId);

        // Resolver paid first per invariant §7.2.4.
        if (resolverReward > 0) _sendValue(resolver, resolverReward);
        if (returnAmount > 0) _sendValue(controller, returnAmount);
        if (bonusAmount > 0) IBonusDistributor(bonusPool).notifySlash{value: bonusAmount}(p.categoryId);

        emit PredictionResolved(predictionId, p.score, returnAmount, bonusAmount, resolverReward, resolver);
    }

    /// @notice Persists the integer score for a prediction. Called by ScoringEngine prior to settleStake.
    function setScore(uint256 predictionId, int256 score) external onlyScoringEngine {
        Prediction storage p = _predictions[predictionId];
        if (p.commitBlock == 0) revert PredictionDoesNotExist();
        p.score = score;
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    function getPrediction(uint256 predictionId) external view returns (Prediction memory) {
        return _predictions[predictionId];
    }

    function getCategory(bytes32 categoryId) external view returns (Category memory) {
        return _categories[categoryId];
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    function _sendValue(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
