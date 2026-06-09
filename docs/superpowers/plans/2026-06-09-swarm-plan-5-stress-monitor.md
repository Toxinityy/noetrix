# Agent Swarm — Plan 5: Market-Stress Monitor + Sentiment Oracle + Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the on-chain **market-stress warning**. `MarketStressMonitor.sol` reads the swarm feed (disagreement + quorum + freshness) plus two **model-independent** signals — forecast-surprise (from the category resolver) and Fear & Greed (from a new `SentimentOracle.sol`) — and emits `StressWarning(category, level, reasons)` → {Calm/Elevated/Stressed}. The backtest emits the tuned per-category calibration; `Deploy.s.sol` wires everything and — critically — calls `CompositeFeed.setCategoryBounds` so the on-chain feed runs the real swarm math (matching the backtest) and registers METH at `domainMax=2000`.

**Architecture:** The Monitor is read-mostly and **honest** — it does not re-threshold confidence (that's RiskManager's parameter channel); it combines disagreement + quorum + freshness + surprise + sentiment into a 3-level alert. Per-category stress thresholds + domain are owner-set from the backtest (`config/swarm-calibration.json`). The forecast-surprise resolver read is **best-effort** (try/catch in a `view` fn): if the oracle can't price the current block, that arm is skipped, never reverting. `SentimentOracle` mirrors the mock-oracle pattern (keeper-set, seeded from real F&G).

**Tech Stack:** Solidity 0.8.24, Foundry; TS (backtest calibration-emit).

**Spec:** `docs/superpowers/specs/2026-06-09-agent-swarm-confidence-stress-design.md` §4 (3-source stress). Off-chain mirror: `agents/backtest/src/stress.ts` (`classifyStress`, `DEFAULT_STRESS`).

**Verified context:** `RiskManager.MAX_STALE_BLOCKS = 50_000` (reuse). `ResolutionEngine.getCategory(bytes32) → (address resolver, address scorer, bytes config)`; `ICategoryResolver.resolve(bytes,uint256) view returns (bytes)` (outcome = `abi.encode(uint256 actual)`). `ICompositeFeed.read(catId) → CompositeForecast{bytes value, uint16 confidence, uint256 contributingAgents, uint256 lastUpdatedBlock, uint32 disagreementBps}`. `CompositeFeed.setCategoryBounds(catId, domainMin, domainMax, disagreeScale)` (Plan 4). Tuned values (from the backtest, in memory): METH `0/2000/490`, AAVE `0/1e17/18605122371597231`, USDY `0/2000/26`.

**Scope:** Plan 5 of 6. Plan 6 = frontend wiring + live runners + real-data oracle seeding (incl. running Deploy live with keys + seeding F&G/oracles + registering/running the 7 agents). This plan delivers the contracts + tests + a Deploy script verified by **dry-run simulation** (no broadcast).

---

## Task 1: Backtest emits per-category stress calibration

**Files:**
- Modify: `agents/backtest/src/types.ts`, `agents/backtest/src/run.ts`
- Create: `agents/backtest/src/calibration.ts`
- Modify: `agents/backtest/scripts/run-backtest.ts`
- Test: `agents/backtest/test/calibration.test.ts`

- [ ] **Step 1: Add the tuned thresholds to `CategoryResult`**

In `agents/backtest/src/types.ts`, add to the `CategoryResult` interface (after `disagreeScale: string;`):

```ts
  /// Tuned stress thresholds (train split) — the on-chain MarketStressMonitor defaults.
  stress: { dMed: number; dHigh: number; surpriseMed: number; surpriseHigh: number };
  /// On-chain domain bounds for this category (for the Monitor's surprise normalization).
  domainMin: string;
  domainMax: string;
```

- [ ] **Step 2: Populate them in `runOneCategory`**

In `agents/backtest/src/run.ts`, the function already computes `thresholds` via `tuneStressThresholds(...)`. Add `import { METRICS } from "@predictor-index/market-data";` and include the new fields in the returned `CategoryResult`:

