// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IPyth — minimal subset of the Pyth pull-oracle interface
/// @notice ABI-compatible with the canonical `@pythnetwork/pyth-sdk-solidity` IPyth for the three
///         functions Noetrix needs. The `Price` struct layout and function selectors match
///         `PythStructs.Price` / `IPyth`, so the real deployed Pyth contract is a drop-in target.
///         Deployed Pyth on Mantle mainnet: 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729
///         (Mantle Sepolia address: confirm from Pyth docs before deploy).
interface IPyth {
    struct Price {
        int64 price; // price × 10^expo
        uint64 conf; // confidence interval, same exponent
        int32 expo; // exponent (typically -8 for USD feeds)
        uint256 publishTime; // unix seconds of the last on-chain update
    }

    /// @notice Latest price for `id`, reverting if older than `age` seconds. The revert-on-stale is
    ///         intentional: it forces resolution against a genuinely fresh price.
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);

    /// @notice Fee (wei) required to submit `updateData` to `updatePriceFeeds`.
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);

    /// @notice Submits signed price updates pulled from Hermes off-chain. State-changing — a `view`
    ///         resolver cannot call it, so the resolver bot updates first, then resolves.
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
