// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Aave-like minimal read interfaces consumed by AaveMantleTvlResolver
/// @notice Trimmed to exactly what TVL aggregation needs. A v2 adapter can wrap real Aave V3
///         contracts (Pool.getReservesList + Pool.getReserveData(...).aTokenAddress, AaveOracle).
interface IAavePoolLike {
    /// @notice List of underlying reserve asset addresses.
    function getReservesList() external view returns (address[] memory);

    /// @notice aToken address for a given underlying reserve.
    function getATokenAddress(address asset) external view returns (address);
}

interface IAaveOracleLike {
    /// @notice USD price of `asset`, 8 decimals (Aave oracle convention).
    function getAssetPrice(address asset) external view returns (uint256);
}

interface IERC20Like {
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}