```ts
    stress: {
      dMed: thresholds.dMed,
      dHigh: thresholds.dHigh,
      surpriseMed: thresholds.surpriseMed,
      surpriseHigh: thresholds.surpriseHigh,
    },
    domainMin: METRICS[metric].domainMin.toString(),
    domainMax: METRICS[metric].domainMax.toString(),
```

- [ ] **Step 3: Write the failing test `agents/backtest/test/calibration.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildCalibration } from "../src/calibration.js";
import type { CategoryResult } from "../src/types.js";

const cat: CategoryResult = {
  metric: "METH_APR", disagreeScale: "490", trainSteps: 100, testSteps: 40, steps: [], agents: [],
  stress: { dMed: 4612, dHigh: 7000, surpriseMed: 3, surpriseHigh: 18 },
  domainMin: "0", domainMax: "2000",
};

describe("buildCalibration", () => {
  it("maps each category to its on-chain config + global F&G thresholds", () => {
    const c = buildCalibration([cat]);
    expect(c.fearExtreme).toBe(25);
    expect(c.categories.METH_APR.disagreeScale).toBe("490");
    expect(c.categories.METH_APR.domainMax).toBe("2000");
    expect(c.categories.METH_APR.dHigh).toBe(7000);
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/backtest test calibration`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `agents/backtest/src/calibration.ts`**

```ts
import type { CategoryResult } from "./types.js";

export interface SwarmCalibration {
  generatedAt: string;
  fearExtreme: number;
  fearMed: number;
  greedExtreme: number;
  categories: Record<
    string,
    { domainMin: string; domainMax: string; disagreeScale: string; dMed: number; dHigh: number; surpriseMed: number; surpriseHigh: number }
  >;
}

/// Collapse the backtest results into the on-chain calibration the contracts consume:
/// per-category bounds + disagreeScale + stress thresholds, plus the absolute F&G bands.
export function buildCalibration(results: CategoryResult[], generatedAt = ""): SwarmCalibration {
  const categories: SwarmCalibration["categories"] = {};
  for (const r of results) {
    categories[r.metric] = {
      domainMin: r.domainMin,
      domainMax: r.domainMax,
      disagreeScale: r.disagreeScale,
      dMed: r.stress.dMed,
      dHigh: r.stress.dHigh,
      surpriseMed: r.stress.surpriseMed,
      surpriseHigh: r.stress.surpriseHigh,
    };
  }
  return { generatedAt, fearExtreme: 25, fearMed: 45, greedExtreme: 75, categories };
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/backtest test calibration`
Expected: PASS.

- [ ] **Step 7: Wire it into the CLI + write the contracts-readable JSON**

In `agents/backtest/scripts/run-backtest.ts`, add the import `import { buildCalibration } from "../src/calibration.js";` and, after building the snapshot, write the calibration JSON to a path Deploy can read:

```ts
  const calib = buildCalibration(results, stamp);
  const calibDir = join(here, "..", "..", "..", "contracts", "config");
  if (!existsSync(calibDir)) mkdirSync(calibDir, { recursive: true });
  writeFileSync(join(calibDir, "swarm-calibration.json"), JSON.stringify(calib, null, 2) + "\n");
  console.log("[ok] wrote contracts/config/swarm-calibration.json");
```

- [ ] **Step 8: Re-run the backtest to emit the calibration (real data present)**

Run: `pnpm --filter @predictor-index/backtest run:backtest`
Expected: writes `contracts/config/swarm-calibration.json` with METH/AAVE/USDY entries. Inspect it: METH `disagreeScale=490`, `domainMax=2000`; AAVE `disagreeScale=18605122371597231`; USDY `disagreeScale=26`. (The `dMed/dHigh/surpriseMed/surpriseHigh` are whatever the tuner produced — these become the Monitor defaults.)

- [ ] **Step 9: Commit**

