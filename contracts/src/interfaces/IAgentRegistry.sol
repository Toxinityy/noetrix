// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IAgentRegistry {
    struct AgentProfile {
        address controller;
        string metadataURI;
        uint256 registeredAt;
        uint256 totalPredictions;
        uint256 totalResolved;
    }

    struct Reputation {
        int256 accuracyScore;
        int256 calibrationScore;
        uint256 resolvedCount;
        uint256 lastUpdatedBlock;
        int256[10] bucketAccuracy;
        uint256[10] bucketCount;
    }

    event AgentRegistered(uint256 indexed agentId, address indexed controller, string metadataURI);
    event ControllerRotationProposed(
        uint256 indexed agentId, address indexed currentController, address indexed proposedController, uint256 executableAt
    );
    event ControllerRotated(uint256 indexed agentId, address indexed previousController, address indexed newController);
    event ReputationUpdated(
        uint256 indexed agentId,
        bytes32 indexed categoryId,
        int256 accuracyScore,
        int256 calibrationScore,
        uint256 resolvedCount
    );
    event ScoringEngineSet(address indexed scoringEngine);
    event TreasurySet(address indexed treasury);

    function register(string calldata metadataURI) external payable returns (uint256 agentId);

    function proposeControllerRotation(uint256 agentId, address newController) external;
    function executeControllerRotation(uint256 agentId) external;

    function updateReputation(
        uint256 agentId,
        bytes32 categoryId,
        int256 newAccuracyScore,
        int256 newCalibrationScore,
        int256[10] calldata newBucketAccuracy,
        uint256[10] calldata newBucketCount
    ) external;

    function controllerOf(uint256 agentId) external view returns (address);
    function getAgent(uint256 agentId) external view returns (AgentProfile memory);
    function getReputation(uint256 agentId, bytes32 categoryId) external view returns (Reputation memory);
    function getTopAgents(bytes32 categoryId) external view returns (uint256[20] memory);
}
