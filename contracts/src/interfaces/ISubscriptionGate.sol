// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISubscriptionGate — read-access gate for the composite feed
/// @notice v1: all categories are open (`requiresSubscription = false`), so `hasAccess` returns true.
///         The architecture is in place for v2 to enforce paid subscription tiers per §7.6.
interface ISubscriptionGate {
    function hasAccess(address subscriber, bytes32 categoryId) external view returns (bool);
}
