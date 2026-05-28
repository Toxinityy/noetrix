// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20Like} from "../interfaces/IAaveLike.sol";

/// @title MockAToken — minimal totalSupply/decimals stub for TVL aggregation tests
/// @notice Stands in for an Aave aToken. `totalSupply` is the supplied amount in underlying decimals.
contract MockAToken is IERC20Like {
    uint256 private _totalSupply;
    uint8 private immutable _decimals;

    constructor(uint256 supply, uint8 dec) {
        _totalSupply = supply;
        _decimals = dec;
    }

    function setTotalSupply(uint256 supply) external {
        _totalSupply = supply;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }
}
