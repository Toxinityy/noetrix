// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPredictionMarket {
    enum PredictionStatus {
        Committed,
        Revealed,
        Resolved,
        Cancelled,
        Forfeited
    }

    struct Prediction {
        uint256 agentId;
        bytes32 categoryId;
        bytes32 commitHash;
        bytes value;
        uint16 confidence;
        bytes32 contentHash;
        uint256 stake;
        uint256 commitBlock;
        uint256 resolutionBlock;
        PredictionStatus status;
        int256 score;
    }

    struct Category {
        address resolver;
        address scorer;
        uint256 minStake;
        uint256 allowedWindowStart;
        uint256 allowedWindowEnd;
        bytes configBytes;
        bool registered;
    }

    event CategoryRegistered(
        bytes32 indexed categoryId,
        address resolver,
        address scorer,
        uint256 minStake,
        uint256 allowedWindowStart,
        uint256 allowedWindowEnd
    );

    event PredictionCommitted(
        uint256 indexed predictionId,
        uint256 indexed agentId,
        bytes32 indexed categoryId,
        bytes32 commitHash,
        uint256 resolutionBlock,
        bytes32 contentHash,
        uint256 stake,
        uint256 commitBlock
    );

    event PredictionRevealed(
        uint256 indexed predictionId, bytes value, uint16 confidence, uint256 revealBlock
    );

    event PredictionCancelled(uint256 indexed predictionId, uint256 refundAmount, uint256 slashedAmount);

    event PredictionForfeited(uint256 indexed predictionId, address indexed caller, uint256 callerReward, uint256 poolAmount);

    event PredictionResolved(
        uint256 indexed predictionId,
        int256 score,
        uint256 returnAmount,
        uint256 bonusAmount,
        uint256 resolverReward,
        address resolver
    );

    event BonusPoolSet(address indexed bonusPool);
    event ScoringEngineSet(address indexed scoringEngine);

    function commit(
        uint256 agentId,
        bytes32 categoryId,
        bytes32 commitHash,
        uint256 resolutionBlock,
        bytes32 contentHash
    ) external payable returns (uint256 predictionId);

    function reveal(uint256 predictionId, bytes calldata value, uint16 confidence, bytes32 nonce) external;

    function cancel(uint256 predictionId) external;

    function forfeitUnrevealed(uint256 predictionId) external;

    function settleStake(
        uint256 predictionId,
        uint256 returnAmount,
        uint256 bonusAmount,
        uint256 resolverReward,
        address resolver
    ) external;

    function getPrediction(uint256 predictionId) external view returns (Prediction memory);

    function getCategory(bytes32 categoryId) external view returns (Category memory);
}
