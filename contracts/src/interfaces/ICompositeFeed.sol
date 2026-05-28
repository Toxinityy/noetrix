// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICompositeFeed — consumer-facing read surface for the ensemble forecast
interface ICompositeFeed {
    struct CompositeForecast {
        bytes value; // abi.encode(uint256 ensemblePointEstimate)
        uint16 confidence; // bps, [0, 10000]
        uint256 contributingAgents;
        uint256 lastUpdatedBlock;
    }

    function read(bytes32 categoryId) external view returns (CompositeForecast memory);
}
