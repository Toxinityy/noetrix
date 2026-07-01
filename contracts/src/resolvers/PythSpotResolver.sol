// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";
import {IPyth} from "../interfaces/IPyth.sol";

/// @title PythSpotResolver — resolves a spot-price category against a keeper-recorded Pyth snapshot
/// @notice Design (keeper-snapshot — pins the outcome so it cannot be time-selected):
///   1. Once a prediction's `resolutionBlock` is reached, the authorized keeper calls
///      `record(resolutionBlock, updateData)`: it pushes the signed Hermes update to Pyth, reads the
///      fresh price, confidence-gates it, normalizes to fixed 8-decimal USD, and stores it as the
///      IMMUTABLE snapshot for that block (first write wins).
///   2. `resolve()` (view, per ICategoryResolver) reads that fixed snapshot. Because the graded value
///      is set once by the keeper and never depends on WHO calls resolve or WHEN, the self-resolve /
///      grief-resolve timing exploit is closed — an agent cannot wait for the spot to drift into its
///      own band, and a rival cannot resolve at an unfavorable tick.
/// @dev Why a keeper, not a permissionless recorder: a permissionless record() would let an agent pick
///      a favorable within-window tick. A single honest keeper recording the first valid print at the
///      horizon is deterministic; the stored value is a real, Hermes-verifiable Pyth print (the record
///      tx updates Pyth's on-chain price to it, auditable) — a large step up from a synthetic curve,
///      with the same trust model as the existing mETH rate keeper.
/// @dev No hard record deadline: a brief keeper/RPC outage must NOT permanently lock stake, so the
///      keeper may record late (recovering liveness). The anti-cherry-pick property comes from the
///      keeper being the sole recorder + first-write-wins, not from a block deadline. The catastrophic
///      case (keeper key lost / feed delisted) is handled by a separate void/refund escape in the
///      market layer (see the resolver's `recordedAtBlock` for audit of when a snapshot was taken).
contract PythSpotResolver is ICategoryResolver, Ownable {
    /// @notice Max staleness (seconds) of the Pyth print accepted at record time.
    uint256 public constant MAX_AGE = 120;

    /// @notice Max Pyth confidence interval accepted, as a fraction of price (bps). Pyth widens conf
    ///         during volatility / feed degradation; a wide conf is Pyth signalling the print is
    ///         unreliable, so we refuse to snapshot real stake against it.
    uint256 public constant MAX_CONF_BPS = 500; // 5%

    IPyth public immutable pyth;
    bytes32 public immutable feedId;
    address public keeper;

    /// @dev resolutionBlock => recorded 8-decimal-USD snapshot price.
    mapping(uint256 => uint256) public snapshotPrice;
    mapping(uint256 => bool) public recorded;
    /// @dev resolutionBlock => the block the snapshot was taken at (audit: how close to horizon).
    mapping(uint256 => uint256) public recordedAtBlock;

    error BadPrice();
    error LowConfidence();
    error HorizonNotReached();
    error AlreadyRecorded();
    error NotRecorded();
    error NotKeeper();
    error InsufficientFee();
    error RefundFailed();

    event KeeperSet(address indexed keeper);
    event SnapshotRecorded(uint256 indexed resolutionBlock, uint256 price8dec, uint256 atBlock);

    constructor(IPyth _pyth, bytes32 _feedId, address initialOwner, address _keeper) Ownable(initialOwner) {
        require(address(_pyth) != address(0), "pyth=0");
        require(_feedId != bytes32(0), "feedId=0");
        pyth = _pyth;
        feedId = _feedId;
        keeper = _keeper;
        emit KeeperSet(_keeper);
    }

    function setKeeper(address newKeeper) external onlyOwner {
        keeper = newKeeper;
        emit KeeperSet(newKeeper);
    }

    /// @notice Keeper records the real Pyth price for `resolutionBlock` once (first write wins).
    /// @dev Pushes `updateData` (a signed Hermes update) to Pyth, then reads + confidence-gates the
    ///      fresh price and stores the normalized snapshot. `updateData` may be empty only if Pyth's
    ///      stored price is already fresh (real keeper always passes a Hermes update).
    function record(uint256 resolutionBlock, bytes[] calldata updateData) external payable {
        if (msg.sender != keeper) revert NotKeeper();
        if (block.number < resolutionBlock) revert HorizonNotReached();
        if (recorded[resolutionBlock]) revert AlreadyRecorded();

        uint256 fee = pyth.getUpdateFee(updateData);
        if (msg.value < fee) revert InsufficientFee();
        if (updateData.length > 0) {
            pyth.updatePriceFeeds{value: fee}(updateData);
        }

        IPyth.Price memory p = pyth.getPriceNoOlderThan(feedId, MAX_AGE); // reverts if stale
        if (p.price <= 0) revert BadPrice();
        // conf/price > MAX_CONF_BPS → reject. p.price > 0 here so the cast is safe.
        if (uint256(p.conf) * 10_000 > uint256(uint64(p.price)) * MAX_CONF_BPS) revert LowConfidence();

        uint256 price8 = _to8dec(uint256(uint64(p.price)), p.expo);
        // Effects before the refund interaction (checks-effects-interactions).
        snapshotPrice[resolutionBlock] = price8;
        recorded[resolutionBlock] = true;
        recordedAtBlock[resolutionBlock] = block.number;
        emit SnapshotRecorded(resolutionBlock, price8, block.number);

        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok,) = msg.sender.call{value: excess}("");
            if (!ok) revert RefundFailed();
        }
    }

    /// @inheritdoc ICategoryResolver
    /// @dev Reads the fixed keeper snapshot for `resolutionBlock`; reverts `NotRecorded` until the
    ///      keeper has recorded it (ResolutionEngine.resolve then simply waits). `predictionValue` is
    ///      ignored — the outcome is caller-independent by construction.
    function resolve(bytes calldata, uint256 resolutionBlock) external view returns (bytes memory) {
        if (!recorded[resolutionBlock]) revert NotRecorded();
        return abi.encode(snapshotPrice[resolutionBlock]);
    }

    /// @notice Normalize Pyth's (price × 10^expo) to fixed 8-decimal USD.
    /// @dev shift = 8 + expo. expo=-8 (typical USD feed) → shift 0 → price already in 1e8 units.
    ///      A large positive expo would overflow `10 ** shift` and revert (checked math) rather than
    ///      return a wrong value — acceptable, since real USD feeds use small negative exponents.
    function _to8dec(uint256 price, int32 expo) internal pure returns (uint256) {
        int256 shift = int256(8) + int256(expo);
        if (shift >= 0) {
            return price * (10 ** uint256(shift));
        }
        return price / (10 ** uint256(-shift));
    }
}
