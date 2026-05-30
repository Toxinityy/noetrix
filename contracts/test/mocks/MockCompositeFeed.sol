// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICompositeFeed} from "../../src/interfaces/ICompositeFeed.sol";

/// @notice Test double for ICompositeFeed — set a forecast per category id.
contract MockCompositeFeed is ICompositeFeed {
    mapping(bytes32 => CompositeForecast) internal _f;

    function set(bytes32 id, uint256 value, uint16 confidence, uint256 contributors, uint256 updatedBlock)
        external
    {
        _f[id] = CompositeForecast({
            value: abi.encode(value),
            confidence: confidence,
            contributingAgents: contributors,
            lastUpdatedBlock: updatedBlock
        });
    }

    /// @notice Set an empty (never-refreshed) forecast: empty bytes, zeroed fields.
    function setEmpty(bytes32 id) external {
        _f[id] = CompositeForecast({value: "", confidence: 0, contributingAgents: 0, lastUpdatedBlock: 0});
    }

    function read(bytes32 id) external view returns (CompositeForecast memory) {
        return _f[id];
    }
}
