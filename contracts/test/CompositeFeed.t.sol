// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";

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

contract CompositeFeedTest is Test {
    CompositeFeed feed;
    MockRegistry registry;
    MockMarket market;

    address owner = makeAddr("owner");
    bytes32 constant CATEGORY = keccak256("METH_APR_24H");

    function setUp() public {
        registry = new MockRegistry();
        market = new MockMarket();
        feed = new CompositeFeed(owner);

        vm.startPrank(owner);
        feed.setAgentRegistry(IAgentRegistry(address(registry)));
        feed.setPredictionMarket(IPredictionMarket(address(market)));
        vm.stopPrank();

        vm.roll(1000);
    }

    /// @dev Configure `n` contributors (ids 1..n) at the top of the ranking, with given midpoints,
    ///      stated confidence, and calibration. Predictions have zero-width band (low==high==point).
    function _configure(uint256 n, uint256[] memory points, uint16 stated, int256 cal) internal {
        uint256[20] memory top;
        for (uint256 i = 0; i < n; ++i) {
            uint256 agentId = i + 1;
            top[i] = agentId;
            registry.setCalibration(agentId, cal);
            market.setLatest(agentId, CATEGORY, agentId);
            market.setRevealed(agentId, agentId, CATEGORY, points[i], points[i], stated);
        }
        registry.setTopAgents(CATEGORY, top);
    }

    // ─── Ensemble math ────────────────────────────────────────────────────────

    function test_Ensemble_MatchesWeightedAverage() public {
        uint256[] memory points = new uint256[](5);
        points[0] = 100e6; // rank 1, weight 5/15
        points[1] = 200e6; // rank 2, weight 4/15
        points[2] = 300e6; // rank 3, weight 3/15
        points[3] = 400e6; // rank 4, weight 2/15
        points[4] = 500e6; // rank 5, weight 1/15
        _configure(5, points, 8000, 0);

        feed.refresh(CATEGORY);
        ICompositeFeed.CompositeForecast memory f = feed.read(CATEGORY);
        uint256 ensemble = abi.decode(f.value, (uint256));

        // True rank-weighted average: (5*100 + 4*200 + 3*300 + 2*400 + 1*500)/15 * 1e6
        uint256 trueAvg = (uint256(5 * 100 + 4 * 200 + 3 * 300 + 2 * 400 + 1 * 500) * 1_000_000) / 15;
        assertApproxEqAbs(ensemble, trueAvg, 5, "ensemble within rounding of weighted average");
        assertEq(f.contributingAgents, 5);
    }

    function test_Ensemble_SkipsAgentsWithoutActivePrediction() public {
        uint256[] memory points = new uint256[](3);
        points[0] = 100e6;
        points[1] = 200e6;
        points[2] = 300e6;
        _configure(3, points, 8000, 0);

        // Agent 2's latest prediction transitioned to Resolved → should be skipped.
        market.setStatus(2, IPredictionMarket.PredictionStatus.Resolved);

        feed.refresh(CATEGORY);
        ICompositeFeed.CompositeForecast memory f = feed.read(CATEGORY);
        assertEq(f.contributingAgents, 2, "resolved prediction excluded");

        // Re-ranked over 2 contributors: weights 2/3 (agent1=100e6) + 1/3 (agent3=300e6).
        uint256 ensemble = abi.decode(f.value, (uint256));
        uint256 trueAvg = (uint256(2 * 100 + 1 * 300) * 1_000_000) / 3;
        assertApproxEqAbs(ensemble, trueAvg, 5);
    }

    // ─── Rate limit ─────────────────────────────────────────────────────────────

    function test_RateLimit_SecondRefreshWithin100Blocks_Reverts() public {
        uint256[] memory points = new uint256[](1);
        points[0] = 100e6;
        _configure(1, points, 8000, 0);

        feed.refresh(CATEGORY); // sets lastUpdatedBlock = 1000

        vm.roll(1050); // 50 < 100
        vm.expectRevert(CompositeFeed.RateLimited.selector);
        feed.refresh(CATEGORY);

        vm.roll(1100); // exactly 100 → allowed
        feed.refresh(CATEGORY);
    }

    // ─── Confidence multiplier ───────────────────────────────────────────────────

    function test_Confidence_WellCalibrated_HighConfidence() public {
        uint256[] memory points = new uint256[](3);
        points[0] = 100e6;
        points[1] = 100e6;
        points[2] = 100e6;
        _configure(3, points, 6000, 0); // calibration 0 → multiplier 1.0

        feed.refresh(CATEGORY);
        ICompositeFeed.CompositeForecast memory f = feed.read(CATEGORY);
        assertApproxEqAbs(uint256(f.confidence), 6000, 5, "approx stated confidence");
    }

    function test_Confidence_PoorlyCalibrated_HalvedByMultiplier() public {
        uint256[] memory points = new uint256[](3);
        points[0] = 100e6;
        points[1] = 100e6;
        points[2] = 100e6;
        _configure(3, points, 6000, -1_000_000); // cal -1.0 → clipped to -0.5 → multiplier 0.5

        feed.refresh(CATEGORY);
        ICompositeFeed.CompositeForecast memory f = feed.read(CATEGORY);
        assertApproxEqAbs(uint256(f.confidence), 3000, 5, "approx half of stated confidence");
    }

    function test_Confidence_WellCalibratedBeatsPoorly() public {
        uint256[] memory points = new uint256[](2);
        points[0] = 100e6;
        points[1] = 100e6;

        _configure(2, points, 7000, 0);
        feed.refresh(CATEGORY);
        uint256 good = feed.read(CATEGORY).confidence;

        vm.roll(2000);
        _configure(2, points, 7000, -1_000_000);
        feed.refresh(CATEGORY);
        uint256 bad = feed.read(CATEGORY).confidence;

        assertGt(good, bad);
    }

    // ─── Empty case ───────────────────────────────────────────────────────────

    function test_Refresh_NoContributors_WritesZero() public {
        // No top agents configured AND no prior good value → write an explicit decodable zero.
        feed.refresh(CATEGORY);
        ICompositeFeed.CompositeForecast memory f = feed.read(CATEGORY);
        assertEq(f.contributingAgents, 0);
        assertEq(abi.decode(f.value, (uint256)), 0);
        assertEq(uint256(f.confidence), 0);
        assertEq(f.lastUpdatedBlock, block.number);
    }

    /// @dev Regression for the live "feed reads 0 when bots pause" bug: once a good value exists,
    ///      an empty refresh must HOLD it, not zero it out.
    function test_Refresh_NoContributors_HoldsLastGood() public {
        uint256[] memory points = new uint256[](2);
        points[0] = 100e6;
        points[1] = 300e6;
        _configure(2, points, 8000, 0);

        feed.refresh(CATEGORY); // good aggregate at block 1000
        ICompositeFeed.CompositeForecast memory good = feed.read(CATEGORY);
        uint256 goodValue = abi.decode(good.value, (uint256));
        assertEq(good.contributingAgents, 2);
        assertGt(goodValue, 0);

        // Agents go quiet: their latest predictions resolve out of the active set → n == 0.
        market.setStatus(1, IPredictionMarket.PredictionStatus.Resolved);
        market.setStatus(2, IPredictionMarket.PredictionStatus.Resolved);

        vm.roll(1100); // past the rate limit
        vm.expectEmit(true, false, false, true);
        emit CompositeFeed.CompositeFeedStale(CATEGORY, 2, 1000, 1100);
        feed.refresh(CATEGORY); // n == 0 → must hold, not zero

        ICompositeFeed.CompositeForecast memory held = feed.read(CATEGORY);
        assertEq(abi.decode(held.value, (uint256)), goodValue, "value held, not zeroed");
        assertEq(held.contributingAgents, 2, "contributors held");
        assertEq(held.lastUpdatedBlock, 1000, "lastUpdatedBlock stays at last good so staleness is observable");
    }
}
