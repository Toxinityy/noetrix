// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";
import {IAavePoolLike, IAaveOracleLike, IERC20Like} from "../interfaces/IAaveLike.sol";

/// @title AaveMantleTvlResolver — resolves 24h Aave-on-Mantle supplied TVL in USD (8 decimals)
/// @notice Per-reserve: aToken.totalSupply() (in underlying decimals) × oracle price (8 dec USD),
///         normalized by the underlying's decimals so the sum is a clean 8-decimal USD figure:
///           usd8 += aTokenSupply × price8 / 10^underlyingDecimals
/// @dev `predictionValue` and `resolutionBlock` are ignored — TVL is a global metric read at the
///      current oracle/pool state. v1 reads from a MockAavePool (admin-seeded), because reading real
///      Aave reserves at an arbitrary historical block needs an archive RPC. v2 swaps the pool/oracle
///      addresses for the live Aave V3 deployment (contingency: INIT Capital per §7.3.2).
contract AaveMantleTvlResolver is ICategoryResolver {
    IAavePoolLike public immutable pool;
    IAaveOracleLike public immutable oracle;

    constructor(IAavePoolLike _pool, IAaveOracleLike _oracle) {
        require(address(_pool) != address(0) && address(_oracle) != address(0), "addr=0");
        pool = _pool;
        oracle = _oracle;
    }

    /// @inheritdoc ICategoryResolver
    function resolve(bytes calldata, uint256) external view returns (bytes memory) {
        address[] memory reserves = pool.getReservesList();
        uint256 tvlUsd8;

        for (uint256 i = 0; i < reserves.length; ++i) {
            address asset = reserves[i];
            address aToken = pool.getATokenAddress(asset);
            if (aToken == address(0)) continue;

            uint256 supply = IERC20Like(aToken).totalSupply();
            if (supply == 0) continue;

            uint256 price8 = oracle.getAssetPrice(asset);
            uint8 dec = IERC20Like(aToken).decimals(); // aToken decimals == underlying decimals in Aave

            tvlUsd8 += (supply * price8) / (10 ** dec);
        }

        return abi.encode(tvlUsd8);
    }
}
