// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";

// ─── MockRegistry (copied verbatim from test/CompositeFeed.t.sol) ─────────────

/// @notice Minimal IAgentRegistry stub: settable top-20 list + per-agent calibration.
contract MockRegistry is IAgentRegistry {
    uint256[20] internal _top;
    mapping(uint256 => int256) internal _calibration;
    mapping(uint256 => address) internal _controller;

    function setTopAgents(bytes32, uint256[20] calldata top) external {
        _top = top;
    }

    function setCalibration(uint256 agentId, int256 cal) external {
        _calibration[agentId] = cal;
    }

    function setController(uint256 agentId, address ctrl) external {
        _controller[agentId] = ctrl;
    }

    function getTopAgents(bytes32) external view returns (uint256[20] memory) {
        return _top;
    }

    function getReputation(uint256 agentId, bytes32) external view returns (Reputation memory r) {
        r.calibrationScore = _calibration[agentId];
    }

    function controllerOf(uint256 agentId) external view returns (address) {
        return _controller[agentId];
    }

    // ─── Unused interface surface ──────────────────────────────────────────
    function register(string calldata) external payable returns (uint256) {
        revert("n/a");
    }

    function proposeControllerRotation(uint256, address) external pure {
        revert("n/a");
    }

    function executeControllerRotation(uint256) external pure {
        revert("n/a");
    }

    function updateReputation(uint256, bytes32, int256, int256, int256[10] calldata, uint256[10] calldata)
        external
        pure
    {
        revert("n/a");
    }

    function getAgent(uint256) external pure returns (AgentProfile memory a) {
        return a;
    }
}

// ─── MockMarket (copied verbatim from test/CompositeFeed.t.sol, + setMalformed) ─

/// @notice Minimal IPredictionMarket stub: settable latest-revealed id + per-id prediction.
contract MockMarket is IPredictionMarket {
    mapping(uint256 => mapping(bytes32 => uint256)) internal _latest;
    mapping(uint256 => Prediction) internal _preds;

    function setLatest(uint256 agentId, bytes32 categoryId, uint256 predId) external {
        _latest[agentId][categoryId] = predId;
    }

    function setRevealed(uint256 predId, uint256 agentId, bytes32 categoryId, uint256 low, uint256 high, uint16 confidence)
        external
    {
        Prediction storage p = _preds[predId];
        p.agentId = agentId;
        p.categoryId = categoryId;
        p.value = abi.encode(low, high);
        p.confidence = confidence;
        p.status = PredictionStatus.Revealed;
    }

    /// @notice Sets a prediction with a malformed value (32 bytes instead of the expected 64).
    function setMalformed(uint256 predId, uint256 agentId, bytes32 categoryId, uint16 confidence) external {
        Prediction storage p = _preds[predId];
        p.agentId = agentId;
        p.categoryId = categoryId;
        p.value = abi.encode(uint256(1)); // length 32, not 64 → malformed band
        p.confidence = confidence;
        p.status = PredictionStatus.Revealed;
    }

    function setStatus(uint256 predId, PredictionStatus s) external {
        _preds[predId].status = s;
    }

    function latestRevealedPrediction(uint256 agentId, bytes32 categoryId) external view returns (uint256) {
        return _latest[agentId][categoryId];
    }

    function getPrediction(uint256 predId) external view returns (Prediction memory) {
        return _preds[predId];
    }

    // ─── Unused interface surface ──────────────────────────────────────────
    function commit(uint256, bytes32, bytes32, uint256, bytes32) external payable returns (uint256) {
        revert("n/a");
    }

    function reveal(uint256, bytes calldata, uint16, bytes32) external pure {
        revert("n/a");
    }

    function cancel(uint256) external pure {
        revert("n/a");
    }

    function forfeitUnrevealed(uint256) external pure {
        revert("n/a");
    }

    function settleStake(uint256, uint256, uint256, uint256, address) external pure {
        revert("n/a");
    }

    function setScore(uint256, int256) external pure {
        revert("n/a");
    }

    function getCategory(bytes32) external pure returns (Category memory c) {
        return c;
    }
}