```bash
git add agents/backtest/src/types.ts agents/backtest/src/run.ts agents/backtest/src/calibration.ts agents/backtest/scripts/run-backtest.ts agents/backtest/test/calibration.test.ts contracts/config/swarm-calibration.json
git commit -m "feat(backtest): emit per-category swarm calibration (disagreeScale + stress thresholds) for Deploy"
```

---

## Task 2: `SentimentOracle.sol` — on-chain Fear & Greed

**Files:**
- Create: `contracts/src/mocks/SentimentOracle.sol`
- Create: `contracts/src/interfaces/ISentimentOracle.sol`
- Test: `contracts/test/SentimentOracle.t.sol`

- [ ] **Step 1: Write the failing test `contracts/test/SentimentOracle.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";

contract SentimentOracleTest is Test {
    SentimentOracle oracle;
    address keeper = address(0xBEEF);

    function setUp() public {
        oracle = new SentimentOracle(address(this));
    }

    function test_OwnerCanSet_LatestReflects() public {
        oracle.setFearGreed(42);
        (uint8 v, uint256 b) = oracle.latest();
        assertEq(v, 42);
        assertEq(b, block.number);
    }

    function test_KeeperCanSet_NonKeeperReverts() public {
        oracle.setKeeper(keeper, true);
        vm.prank(keeper);
        oracle.setFearGreed(10);
        (uint8 v,) = oracle.latest();
        assertEq(v, 10);
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        oracle.setFearGreed(99);
    }

    function test_RejectsOutOfRange() public {
        vm.expectRevert();
        oracle.setFearGreed(101);
    }
}
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd contracts && forge test --match-contract SentimentOracleTest`
Expected: FAIL — contract not found.

- [ ] **Step 3: Create `contracts/src/interfaces/ISentimentOracle.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ISentimentOracle — latest market Fear & Greed index (0–100).
interface ISentimentOracle {
    function latest() external view returns (uint8 value, uint256 updatedBlock);
}
```

- [ ] **Step 4: Create `contracts/src/mocks/SentimentOracle.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISentimentOracle} from "../interfaces/ISentimentOracle.sol";

/// @title SentimentOracle — keeper-posted Crypto Fear & Greed index (0–100).
/// @notice v1 mock: a keeper posts the latest index (seeded from real alternative.me data). The
///         MarketStressMonitor reads `latest()` and ignores it when stale.
contract SentimentOracle is ISentimentOracle, Ownable {
    uint8 public latestValue;
    uint256 public latestUpdatedBlock;
    mapping(address => bool) public keepers;

    error OutOfRange();
    error NotKeeper();

    event FearGreedSet(uint8 value, uint256 blockNumber);
    event KeeperSet(address indexed keeper, bool allowed);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyKeeper() {
        if (msg.sender != owner() && !keepers[msg.sender]) revert NotKeeper();
        _;
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        keepers[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setFearGreed(uint8 value) external onlyKeeper {
        if (value > 100) revert OutOfRange();
        latestValue = value;
        latestUpdatedBlock = block.number;
        emit FearGreedSet(value, block.number);
    }

    function latest() external view returns (uint8 value, uint256 updatedBlock) {
        return (latestValue, latestUpdatedBlock);
    }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd contracts && forge test --match-contract SentimentOracleTest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/interfaces/ISentimentOracle.sol contracts/src/mocks/SentimentOracle.sol contracts/test/SentimentOracle.t.sol
git commit -m "feat(contracts): SentimentOracle — keeper-posted Fear & Greed index"
```

---

## Task 3: `MarketStressMonitor.sol` — the 3-source warning

**Files:**
- Create: `contracts/src/examples/MarketStressMonitor.sol`
- Test: `contracts/test/MarketStressMonitor.t.sol`

- [ ] **Step 1: Write the failing test `contracts/test/MarketStressMonitor.t.sol`**

```solidity
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd contracts && forge test --match-contract MarketStressMonitorTest`
Expected: FAIL — contract not found.

