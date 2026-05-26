// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";

/// @title AgentRegistry — ERC-8004 soulbound agent identity + per-category reputation
/// @notice Agent identity is a non-transferable ERC721. Reputation updates from a designated
///         ScoringEngine. Maintains `topAgents[categoryId]` sorted (accuracyScore desc, tiebreak
///         lower agentId), gated by `resolvedCount >= TOP_AGENT_MIN_RESOLVED`. Top list is read
///         by CompositeFeed to cap enumeration cost.
contract AgentRegistry is ERC721, Ownable, IAgentRegistry {
    error IncorrectRegistrationFee();
    error TransfersDisabled();
    error NotController();
    error InvalidNewController();
    error NoPendingRotation();
    error TimelockNotElapsed();
    error OnlyScoringEngine();
    error AgentDoesNotExist();
    error TreasuryNotSet();
    error TransferFailed();
    error ControllerAlreadyBound();

    uint256 public constant REGISTRATION_FEE = 0.1 ether;
    uint256 public constant TOP_AGENT_MIN_RESOLVED = 10;
    uint256 public constant ROTATION_TIMELOCK = 24 hours;
    uint256 public constant TOP_AGENTS_SIZE = 20;

    address public treasury;
    address public scoringEngine;
    uint256 public nextAgentId = 1;

    struct PendingRotation {
        address proposed;
        uint256 executableAt;
    }

    mapping(uint256 => AgentProfile) internal _agents;
    mapping(uint256 => mapping(bytes32 => Reputation)) internal _reputation;
    mapping(address => uint256) public controllerToAgent;
    mapping(uint256 => PendingRotation) public pendingRotation;

    // categoryId => fixed-size top-20 ranked array (slot 0 = best). Zero entries = unfilled.
    mapping(bytes32 => uint256[TOP_AGENTS_SIZE]) internal _topAgents;

    modifier onlyScoringEngine() {
        if (msg.sender != scoringEngine) revert OnlyScoringEngine();
        _;
    }

    constructor(address initialOwner, address initialTreasury) ERC721("Predictor Index Agent", "PIA") Ownable(initialOwner) {
        if (initialTreasury == address(0)) revert TreasuryNotSet();
        treasury = initialTreasury;
        emit TreasurySet(initialTreasury);
    }

    function setScoringEngine(address newScoringEngine) external onlyOwner {
        scoringEngine = newScoringEngine;
        emit ScoringEngineSet(newScoringEngine);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert TreasuryNotSet();
        treasury = newTreasury;
        emit TreasurySet(newTreasury);
    }

    function register(string calldata metadataURI) external payable returns (uint256 agentId) {
        if (msg.value != REGISTRATION_FEE) revert IncorrectRegistrationFee();
        if (controllerToAgent[msg.sender] != 0) revert ControllerAlreadyBound();

        agentId = nextAgentId++;
        _agents[agentId] = AgentProfile({
            controller: msg.sender,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            totalPredictions: 0,
            totalResolved: 0
        });
        controllerToAgent[msg.sender] = agentId;

        _safeMint(msg.sender, agentId);

        (bool ok,) = treasury.call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    function proposeControllerRotation(uint256 agentId, address newController) external {
        AgentProfile storage profile = _agents[agentId];
        if (profile.controller == address(0)) revert AgentDoesNotExist();
        if (msg.sender != profile.controller) revert NotController();
        if (newController == address(0) || newController == profile.controller) revert InvalidNewController();
        if (controllerToAgent[newController] != 0) revert ControllerAlreadyBound();

        uint256 executableAt = block.timestamp + ROTATION_TIMELOCK;
        pendingRotation[agentId] = PendingRotation({proposed: newController, executableAt: executableAt});

        emit ControllerRotationProposed(agentId, profile.controller, newController, executableAt);
    }

    function executeControllerRotation(uint256 agentId) external {
        AgentProfile storage profile = _agents[agentId];
        if (profile.controller == address(0)) revert AgentDoesNotExist();

        PendingRotation memory pending = pendingRotation[agentId];
        if (pending.proposed == address(0)) revert NoPendingRotation();
        if (block.timestamp < pending.executableAt) revert TimelockNotElapsed();
        if (msg.sender != profile.controller && msg.sender != pending.proposed) revert NotController();
        if (controllerToAgent[pending.proposed] != 0) revert ControllerAlreadyBound();

        address previous = profile.controller;
        delete controllerToAgent[previous];

        profile.controller = pending.proposed;
        controllerToAgent[pending.proposed] = agentId;

        // Soulbound transfer: bypass approval/transfer hook by burning + minting? No — keep token at
        // existing owner address conceptually tied to agentId, but reflect new controller in profile.
        // The ERC721 token itself remains at the original minter address; controller mutation is the
        // canonical authority handle. This preserves "soulbound to identity" while allowing key rotation.

        delete pendingRotation[agentId];

        emit ControllerRotated(agentId, previous, pending.proposed);
    }

    function updateReputation(
        uint256 agentId,
        bytes32 categoryId,
        int256 newAccuracyScore,
        int256 newCalibrationScore,
        int256[10] calldata newBucketAccuracy,
        uint256[10] calldata newBucketCount
    ) external onlyScoringEngine {
        AgentProfile storage profile = _agents[agentId];
        if (profile.controller == address(0)) revert AgentDoesNotExist();

        Reputation storage rep = _reputation[agentId][categoryId];
        rep.accuracyScore = newAccuracyScore;
        rep.calibrationScore = newCalibrationScore;
        rep.resolvedCount += 1;
        rep.lastUpdatedBlock = block.number;
        for (uint256 i; i < 10; ++i) {
            rep.bucketAccuracy[i] = newBucketAccuracy[i];
            rep.bucketCount[i] = newBucketCount[i];
        }

        profile.totalResolved += 1;

        _updateTopAgents(categoryId, agentId);

        emit ReputationUpdated(agentId, categoryId, newAccuracyScore, newCalibrationScore, rep.resolvedCount);
    }

    /// @dev Insertion-sort + eviction. Loads top-20 to memory, recomputes the slot for `agentId`,
    ///      writes back if changed. O(20) per update — acceptable bound.
    function _updateTopAgents(bytes32 categoryId, uint256 agentId) internal {
        Reputation storage rep = _reputation[agentId][categoryId];

        // Local copy of top-20.
        uint256[TOP_AGENTS_SIZE] memory top;
        for (uint256 i; i < TOP_AGENTS_SIZE; ++i) {
            top[i] = _topAgents[categoryId][i];
        }

        // Remove existing entry if present.
        uint256 existingIdx = type(uint256).max;
        for (uint256 i; i < TOP_AGENTS_SIZE; ++i) {
            if (top[i] == agentId) {
                existingIdx = i;
                break;
            }
        }
        if (existingIdx != type(uint256).max) {
            for (uint256 i = existingIdx; i + 1 < TOP_AGENTS_SIZE; ++i) {
                top[i] = top[i + 1];
            }
            top[TOP_AGENTS_SIZE - 1] = 0;
        }

        // Gate: agent must have enough resolutions to qualify.
        if (rep.resolvedCount >= TOP_AGENT_MIN_RESOLVED) {
            int256 candidateScore = rep.accuracyScore;

            // Find insertion index: first slot where (slot is empty) OR (candidate ranks higher).
            uint256 insertAt = TOP_AGENTS_SIZE;
            for (uint256 i; i < TOP_AGENTS_SIZE; ++i) {
                uint256 occupant = top[i];
                if (occupant == 0) {
                    insertAt = i;
                    break;
                }
                int256 occupantScore = _reputation[occupant][categoryId].accuracyScore;
                if (candidateScore > occupantScore) {
                    insertAt = i;
                    break;
                }
                if (candidateScore == occupantScore && agentId < occupant) {
                    insertAt = i;
                    break;
                }
            }

            if (insertAt < TOP_AGENTS_SIZE) {
                // Shift right and insert.
                for (uint256 i = TOP_AGENTS_SIZE - 1; i > insertAt; --i) {
                    top[i] = top[i - 1];
                }
                top[insertAt] = agentId;
            }
        }

        // Write back any changed slots.
        for (uint256 i; i < TOP_AGENTS_SIZE; ++i) {
            if (_topAgents[categoryId][i] != top[i]) {
                _topAgents[categoryId][i] = top[i];
            }
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function controllerOf(uint256 agentId) external view returns (address) {
        return _agents[agentId].controller;
    }

    function getAgent(uint256 agentId) external view returns (AgentProfile memory) {
        return _agents[agentId];
    }

    function getReputation(uint256 agentId, bytes32 categoryId) external view returns (Reputation memory) {
        return _reputation[agentId][categoryId];
    }

    function getTopAgents(bytes32 categoryId) external view returns (uint256[TOP_AGENTS_SIZE] memory) {
        return _topAgents[categoryId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _agents[tokenId].metadataURI;
    }

    // ─── Soulbound enforcement ────────────────────────────────────────────────

    /// @dev Allow mint (`from == 0`) and burn (`to == 0`); revert all transfers.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }
}
