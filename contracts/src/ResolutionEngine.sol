// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICategoryResolver} from "./interfaces/ICategoryResolver.sol";
import {IScoringEngine} from "./interfaces/IScoringEngine.sol";
import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";

/// @title ResolutionEngine — atomic resolver+scorer registry and resolve dispatcher
/// @notice Single source of truth for the (categoryId → resolver, scorer, configBytes) tuple.
///         `resolve()` is permissionless; the caller is forwarded to ScoringEngine and
///         ultimately paid the 2% gas reward inside PredictionMarket.settleStake.
contract ResolutionEngine is Ownable {
    error CategoryAlreadyRegistered();
    error CategoryNotRegistered();
    error AlreadyResolved();
    error PredictionNotRevealed();
    error ResolutionBlockNotReached();
    error ScoringEngineNotSet();
    error ZeroAddress();

    event CategoryRegistered(bytes32 indexed categoryId, address resolver, address scorer);
    event CategoryUpdated(bytes32 indexed categoryId, address resolver, address scorer);
    event ScoringEngineSet(address indexed scoringEngine);
    event ResolveDispatched(uint256 indexed predictionId, bytes32 indexed categoryId, address indexed caller);

    IPredictionMarket public immutable market;
    address public scoringEngine;

    mapping(bytes32 => address) public resolvers;
    mapping(bytes32 => address) public scorers;
    mapping(bytes32 => bytes) public categoryConfig;

    constructor(address initialOwner, IPredictionMarket _market) Ownable(initialOwner) {
        if (address(_market) == address(0)) revert ZeroAddress();
        market = _market;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setScoringEngine(address newScoringEngine) external onlyOwner {
        if (newScoringEngine == address(0)) revert ZeroAddress();
        scoringEngine = newScoringEngine;
        emit ScoringEngineSet(newScoringEngine);
    }

    /// @notice Registers resolver+scorer+config for a category atomically.
    function registerCategory(bytes32 categoryId, address resolver, address scorer, bytes calldata config)
        external
        onlyOwner
    {
        if (resolvers[categoryId] != address(0)) revert CategoryAlreadyRegistered();
        if (resolver == address(0) || scorer == address(0)) revert ZeroAddress();
        resolvers[categoryId] = resolver;
        scorers[categoryId] = scorer;
        categoryConfig[categoryId] = config;
        emit CategoryRegistered(categoryId, resolver, scorer);
    }

    /// @notice Updates an already-registered category in-place.
    function updateCategory(bytes32 categoryId, address resolver, address scorer, bytes calldata config)
        external
        onlyOwner
    {
        if (resolvers[categoryId] == address(0)) revert CategoryNotRegistered();
        if (resolver == address(0) || scorer == address(0)) revert ZeroAddress();
        resolvers[categoryId] = resolver;
        scorers[categoryId] = scorer;
        categoryConfig[categoryId] = config;
        emit CategoryUpdated(categoryId, resolver, scorer);
    }

    // ─── Resolve ─────────────────────────────────────────────────────────────────

    /// @notice Resolves a revealed prediction and dispatches scoring. Anyone may call.
    /// @dev Reads prediction state from PredictionMarket, calls the per-category resolver to
    ///      produce an `outcome` blob, then forwards to ScoringEngine.applyScore. ScoringEngine
    ///      eventually calls PredictionMarket.settleStake with `msg.sender` as the resolver
    ///      address that earns the 2% gas reward.
    function resolve(uint256 predictionId) external {
        if (scoringEngine == address(0)) revert ScoringEngineNotSet();

        IPredictionMarket.Prediction memory p = market.getPrediction(predictionId);

        if (p.status == IPredictionMarket.PredictionStatus.Resolved) revert AlreadyResolved();
        if (p.status != IPredictionMarket.PredictionStatus.Revealed) revert PredictionNotRevealed();
        if (block.number < p.resolutionBlock) revert ResolutionBlockNotReached();

        address resolver = resolvers[p.categoryId];
        if (resolver == address(0)) revert CategoryNotRegistered();

        bytes memory outcome = ICategoryResolver(resolver).resolve(p.value, p.resolutionBlock);

        emit ResolveDispatched(predictionId, p.categoryId, msg.sender);

        IScoringEngine(scoringEngine).applyScore(
            predictionId, outcome, scorers[p.categoryId], categoryConfig[p.categoryId], msg.sender
        );
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    function getCategory(bytes32 categoryId)
        external
        view
        returns (address resolver, address scorer, bytes memory config)
    {
        return (resolvers[categoryId], scorers[categoryId], categoryConfig[categoryId]);
    }
}
