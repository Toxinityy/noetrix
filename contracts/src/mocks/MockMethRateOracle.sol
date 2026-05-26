// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMethRateOracle} from "../interfaces/IMethRateOracle.sol";

/// @title MockMethRateOracle — admin-seeded historical mETH exchange rate store
/// @notice v1 substitute for direct mETH-contract reads at historical blocks (which require
///         an archive node). Owner seeds rate snapshots via `setRate` / `setRates`; resolvers
///         read via `getRateAt`. v2 will replace this with a direct read against mETH.
contract MockMethRateOracle is Ownable, IMethRateOracle {
    error RateNotSet();
    error LengthMismatch();

    event RateSet(uint256 indexed blockNumber, uint256 rate);

    /// @dev blockNumber => 1e18-scaled exchange rate. Zero means not set.
    mapping(uint256 => uint256) internal _rates;

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setRate(uint256 blockNumber, uint256 rate) external onlyOwner {
        _rates[blockNumber] = rate;
        emit RateSet(blockNumber, rate);
    }

    function setRates(uint256[] calldata blockNumbers, uint256[] calldata rates) external onlyOwner {
        if (blockNumbers.length != rates.length) revert LengthMismatch();
        for (uint256 i = 0; i < blockNumbers.length; ++i) {
            _rates[blockNumbers[i]] = rates[i];
            emit RateSet(blockNumbers[i], rates[i]);
        }
    }

    /// @inheritdoc IMethRateOracle
    function getRateAt(uint256 blockNumber) external view returns (uint256) {
        uint256 r = _rates[blockNumber];
        if (r == 0) revert RateNotSet();
        return r;
    }

    /// @notice Probe accessor that returns 0 instead of reverting when unset.
    function rateOrZero(uint256 blockNumber) external view returns (uint256) {
        return _rates[blockNumber];
    }
}
