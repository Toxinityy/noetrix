// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISubscriptionGate} from "./interfaces/ISubscriptionGate.sol";

/// @title SubscriptionGate — composite-feed read gate (PRD §7.6) + paid subscription rail
/// @notice v1 keeps every category open (`requiresSubscription = false`), so all feed reads are free.
///         `subscribe` adds a real on-chain subscription paid in native MNT: anyone (whale/trader or
///         protocol) pays a tier price and gets a 30-day on-chain subscription record. Access is not
///         gated in v1 (reads stay open) — the payment proves the rail; v2 flips the flags.
contract SubscriptionGate is Ownable, ISubscriptionGate {
    enum Tier {
        None,
        Pro,
        Protocol
    }

    error ZeroAddress();
    error BadTier();
    error InsufficientPayment(uint256 required, uint256 sent);
    error WithdrawFailed();

    event SubscriptionRequirementSet(bytes32 indexed categoryId, bool required);
    event SubscriptionSet(address indexed subscriber, uint256 expiry);
    event Subscribed(address indexed subscriber, Tier tier, uint64 expiry, uint256 paid);
    event PricesSet(uint256 proPrice, uint256 protocolPrice);
    event Withdrawn(address indexed to, uint256 amount);

    uint64 public constant SUBSCRIPTION_PERIOD = 30 days;

    mapping(address => uint256) public subscriptionExpiry;
    mapping(bytes32 => bool) public requiresSubscription;
    mapping(address => Tier) public tierOf;

    uint256 public proPrice = 0.5 ether; // testnet MNT
    uint256 public protocolPrice = 2 ether;

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ── Paid subscription (native MNT) ───────────────────────────────────────────────────────────

    /// @notice Price for a tier in wei (native MNT). Reverts BadTier for None/invalid.
    function priceOf(Tier tier) public view returns (uint256) {
        if (tier == Tier.Pro) return proPrice;
        if (tier == Tier.Protocol) return protocolPrice;
        revert BadTier();
    }

    /// @notice Pay `priceOf(tier)` MNT for a 30-day subscription. Renewing before expiry extends from
    ///         the current expiry; renewing after expiry starts from now. Overpayment is kept.
    function subscribe(Tier tier) external payable {
        uint256 price = priceOf(tier); // reverts BadTier for None
        if (msg.value < price) revert InsufficientPayment(price, msg.value);

        uint256 current = subscriptionExpiry[msg.sender];
        uint256 start = current > block.timestamp ? current : block.timestamp;
        uint64 expiry = uint64(start + SUBSCRIPTION_PERIOD);

        subscriptionExpiry[msg.sender] = expiry;
        tierOf[msg.sender] = tier;
        emit Subscribed(msg.sender, tier, expiry, msg.value);
    }

    function setPrices(uint256 pro, uint256 protocol) external onlyOwner {
        proPrice = pro;
        protocolPrice = protocol;
        emit PricesSet(pro, protocol);
    }

    function withdraw(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(to, amount);
    }

    // ── Admin gate controls (unchanged from v1) ──────────────────────────────────────────────────

    function setRequiresSubscription(bytes32 categoryId, bool required) external onlyOwner {
        requiresSubscription[categoryId] = required;
        emit SubscriptionRequirementSet(categoryId, required);
    }

    /// @notice Admin-grant a subscription valid until `expiry` (unix seconds).
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
