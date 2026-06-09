// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISentimentOracle} from "../interfaces/ISentimentOracle.sol";

/// @title SentimentOracle — keeper-posted Crypto Fear & Greed index (0–100).
/// @notice v1 mock: a keeper posts the latest index (seeded from real alternative.me data). The
///         MarketStressMonitor reads `latest()` and ignores it when stale.
contract SentimentOracle is ISentimentOracle, Ownable {
    uint8 public latestValue;
    uint256 public latestUpdatedBlock;
    mapping(address => bool) public keepers;

    error OutOfRange();
    error NotKeeper();

    event FearGreedSet(uint8 value, uint256 blockNumber);
    event KeeperSet(address indexed keeper, bool allowed);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyKeeper() {
        if (msg.sender != owner() && !keepers[msg.sender]) revert NotKeeper();
        _;
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setFearGreed(uint8 value) external onlyKeeper {
        if (value > 100) revert OutOfRange();
        latestValue = value;
        latestUpdatedBlock = block.number;
        emit FearGreedSet(value, block.number);
    }

    function latest() external view returns (uint8 value, uint256 updatedBlock) {
        return (latestValue, latestUpdatedBlock);
    }
}
