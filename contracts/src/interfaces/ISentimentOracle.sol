// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISentimentOracle — latest market Fear & Greed index (0–100).
interface ISentimentOracle {
    function latest() external view returns (uint8 value, uint256 updatedBlock);
}