// ─── Hardening Tests ──────────────────────────────────────────────────────────

contract CompositeFeedHardeningTest is Test {
    CompositeFeed feed;
    MockRegistry registry;
    MockMarket market;

    address owner = makeAddr("owner");
    bytes32 constant CAT = keccak256("METH_APR_24H");

    // helper to build a top-20 array with the given ids in front
    function _top(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[20] memory t) {
        t[0] = a;
        t[1] = b;
        t[2] = c;
    }

    function setUp() public {
        registry = new MockRegistry();
        market = new MockMarket();
        feed = new CompositeFeed(owner);

        vm.startPrank(owner);
        feed.setAgentRegistry(IAgentRegistry(address(registry)));
        feed.setPredictionMarket(IPredictionMarket(address(market)));
        // Set category bounds so the feed is in non-legacy (disagreeScale != 0) mode.
        feed.setCategoryBounds(CAT, 0, 100_000, 5_000);
        vm.stopPrank();

        vm.roll(1000);
    }

    /// @notice A contributor whose value blob is 32 bytes (malformed — abi.encode(uint256) not
    ///         abi.encode(uint256,uint256)) must be skipped silently; the whole refresh must NOT revert
    ///         and the remaining good contributor must still be counted.
    function test_MalformedValue_IsSkipped_FeedStillRefreshes() public {
        // Agent 1 = good, well-formed revealed band.
        uint256[20] memory top = _top(1, 2, 0);
        registry.setTopAgents(CAT, top);
        registry.setCalibration(1, 0);
        registry.setCalibration(2, 0);

        market.setLatest(1, CAT, 1);
        market.setLatest(2, CAT, 2);

        // Agent 1: valid band [49000, 51000] with confidence 8000.
        market.setRevealed(1, 1, CAT, 49_000, 51_000, 8_000);
        // Agent 2: malformed value — abi.encode(uint256) produces 32 bytes, not 64.
        market.setMalformed(2, 2, CAT, 8_000);

        // refresh must NOT revert despite agent 2's malformed prediction.
        feed.refresh(CAT);

        ICompositeFeed.CompositeForecast memory f = feed.read(CAT);
        // Only agent 1 is a valid contributor; agent 2 is silently skipped.
        assertEq(f.contributingAgents, 1, "malformed contributor excluded");
        // The ensemble is agent 1's midpoint = 50000.
        uint256 ensemble = abi.decode(f.value, (uint256));
        assertEq(ensemble, 50_000, "ensemble from the single valid contributor");
    }

    /// @notice A contributor with stated confidence below MIN_CONTRIB_CONF_BPS (500) must not be
    ///         counted even if the prediction is otherwise valid.
    function test_BelowMinConfidence_IsSkipped() public {
        // Three slots; agents 1 (below threshold) and 2 (above threshold).
        uint256[20] memory top = _top(1, 2, 0);
        registry.setTopAgents(CAT, top);
        registry.setCalibration(1, 0);
        registry.setCalibration(2, 0);

        market.setLatest(1, CAT, 1);
        market.setLatest(2, CAT, 2);

        // Agent 1: confidence 400 — below MIN_CONTRIB_CONF_BPS (500) → must be skipped.
        market.setRevealed(1, 1, CAT, 49_000, 51_000, 400);
        // Agent 2: confidence 8000 — well above threshold → counted.
        market.setRevealed(2, 2, CAT, 49_000, 51_000, 8_000);

        feed.refresh(CAT);

        ICompositeFeed.CompositeForecast memory f = feed.read(CAT);
        // Agent 1 excluded; only agent 2 contributes.
        assertEq(f.contributingAgents, 1, "sub-min-confidence contributor excluded");
    }
}
