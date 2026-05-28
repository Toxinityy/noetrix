// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISubscriptionGate} from "./interfaces/ISubscriptionGate.sol";

/// @title SubscriptionGate — composite-feed read gate (PRD §7.6)
/// @notice Hackathon v1: every category has `requiresSubscription = false`, so all reads are free.
///         The contract proves the subscription-tier architecture for the pitch; v2 flips the flags
///         and sells time-bounded access per subscriber.
contract SubscriptionGate is Ownable, ISubscriptionGate {
    error ZeroAddress();

    event SubscriptionRequirementSet(bytes32 indexed categoryId, bool required);
    event SubscriptionSet(address indexed subscriber, uint256 expiry);

    mapping(address => uint256) public subscriptionExpiry;
    mapping(bytes32 => bool) public requiresSubscription;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setRequiresSubscription(bytes32 categoryId, bool required) external onlyOwner {
        requiresSubscription[categoryId] = required;
        emit SubscriptionRequirementSet(categoryId, required);
    }

    /// @notice Admin-grant a subscription valid until `expiry` (unix seconds). v2 will sell this.
    function setSubscription(address subscriber, uint256 expiry) external onlyOwner {
        if (subscriber == address(0)) revert ZeroAddress();
        subscriptionExpiry[subscriber] = expiry;
        emit SubscriptionSet(subscriber, expiry);
    }

    /// @inheritdoc ISubscriptionGate
    function hasAccess(address subscriber, bytes32 categoryId) external view returns (bool) {
        if (!requiresSubscription[categoryId]) return true;
        return subscriptionExpiry[subscriber] >= block.timestamp;
    }
}