- [ ] **Step 3: Create `contracts/src/examples/MarketStressMonitor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICompositeFeed} from "../interfaces/ICompositeFeed.sol";
import {ISentimentOracle} from "../interfaces/ISentimentOracle.sol";
import {ICategoryResolver} from "../interfaces/ICategoryResolver.sol";

interface IResolutionEngineView {
    function getCategory(bytes32 categoryId) external view returns (address resolver, address scorer, bytes memory config);
}

/// @title MarketStressMonitor — honest on-chain market-stress warning over the swarm feed.
/// @notice Combines THREE independent signals into a 3-level alert: (1) ensemble disagreement +
///         quorum + freshness from the swarm feed; (2) model-independent forecast-surprise read
///         best-effort from the category resolver; (3) external Fear & Greed sentiment. This is an
///         alert/labeling layer — RiskManager owns parameter gating off confidence. It does NOT claim
///         to predict shocks; it flags model-uncertainty + realized-surprise + market-fear.
contract MarketStressMonitor is Ownable {
    enum Level {
        Calm,
        Elevated,
        Stressed
    }

    uint256 public constant MIN_SWARM = 3;

    // reason bitmap flags
    uint256 internal constant R_STALE = 1 << 0;
    uint256 internal constant R_DISAGREE_HIGH = 1 << 1;
    uint256 internal constant R_DISAGREE_MED = 1 << 2;
    uint256 internal constant R_SURPRISE_HIGH = 1 << 3;
    uint256 internal constant R_SURPRISE_MED = 1 << 4;
    uint256 internal constant R_FEAR_EXTREME = 1 << 5;
    uint256 internal constant R_FEAR = 1 << 6;
    uint256 internal constant R_GREED = 1 << 7;
    uint256 internal constant R_LOW_QUORUM = 1 << 8;

    ICompositeFeed public immutable feed;
    IResolutionEngineView public immutable resolutionEngine;
    ISentimentOracle public immutable sentiment;

    uint256 public maxStaleBlocks = 50_000; // match RiskManager.MAX_STALE_BLOCKS
    uint256 public sentimentStaleBlocks = 50_000;
    uint8 public fearExtreme = 25;
    uint8 public fearMed = 45;
    uint8 public greedExtreme = 75;

    struct StressConfig {
        uint256 domainMin;
        uint256 domainMax;
        uint16 dMed;
        uint16 dHigh;
        uint16 surpriseMed;
        uint16 surpriseHigh;
        bool set;
    }

    mapping(bytes32 => StressConfig) public stressConfig;
    mapping(bytes32 => Level) public lastLevel;

    event StressConfigSet(bytes32 indexed categoryId);
    event ThresholdsSet(uint256 maxStaleBlocks, uint256 sentimentStaleBlocks, uint8 fearExtreme, uint8 fearMed, uint8 greedExtreme);
    event StressWarning(bytes32 indexed categoryId, Level level, uint256 reasons, uint256 blockNumber);

    constructor(address _feed, address _resolutionEngine, address _sentiment, address initialOwner)
        Ownable(initialOwner)
    {
        require(_feed != address(0) && _resolutionEngine != address(0) && _sentiment != address(0), "zero");
        feed = ICompositeFeed(_feed);
        resolutionEngine = IResolutionEngineView(_resolutionEngine);
        sentiment = ISentimentOracle(_sentiment);
    }

    function setStressConfig(
        bytes32 categoryId,
        uint256 domainMin,
        uint256 domainMax,
        uint16 dMed,
        uint16 dHigh,
        uint16 surpriseMed,
        uint16 surpriseHigh
    ) external onlyOwner {
        require(domainMax > domainMin, "bad domain");
        stressConfig[categoryId] =
            StressConfig(domainMin, domainMax, dMed, dHigh, surpriseMed, surpriseHigh, true);
        emit StressConfigSet(categoryId);
    }

    function setThresholds(
        uint256 _maxStaleBlocks,
        uint256 _sentimentStaleBlocks,
        uint8 _fearExtreme,
        uint8 _fearMed,
        uint8 _greedExtreme
    ) external onlyOwner {
        maxStaleBlocks = _maxStaleBlocks;
        sentimentStaleBlocks = _sentimentStaleBlocks;
        fearExtreme = _fearExtreme;
        fearMed = _fearMed;
        greedExtreme = _greedExtreme;
        emit ThresholdsSet(_maxStaleBlocks, _sentimentStaleBlocks, _fearExtreme, _fearMed, _greedExtreme);
    }

    /// @notice Best-effort model-independent forecast surprise: |resolverTruth(now) - ensemble| as bps
    ///         of the domain width. Skipped (ok=false) if the resolver can't price the current block.
    function _surpriseBps(bytes32 categoryId, uint256 ensemble, StressConfig memory c)
        internal
        view
        returns (uint256 sBps, bool ok)
    {
        (address resolver,,) = resolutionEngine.getCategory(categoryId);
        if (resolver == address(0)) return (0, false);
        try ICategoryResolver(resolver).resolve("", block.number) returns (bytes memory outcome) {
            if (outcome.length < 32) return (0, false);
            uint256 truth = abi.decode(outcome, (uint256));
            uint256 width = c.domainMax - c.domainMin;
            if (width == 0) return (0, false);
            uint256 gap = truth > ensemble ? truth - ensemble : ensemble - truth;
            return ((gap * 10_000) / width, true);
        } catch {
            return (0, false);
        }
    }

    function _assess(bytes32 categoryId) internal view returns (Level level, uint256 reasons) {
        StressConfig memory c = stressConfig[categoryId];
        ICompositeFeed.CompositeForecast memory f = feed.read(categoryId);

        bool stressed;
        bool elevated;

        // freshness
        bool fresh = f.lastUpdatedBlock != 0 && block.number - f.lastUpdatedBlock <= maxStaleBlocks;
        if (!fresh) {
            stressed = true;
            reasons |= R_STALE;
        }

        if (c.set) {
            // disagreement (model consensus)
            if (f.disagreementBps >= c.dHigh) {
                stressed = true;
                reasons |= R_DISAGREE_HIGH;
            } else if (f.disagreementBps >= c.dMed) {
                elevated = true;
                reasons |= R_DISAGREE_MED;
            }
            // forecast surprise (model-independent, best-effort)
            uint256 ensemble = f.value.length >= 32 ? abi.decode(f.value, (uint256)) : 0;
            (uint256 sBps, bool ok) = _surpriseBps(categoryId, ensemble, c);
            if (ok) {
                if (sBps >= c.surpriseHigh) {
                    stressed = true;
                    reasons |= R_SURPRISE_HIGH;
                } else if (sBps >= c.surpriseMed) {
                    elevated = true;
                    reasons |= R_SURPRISE_MED;
                }
            }
        }

        // quorum
        if (f.contributingAgents < MIN_SWARM) {
            elevated = true;
            reasons |= R_LOW_QUORUM;
        }

        // sentiment (external, absolute)
        (uint8 fg, uint256 fgBlock) = sentiment.latest();
        bool fgFresh = fgBlock != 0 && block.number - fgBlock <= sentimentStaleBlocks;
        if (fgFresh) {
            if (fg <= fearExtreme) {
                stressed = true;
                reasons |= R_FEAR_EXTREME;
            } else if (fg <= fearMed) {
                elevated = true;
                reasons |= R_FEAR;
            } else if (fg >= greedExtreme) {
                elevated = true;
                reasons |= R_GREED;
            }
        }

        level = stressed ? Level.Stressed : (elevated ? Level.Elevated : Level.Calm);
    }

    /// @notice Current stress level + the reason bitmap. Read-only.
    function stressLevel(bytes32 categoryId) external view returns (Level level, uint256 reasons) {
        return _assess(categoryId);
    }

    /// @notice Permissionless: recompute and emit StressWarning on a level transition.
    function poke(bytes32 categoryId) external returns (Level level) {
        uint256 reasons;
        (level, reasons) = _assess(categoryId);
        if (level != lastLevel[categoryId]) {
            lastLevel[categoryId] = level;
            emit StressWarning(categoryId, level, reasons, block.number);
        }
    }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd contracts && forge test --match-contract MarketStressMonitorTest`
