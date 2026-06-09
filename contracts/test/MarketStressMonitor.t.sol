// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketStressMonitor} from "../src/examples/MarketStressMonitor.sol";
import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";

/// Minimal feed stub returning a settable CompositeForecast.
contract StubFeed is ICompositeFeed {
    CompositeForecast internal f;
    function set(uint256 ensemble, uint16 conf, uint256 contributors, uint256 lub, uint32 dis) external {
        f = CompositeForecast(abi.encode(ensemble), conf, contributors, lub, dis);
    }
    function read(bytes32) external view returns (CompositeForecast memory) {
        return f;
    }
}

/// Minimal ResolutionEngine stub: getCategory returns a settable resolver; resolver returns settable truth.
contract StubResolver {
    uint256 public truth;
    bool public reverts;
    function setTruth(uint256 t) external { truth = t; }
    function setReverts(bool r) external { reverts = r; }
    function resolve(bytes calldata, uint256) external view returns (bytes memory) {
        require(!reverts, "no price");
        return abi.encode(truth);
    }
}

contract StubResolutionEngine {
    address public resolver;
    function setResolver(address r) external { resolver = r; }
    function getCategory(bytes32) external view returns (address, address, bytes memory) {
        return (resolver, address(0), "");
    }
}

contract MarketStressMonitorTest is Test {
    MarketStressMonitor mon;
    StubFeed feed;
    StubResolutionEngine re;
    StubResolver resolver;
    SentimentOracle sentiment;
    bytes32 constant CAT = keccak256("METH_APR_24H");

    function setUp() public {
        feed = new StubFeed();
        re = new StubResolutionEngine();
        resolver = new StubResolver();
        re.setResolver(address(resolver));
        sentiment = new SentimentOracle(address(this));
        mon = new MarketStressMonitor(address(feed), address(re), address(sentiment), address(this));
        // domain [0,2000], dMed 3000, dHigh 6000, surpriseMed 600, surpriseHigh 1500
        mon.setStressConfig(CAT, 0, 2000, 3000, 6000, 600, 1500);
        mon.setThresholds(500, 50_000, 25, 45, 75); // maxStaleBlocks=500 so block=1 is stale at block=1000
        vm.roll(1000); // advance so freshness math is meaningful
    }

    function _calm() internal {
        feed.set(500, 8000, 3, block.number, 1000); // fresh, quorum 3, low disagreement
        resolver.setTruth(505); // tiny surprise
        sentiment.setFearGreed(55); // neutral
    }

    function test_Calm_WhenAllBenign() public {
        _calm();
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Calm));
    }

    function test_Stressed_OnHighDisagreement() public {
        _calm();
        feed.set(500, 8000, 3, block.number, 7000); // disagreement >= dHigh
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Stressed));
    }

    function test_Stressed_OnStaleFeed() public {
        _calm();
        feed.set(500, 8000, 3, 1, 1000); // lastUpdatedBlock=1, far stale
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Stressed));
    }

    function test_Stressed_OnExtremeFear() public {
        _calm();
        sentiment.setFearGreed(10); // extreme fear <= 25
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Stressed));
    }

    function test_Elevated_OnLowQuorum() public {
        _calm();
        feed.set(500, 8000, 1, block.number, 1000); // contributors 1 < MIN_SWARM
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Elevated));
    }

    function test_Surprise_BestEffort_SkipsOnRevert() public {
        _calm();
        resolver.setReverts(true); // resolver can't price → surprise arm skipped, still Calm
        (MarketStressMonitor.Level lvl,) = mon.stressLevel(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Calm));
    }

    function test_Poke_EmitsOnTransition() public {
        _calm();
        mon.poke(CAT); // → Calm (from default Calm: may or may not emit; set to stressed then back)
        feed.set(500, 8000, 3, block.number, 7000);
        vm.recordLogs();
        MarketStressMonitor.Level lvl = mon.poke(CAT);
        assertEq(uint256(lvl), uint256(MarketStressMonitor.Level.Stressed));
        // a StressWarning log was emitted on the Calm→Stressed transition
        assertGt(vm.getRecordedLogs().length, 0);
    }
}
