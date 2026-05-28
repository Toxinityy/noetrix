// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRegistry} from "./interfaces/IAgentRegistry.sol";
import {IBonusDistributor} from "./interfaces/IBonusDistributor.sol";

/// @title BonusDistributor — per-(category, epoch) bonus pool, PULL-CLAIM (no iteration)
/// @notice Slashed stake (cancel/forfeit/resolution) flows in via `notifySlash` (payable, msg.value).
///         ScoringEngine records each agent's weight via `recordContribution`. After an epoch closes,
///         anyone calls `finalizeEpoch` (paid a 0.5% gas reward); each agent then pulls its share via
///         `claimBonus`. There is NO loop over agents and NO push distribution — gas DoS resistant.
/// @dev Invariants:
///        - Epoch = block.number / EPOCH_BLOCKS (1000 blocks ≈ 33 min on Mantle 2s blocks).
///        - finalPool = rawPool - rollover(5%) - finalizerReward(0.5%); rollover credited to epoch+1.
///        - Σ all claimable ≤ finalPool (floor division leaves dust unclaimable in the contract).
contract BonusDistributor is IBonusDistributor, Ownable, ReentrancyGuard {
    uint256 public constant EPOCH_BLOCKS = 1000;
    uint256 public constant ROLLOVER_BPS = 500; // 5%
    uint256 public constant FINALIZER_BPS = 50; // 0.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;

    error NotAuthorized();
    error ZeroAddress();
    error AlreadyFinalized();
    error EpochNotEnded();
    error NotFinalized();
    error AlreadyClaimed();
    error NoShare();
    error NotAgentController();
    error TransferFailed();

    event AuthorizedSet(address indexed account, bool authorized);
    event Slashed(bytes32 indexed categoryId, uint256 indexed epoch, uint256 amount);
    event ContributionRecorded(bytes32 indexed categoryId, uint256 indexed epoch, uint256 indexed agentId, uint256 weight);
    event EpochFinalized(
        bytes32 indexed categoryId,
        uint256 indexed epoch,
        uint256 rawPool,
        uint256 finalPool,
        uint256 rollover,
        uint256 finalizerReward,
        address finalizer
    );
    event BonusClaimed(bytes32 indexed categoryId, uint256 indexed epoch, uint256 indexed agentId, address controller, uint256 amount);

    IAgentRegistry public immutable agentRegistry;

    mapping(address => bool) public authorized;

    // categoryId => epoch => total pool (mutable: grows via slash/rollover, frozen at finalize)
    mapping(bytes32 => mapping(uint256 => uint256)) public pool;
    // categoryId => epoch => sum of agent weights
    mapping(bytes32 => mapping(uint256 => uint256)) public totalShare;
    // categoryId => epoch => agentId => weight
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) public agentShare;
    // categoryId => epoch => finalized?
    mapping(bytes32 => mapping(uint256 => bool)) public finalized;
    // categoryId => epoch => claimable pool after rollover + finalizer reward
    mapping(bytes32 => mapping(uint256 => uint256)) public finalPool;
    // categoryId => epoch => agentId => claimed?
    mapping(bytes32 => mapping(uint256 => mapping(uint256 => bool))) public claimed;

    modifier onlyAuthorized() {
        if (!authorized[msg.sender]) revert NotAuthorized();
        _;
    }

    constructor(address initialOwner, IAgentRegistry registry) Ownable(initialOwner) {
        if (address(registry) == address(0)) revert ZeroAddress();
        agentRegistry = registry;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────────

    function setAuthorized(address account, bool isAuthorized) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        authorized[account] = isAuthorized;
        emit AuthorizedSet(account, isAuthorized);
    }

    // ─── Inflows (authorized: PredictionMarket + ScoringEngine) ────────────────────

    /// @inheritdoc IBonusDistributor
    /// @dev Slashed amount is carried as msg.value (keeps native MNT conservation end-to-end).
    function notifySlash(bytes32 categoryId) external payable onlyAuthorized {
        uint256 epoch = currentEpoch();
        pool[categoryId][epoch] += msg.value;
        emit Slashed(categoryId, epoch, msg.value);
    }

    /// @inheritdoc IBonusDistributor
    function recordContribution(bytes32 categoryId, uint256 agentId, uint256 weight) external onlyAuthorized {
        uint256 epoch = currentEpoch();
        agentShare[categoryId][epoch][agentId] += weight;
        totalShare[categoryId][epoch] += weight;
        emit ContributionRecorded(categoryId, epoch, agentId, weight);
    }

    // ─── Epoch lifecycle ───────────────────────────────────────────────────────────

    /// @notice Closes an ended epoch: deducts rollover (to next epoch) + finalizer reward, freezes the
    ///         claimable pool. Permissionless; caller paid FINALIZER_BPS of the raw pool.
    function finalizeEpoch(bytes32 categoryId, uint256 epoch) external nonReentrant {
        if (finalized[categoryId][epoch]) revert AlreadyFinalized();
        if (block.number < (epoch + 1) * EPOCH_BLOCKS) revert EpochNotEnded();

        uint256 rawPool = pool[categoryId][epoch];
        uint256 rollover = (rawPool * ROLLOVER_BPS) / BPS_DENOMINATOR;
        uint256 finalizerReward = (rawPool * FINALIZER_BPS) / BPS_DENOMINATOR;

        finalPool[categoryId][epoch] = rawPool - rollover - finalizerReward;
        pool[categoryId][epoch + 1] += rollover;
        finalized[categoryId][epoch] = true;

        emit EpochFinalized(categoryId, epoch, rawPool, finalPool[categoryId][epoch], rollover, finalizerReward, msg.sender);

        if (finalizerReward > 0) _sendValue(msg.sender, finalizerReward);
    }

    /// @notice Agent (via its controller) pulls its share of a finalized epoch's pool.
    function claimBonus(bytes32 categoryId, uint256 epoch, uint256 agentId) external nonReentrant {
        if (!finalized[categoryId][epoch]) revert NotFinalized();
        if (claimed[categoryId][epoch][agentId]) revert AlreadyClaimed();
        if (msg.sender != agentRegistry.controllerOf(agentId)) revert NotAgentController();

        uint256 share = agentShare[categoryId][epoch][agentId];
        uint256 total = totalShare[categoryId][epoch];
        if (total == 0 || share == 0) revert NoShare();

        uint256 amount = (finalPool[categoryId][epoch] * share) / total;
        claimed[categoryId][epoch][agentId] = true;

        emit BonusClaimed(categoryId, epoch, agentId, msg.sender, amount);

        if (amount > 0) _sendValue(msg.sender, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    function currentEpoch() public view returns (uint256) {
        return block.number / EPOCH_BLOCKS;
    }

    /// @notice Preview of an agent's claimable amount for a finalized epoch (0 before finalize).
    function claimable(bytes32 categoryId, uint256 epoch, uint256 agentId) external view returns (uint256) {
        if (!finalized[categoryId][epoch] || claimed[categoryId][epoch][agentId]) return 0;
        uint256 total = totalShare[categoryId][epoch];
        uint256 share = agentShare[categoryId][epoch][agentId];
        if (total == 0 || share == 0) return 0;
        return (finalPool[categoryId][epoch] * share) / total;
    }

    // ─── Internal ────────────────────────────────────────────────────────────────

    function _sendValue(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