Expected: PASS (calm, high-disagreement, stale, extreme-fear, low-quorum, best-effort-surprise-skip, poke-emits).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/examples/MarketStressMonitor.sol contracts/test/MarketStressMonitor.t.sol
git commit -m "feat(contracts): MarketStressMonitor — 3-source market-stress warning (disagreement+surprise+sentiment)"
```

---

## Task 4: Deploy wiring (SentimentOracle + Monitor + setCategoryBounds + METH domain)

**Files:**
- Modify: `contracts/script/Deploy.s.sol`
- Modify: `contracts/foundry.toml` (fs read permission for `config/`)

This task integrates the new contracts into the existing deploy + switches the feed onto the real swarm math. **Read `Deploy.s.sol` first** to find the existing CompositeFeed wiring + category registration + the METH synthetic-oracle seed; add the changes in the matching spots.

- [ ] **Step 1: Allow Deploy to read the calibration JSON**

In `contracts/foundry.toml`, extend `fs_permissions` to include read access to `./config` (alongside the existing `./deployments` entry). For example:

```toml
fs_permissions = [{ access = "read-write", path = "./deployments" }, { access = "read", path = "./config" }]
```

- [ ] **Step 2: In `Deploy.s.sol`, deploy the oracle + monitor and wire the feed**

Add after the existing `CompositeFeed` + `ResolutionEngine` are deployed/wired (use the real variable names from the file):

```solidity
        // ── Sentiment oracle + market-stress monitor ──────────────────────────────
        SentimentOracle sentimentOracle = new SentimentOracle(deployer);
        MarketStressMonitor stressMonitor =
            new MarketStressMonitor(address(compositeFeed), address(resolutionEngine), address(sentimentOracle), deployer);

        // ── Switch the feed onto the real swarm math + register Monitor configs ───
        // Read the tuned calibration emitted by the backtest.
        string memory calib = vm.readFile("config/swarm-calibration.json");
        _configureCategory(compositeFeed, stressMonitor, calib, "METH_APR", METH_APR_24H);
        _configureCategory(compositeFeed, stressMonitor, calib, "AAVE_TVL", AAVE_MANTLE_TVL_24H);
        _configureCategory(compositeFeed, stressMonitor, calib, "USDY_APY", USDY_APY_24H);

        // Seed a recent Fear & Greed value (replaced live by the keeper). 22 ≈ the recent on-chain window.
        sentimentOracle.setFearGreed(22);
