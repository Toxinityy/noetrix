// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IPyth} from "../interfaces/IPyth.sol";

/// @title MockPyth — test/local substitute for the Pyth pull oracle
/// @notice Lets tests set a price directly (bypassing VAA decoding). `getPriceNoOlderThan` mirrors
///         real Pyth's stale-revert and feed-not-found behavior so the resolver's safety paths get
///         real coverage. Not for production — production reads the deployed Pyth contract.
contract MockPyth is IPyth {
    error StalePrice();
    error PriceFeedNotFound();

    mapping(bytes32 => Price) internal _prices;
    uint256 public updateFee = 1;

    /// @notice Test helper: seed a price for `id`. `publishTime` must be non-zero (0 == not found).
    function setPrice(bytes32 id, int64 price, uint64 conf, int32 expo, uint256 publishTime) external {
        _prices[id] = Price(price, conf, expo, publishTime);
    }

    function setUpdateFee(uint256 fee) external {
        updateFee = fee;
    }

    /// @inheritdoc IPyth
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory) {
        Price memory p = _prices[id];
        if (p.publishTime == 0) revert PriceFeedNotFound();
        // Absolute difference, mirroring real Pyth's diff(block.timestamp, publishTime): a
        // future-dated publishTime past the skew tolerance is stale too, not treated as fresh.
        uint256 elapsed =
            block.timestamp > p.publishTime ? block.timestamp - p.publishTime : p.publishTime - block.timestamp;
        if (elapsed > age) revert StalePrice();
        return p;
    }

    /// @inheritdoc IPyth
    /// @dev Fee scales with the number of updates (real Pyth charges per feed); empty → 0, so a test
    ///      can record a pre-set price with no msg.value.
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256) {
        return updateData.length * updateFee;
    }

    /// @inheritdoc IPyth
    /// @dev No-op — tests seed prices via `setPrice`; simply accepts the fee value.
    function updatePriceFeeds(bytes[] calldata) external payable {}
}
