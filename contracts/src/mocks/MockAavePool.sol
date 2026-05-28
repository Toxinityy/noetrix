// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAavePoolLike, IAaveOracleLike} from "../interfaces/IAaveLike.sol";

/// @title MockAavePool — admin-seeded Aave pool + oracle stand-in for AaveMantleTvlResolver
/// @notice Bundles the pool reserve registry and the price oracle so the resolver can be tested and
///         demoed without an archive RPC. Each reserve = (underlying asset, its aToken, USD price 8dec).
///         v2 replaces this with the live Aave V3 Pool + AaveOracle addresses.
contract MockAavePool is Ownable, IAavePoolLike, IAaveOracleLike {
    error LengthMismatch();

    address[] private _reserves;
    mapping(address => address) private _aToken; // underlying => aToken
    mapping(address => uint256) private _price8; // underlying => USD price, 8 decimals

    constructor(address initialOwner) Ownable(initialOwner) {}

    function addReserve(address asset, address aToken, uint256 price8) external onlyOwner {
        if (_aToken[asset] == address(0)) {
            _reserves.push(asset);
        }
        _aToken[asset] = aToken;
        _price8[asset] = price8;
    }

    function setPrice(address asset, uint256 price8) external onlyOwner {
        _price8[asset] = price8;
    }

    /// @inheritdoc IAavePoolLike
    function getReservesList() external view returns (address[] memory) {
        return _reserves;
    }

    /// @inheritdoc IAavePoolLike
    function getATokenAddress(address asset) external view returns (address) {
        return _aToken[asset];
    }

    /// @inheritdoc IAaveOracleLike
    function getAssetPrice(address asset) external view returns (uint256) {
        return _price8[asset];
    }
}