```

And add this internal helper to the script contract (reads one category's calibration + sets both the feed bounds and the Monitor config):

```solidity
    function _configureCategory(
        CompositeFeed compositeFeed,
        MarketStressMonitor stressMonitor,
        string memory calib,
        string memory key,
        bytes32 categoryId
    ) internal {
        string memory base = string.concat("$.categories.", key, ".");
        uint256 domainMin = vm.parseJsonUint(calib, string.concat(base, "domainMin"));
        uint256 domainMax = vm.parseJsonUint(calib, string.concat(base, "domainMax"));
        uint256 disagreeScale = vm.parseJsonUint(calib, string.concat(base, "disagreeScale"));
        uint256 dMed = vm.parseJsonUint(calib, string.concat(base, "dMed"));
        uint256 dHigh = vm.parseJsonUint(calib, string.concat(base, "dHigh"));
        uint256 sMed = vm.parseJsonUint(calib, string.concat(base, "surpriseMed"));
        uint256 sHigh = vm.parseJsonUint(calib, string.concat(base, "surpriseHigh"));

        compositeFeed.setCategoryBounds(categoryId, domainMin, domainMax, disagreeScale);
        stressMonitor.setStressConfig(
            categoryId, domainMin, domainMax, uint16(dMed), uint16(dHigh), uint16(sMed), uint16(sHigh)
        );
    }
```

Add the imports at the top of `Deploy.s.sol`:

```solidity
import {SentimentOracle} from "../src/mocks/SentimentOracle.sol";
import {MarketStressMonitor} from "../src/examples/MarketStressMonitor.sol";
```

- [ ] **Step 3: Register METH with the corrected domain (`domainMax=2000`) + realistic synthetic curve**

In `Deploy.s.sol`, the METH category is registered on `ResolutionEngine`/the scorer with `categoryConfig = abi.encode(domainMin, domainMax)`. **Change METH's `domainMax` from `100_000` to `2_000`** in that registration (USDY already uses 2000; AAVE keeps 1e17). Also change the METH synthetic-oracle seed so the resolved APR fits `[0,2000]`: find the `methOracle.setSynthetic(anchorBlock, 1e18, 822)` call and **change the daily-growth ppm from `822` (~3000 bps) to `96` (~350 bps, realistic mETH)**. (Resolved APR ≈ ppm × 3.65 bps.)

- [ ] **Step 4: Serialize the new addresses + dry-run the deploy**

Add `sentimentOracle` and `stressMonitor` to the deployments JSON serialization block (mirror how the other addresses are written).

Run a dry-run simulation (no broadcast, anvil key — same pattern the repo uses):
```bash
cd contracts && forge script script/Deploy.s.sol:Deploy --sig "run()" -vvv 2>&1 | tail -30
```
Expected: simulation succeeds through all deploys + wiring + the `vm.readFile`/`setCategoryBounds`/`setStressConfig` calls + `setFearGreed`. If `vm.parseJsonUint` fails on a path, re-check the JSON shape matches `$.categories.METH_APR.domainMin` etc.

- [ ] **Step 5: Commit**

```bash
git add contracts/script/Deploy.s.sol contracts/foundry.toml
git commit -m "feat(deploy): wire SentimentOracle + MarketStressMonitor; setCategoryBounds from calibration; METH domain 2000"
```

---

## Task 5: Full verification

**Files:** none

- [ ] **Step 1: Full forge suite + build**

Run: `cd contracts && forge build && forge test`
Expected: ALL tests pass — the prior 181 + `SentimentOracleTest` (3) + `MarketStressMonitorTest` (7). Report the new total.

- [ ] **Step 2: Deploy dry-run is clean**

Run: `cd contracts && forge script script/Deploy.s.sol:Deploy --sig "run()" 2>&1 | tail -8`
Expected: simulated execution succeeds (no revert).

- [ ] **Step 3: TS suites unaffected**

Run: `pnpm --filter @predictor-index/backtest test`
Expected: green (calibration test + prior).

---

## Self-Review (completed by plan author)

- **Spec coverage (§4):** 3-source stress — disagreement + quorum + freshness (from the feed), model-independent forecast-surprise (best-effort resolver read, Task 3), Fear & Greed (`SentimentOracle`, Task 2) → `MarketStressMonitor` {Calm/Elevated/Stressed} + `StressWarning` event (Task 3). Per-category thresholds tuned by the backtest (Task 1) and applied by Deploy (Task 4). `maxStaleBlocks` reuses RiskManager's 50_000 (settable, documented). Honest framing in the contract NatSpec (alert layer, not a shock predictor). **The critical `setCategoryBounds` requirement** (feed runs legacy until set) is satisfied in Task 4.
- **Backward-compat:** the Monitor + Oracle are new contracts; the only change to an existing contract path is `Deploy.s.sol` (and the METH category config / synthetic ppm). The full forge suite (Task 5) gates no regressions.
- **Placeholder note:** Task 4 is precise additions integrated into the existing `Deploy.s.sol` (the implementer reads the file to place them) — the new code is complete; only the placement + the existing variable names are read from the file. The synthetic-ppm + domainMax edits are explicit one-value changes.
- **Live ops (Plan 6):** running Deploy with real keys, seeding oracles with real data, keeper-posting F&G, and registering/running the 7 agents are operational steps in Plan 6.
