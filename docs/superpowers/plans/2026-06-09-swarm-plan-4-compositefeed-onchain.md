# Agent Swarm — Plan 4: On-Chain Swarm Confidence (CompositeFeed) + Parity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `CompositeFeed.sol` so its published confidence is the **quorum-aware, disagreement-adjusted swarm confidence** — bit-identical to `agents/forecasters` (Plan 1), proven against the committed golden vectors. Add the contributor-gathering hardening (malformed-skip, min-confidence gate, domain-clamp). Append a `disagreementBps` field to the feed.

**Architecture:** A new `public pure aggregatePreview(...)` is the single Solidity mirror of TS `aggregateSwarm` — clamp → rank-weighted ensemble → dispersion (`Math.sqrt`) + band-width → per-category `disagreeScale` normalization → `MIN(calibration, agreement)` → quorum cap. `refresh` reads a per-category `bounds` struct (domain + `disagreeScale`, owner-set) and calls it. **Backward-compatible by construction:** when `disagreeScale == 0` the function reproduces the legacy confidence exactly (no agreement, no quorum, `disagreementBps = 0`), so the 169 existing tests pass untouched; Deploy (Plan 5) sets `disagreeScale` per category to switch on the new behavior. Hardening lives in `_gather`/`_contributor` (filters contributors) so it never perturbs the parity-tested aggregation core.

**Tech Stack:** Solidity 0.8.24, Foundry, OpenZeppelin `Math.sqrt` (floor, matches TS `isqrt`).

**Spec/parity source:** `agents/forecasters/src/swarm.ts` (`aggregateSwarm`, `rawDisagreement`) + committed golden vectors `agents/forecasters/test/vectors/swarm-vectors.json`. Constants must match: `WEIGHT_SCALE=1e18`, `CAL_SCALE=1e6`, `CAL_FLOOR=-500000`, `MAX_CONFIDENCE_BPS=10000`, `AGREE_FLOOR=400000`, `MIN_SWARM=3`, `SINGLE_SOURCE_CEILING_BPS=5000`.

**Verified context:** `CompositeFeed.sol._aggregate` is at lines 188–218; `_contributor` decodes `abi.decode(p.value,(uint256,uint256))` at :180; `ICompositeFeed.CompositeForecast` has `{bytes value; uint16 confidence; uint256 contributingAgents; uint256 lastUpdatedBlock}`. Test mocks `MockRegistry` (`setTopAgents`,`setCalibration`) + `MockMarket` (`setLatest`,`setRevealed`,`setStatus`) exist in `test/CompositeFeed.t.sol`. OZ `Math` available at `@openzeppelin/contracts/utils/math/Math.sol`.

**Scope:** Plan 4 of 6. Plan 5 = `MarketStressMonitor` + `SentimentOracle` + Deploy wiring + backtest calibration-emit (sets `disagreeScale` = METH 490 / AAVE 18605122371597231 / USDY 26, and registers METH with `domainMax=2000`). Plan 6 = frontend.

---

## Task 1: Append `disagreementBps` to the feed struct

**Files:**
- Modify: `contracts/src/interfaces/ICompositeFeed.sol`

- [ ] **Step 1: Append the field (ABI-safe — appended at END)**

In `ICompositeFeed.sol`, change the struct to:

```solidity
    struct CompositeForecast {
        bytes value; // abi.encode(uint256 ensemblePointEstimate)
        uint16 confidence; // bps, [0, 10000]
        uint256 contributingAgents;
        uint256 lastUpdatedBlock;
        uint32 disagreementBps; // normalized swarm disagreement, bps [0,10000] (0 when disagreeScale unset)
    }
```

- [ ] **Step 2: Build to confirm the struct change compiles (consumers read by field name)**

Run: `cd contracts && forge build`
Expected: exit 0 (CompositeFeed writes the struct without the new field yet — it defaults to 0, valid).

- [ ] **Step 3: Commit**

```bash
git add contracts/src/interfaces/ICompositeFeed.sol
git commit -m "feat(contracts): append disagreementBps to CompositeForecast (ABI-safe)"
```

---

## Task 2: Per-category bounds (domain + disagreeScale) + new constants

**Files:**
- Modify: `contracts/src/CompositeFeed.sol`

- [ ] **Step 1: Add the OZ Math import + constants + bounds storage**

In `CompositeFeed.sol`, add the import near the top (after the existing imports):

```solidity
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
```

Add these constants alongside the existing ones (after `int256 private constant CAL_FLOOR = -500_000;`):

```solidity
    uint256 internal constant AGREE_FLOOR = 400_000; // 0.4 in CAL_SCALE — agreement multiplier floor
    uint256 internal constant MIN_SWARM = 3; // quorum: below this, confidence is capped (single-source)
    uint256 internal constant SINGLE_SOURCE_CEILING_BPS = 5_000;
    uint16 internal constant MIN_CONTRIB_CONF_BPS = 500; // a contributor must stake >= this stated confidence
```

Add the per-category bounds storage + setter (after the `mapping(bytes32 => CompositeForecast) internal _feeds;` line):

```solidity
    struct CategoryBounds {
        uint256 domainMin;
        uint256 domainMax;
        uint256 disagreeScale; // 0 = legacy (agreement+quorum disabled, fully backward-compatible)
    }

    mapping(bytes32 => CategoryBounds) public categoryBounds;

    event CategoryBoundsSet(bytes32 indexed categoryId, uint256 domainMin, uint256 domainMax, uint256 disagreeScale);

    /// @notice Owner sets the per-category domain + disagreement scale. While disagreeScale==0 the feed
    ///         behaves exactly as before (legacy confidence). Deploy sets these from the backtest.
    function setCategoryBounds(bytes32 categoryId, uint256 domainMin, uint256 domainMax, uint256 disagreeScale)
        external
        onlyOwner
    {
        require(domainMax > domainMin, "bad domain");
        categoryBounds[categoryId] = CategoryBounds(domainMin, domainMax, disagreeScale);
        emit CategoryBoundsSet(categoryId, domainMin, domainMax, disagreeScale);
    }
```

- [ ] **Step 2: Build**

Run: `cd contracts && forge build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add contracts/src/CompositeFeed.sol
git commit -m "feat(contracts): per-category bounds (domain+disagreeScale) + swarm constants"
```

---

## Task 3: `aggregatePreview` — the Solidity mirror of TS aggregateSwarm

**Files:**
- Modify: `contracts/src/CompositeFeed.sol`
- Test: `contracts/test/SwarmParity.t.sol`

This is the parity-critical core. It must match `agents/forecasters/src/swarm.ts` op-for-op.

- [ ] **Step 1: Write the failing parity test `contracts/test/SwarmParity.t.sol`**

The 4 golden vectors are committed in `agents/forecasters/test/vectors/swarm-vectors.json`. **Open that file and transcribe each vector's inputs + expected outputs into an assertion below.** The template shows `meth-agree-n3` (expected confidence 7841, disagreement 1998 — confirmed values); add `meth-scatter-n3`, `meth-lone-n1`, and `usdy-agree-n3` by reading their `expected.{ensemble,confidenceBps,disagreementBps}` from the JSON.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";

/// @notice Bit-parity of CompositeFeed.aggregatePreview against the committed TS golden vectors in
///         agents/forecasters/test/vectors/swarm-vectors.json. If this drifts, the on-chain feed no
///         longer matches the backtest.
contract SwarmParityTest is Test {
    CompositeFeed feed;

    function setUp() public {
        feed = new CompositeFeed(address(this));
    }

    function _u(uint256[3] memory a) internal pure returns (uint256[] memory r) {
        r = new uint256[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    function _u16(uint16[3] memory a) internal pure returns (uint16[] memory r) {
        r = new uint16[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    function _i(int256[3] memory a) internal pure returns (int256[] memory r) {
        r = new int256[](3);
        r[0] = a[0]; r[1] = a[1]; r[2] = a[2];
    }

    // Vector meth-agree-n3: domain [0,100000], disagreeScale 5000.
    function test_Parity_MethAgreeN3() public view {
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]),
            _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9800), 9800, 9800]),
            _i([int256(0), 0, 0]),
            0, 100000, 5000
        );
        assertEq(ens, 50000, "ensemble");
        assertEq(conf, 7841, "confidence");
        assertEq(dis, 1998, "disagreementBps");
    }

    // Vector meth-lone-n1: single agent — quorum cap, confidence <= 5000.
    function test_Parity_MethLoneN1() public view {
        uint256[] memory lo = new uint256[](1); lo[0] = 48000;
        uint256[] memory hi = new uint256[](1); hi[0] = 52000;
        uint16[] memory st = new uint16[](1); st[0] = 9600;
        int256[] memory cl = new int256[](1); cl[0] = 0;
        (, uint16 conf,) = feed.aggregatePreview(lo, hi, st, cl, 0, 100000, 5000);
        assertLe(conf, 5000, "single-source ceiling");
    }

    // TODO transcribe meth-scatter-n3 and usdy-agree-n3 from swarm-vectors.json: read each vector's
    // lo/hi/stated/cal/params + expected.{ensemble,confidenceBps,disagreementBps} and assert exact match.
    // (Both are n=3; usdy-agree-n3 uses domain [0,2000], disagreeScale 120.)
}
```

**Replace the `TODO` comment with two real test functions transcribed from the JSON before moving on.**

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd contracts && forge test --match-contract SwarmParityTest`
Expected: FAIL — `aggregatePreview` not defined.

- [ ] **Step 3: Add `aggregatePreview` to `CompositeFeed.sol`**

Add this `public pure` function (place it near `_aggregate`). It mirrors `agents/forecasters/src/swarm.ts::aggregateSwarm` exactly:

```solidity
    /// @notice Pure Solidity mirror of forecasters/aggregateSwarm. Contributors in RANK ORDER. When
    ///         disagreeScale==0, reproduces the legacy confidence (no agreement, no quorum, disagreement 0).
    /// @dev Bit-parity with the TS golden vectors (test/SwarmParity.t.sol). All scaled-integer.
    function aggregatePreview(
        uint256[] memory lo,
        uint256[] memory hi,
        uint16[] memory stated,
        int256[] memory cals,
        uint256 domainMin,
        uint256 domainMax,
        uint256 disagreeScale
    ) public pure returns (uint256 ensemble, uint16 confidence, uint32 disagreementBps) {
        uint256 n = lo.length;
        if (n == 0) return (0, 0, 0);

        uint256 denom = (n * (n + 1)) / 2;

        // Clamp bands → midpoints + widths; accumulate ensemble + weightedStated in one pass.
        uint256[] memory mid = new uint256[](n);
        uint256[] memory width = new uint256[](n);
        uint256 weightedStated;
        for (uint256 i = 0; i < n; ++i) {
            uint256 a = lo[i] < domainMin ? domainMin : (lo[i] > domainMax ? domainMax : lo[i]);
            uint256 b = hi[i] < domainMin ? domainMin : (hi[i] > domainMax ? domainMax : hi[i]);
            mid[i] = (a + b) / 2;
            width[i] = b - a;
            uint256 w = ((n - i) * WEIGHT_SCALE) / denom;
            ensemble += (w * mid[i]) / WEIGHT_SCALE;
            weightedStated += w * uint256(stated[i]);
        }

        // Calibration multiplier (existing derivation): mean of clipped (<=0, floored at CAL_FLOOR) + 1.
        int256 sumClipped;
        for (uint256 i = 0; i < n; ++i) {
            int256 c = cals[i] < CAL_FLOOR ? CAL_FLOOR : cals[i];
            if (c > 0) c = 0;
            sumClipped += c;
        }
        int256 meanClipped = sumClipped / int256(n);
        uint256 calMult = uint256(int256(CAL_SCALE) + meanClipped);

        // Legacy path: agreement + quorum disabled, fully backward-compatible.
        if (disagreeScale == 0) {
            uint256 legacy = (weightedStated * calMult) / (WEIGHT_SCALE * CAL_SCALE);
            if (legacy > MAX_CONFIDENCE_BPS) legacy = MAX_CONFIDENCE_BPS;
            return (ensemble, uint16(legacy), 0);
        }

        // Dispersion: weighted variance → floor sqrt; mean band width.
        uint256 V;
        uint256 Wbar;
        for (uint256 i = 0; i < n; ++i) {
            uint256 w = ((n - i) * WEIGHT_SCALE) / denom;
            uint256 diff = mid[i] > ensemble ? mid[i] - ensemble : ensemble - mid[i];
            V += (w * (diff * diff)) / WEIGHT_SCALE;
            Wbar += (w * width[i]) / WEIGHT_SCALE;
        }
        uint256 dRaw = Math.sqrt(V) + Wbar / 2;

        // Normalized disagreement d in [0, CAL_SCALE]; agreement multiplier g.
        uint256 d = (dRaw * CAL_SCALE) / disagreeScale;
        if (d > CAL_SCALE) d = CAL_SCALE;
        uint256 g = CAL_SCALE - d;
        if (g < AGREE_FLOOR) g = AGREE_FLOOR;

        // Combine penalties with MIN (not product).
        uint256 mult = calMult < g ? calMult : g;
        uint256 finalConf = (weightedStated * mult) / (WEIGHT_SCALE * CAL_SCALE);
        if (finalConf > MAX_CONFIDENCE_BPS) finalConf = MAX_CONFIDENCE_BPS;

        // Quorum cap: a sub-MIN_SWARM swarm cannot claim full consensus confidence.
        if (n < MIN_SWARM && finalConf > SINGLE_SOURCE_CEILING_BPS) finalConf = SINGLE_SOURCE_CEILING_BPS;

        confidence = uint16(finalConf);
        ensemble = ensemble; // already set
        disagreementBps = uint32((d * MAX_CONFIDENCE_BPS) / CAL_SCALE);
    }
```

- [ ] **Step 4: Run the parity test to confirm it passes**

Run: `cd contracts && forge test --match-contract SwarmParityTest -vv`
Expected: PASS — all 4 golden vectors match (proving Solidity == TS == backtest).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/CompositeFeed.sol contracts/test/SwarmParity.t.sol
git commit -m "feat(contracts): aggregatePreview — Solidity swarm math, bit-parity with TS golden vectors"
```

---

## Task 4: Swarm math edge-case tests (mirror TS swarm.test.ts)

**Files:**
- Test: `contracts/test/SwarmParity.t.sol` (extend)

- [ ] **Step 1: Add edge-case assertions**

Append these tests to `SwarmParityTest` (they exercise the same behaviors as `agents/forecasters/test/swarm.test.ts`):

```solidity
    function test_Empty_ReturnsZero() public view {
        uint256[] memory e = new uint256[](0);
        uint16[] memory e16 = new uint16[](0);
        int256[] memory ei = new int256[](0);
        (uint256 ens, uint16 conf, uint32 dis) = feed.aggregatePreview(e, e, e16, ei, 0, 100000, 5000);
        assertEq(ens, 0); assertEq(conf, 0); assertEq(dis, 0);
    }

    function test_AntiGaming_WideBandsHighDisagreement() public view {
        // identical midpoints but full-domain bands → high disagreement + confidence haircut
        (, uint16 tightConf, uint32 tightDis) = feed.aggregatePreview(
            _u([uint256(49800), 49800, 49800]), _u([uint256(50200), 50200, 50200]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        (, uint16 wideConf, uint32 wideDis) = feed.aggregatePreview(
            _u([uint256(0), 0, 0]), _u([uint256(100000), 100000, 100000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        assertGt(wideDis, 5000);
        assertGt(wideDis, tightDis);
        assertLt(wideConf, tightConf);
    }

    function test_MinCombine_BadCalibrationHaircut() public view {
        (, uint16 goodConf,) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]), _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(0), 0, 0]), 0, 100000, 5000);
        (, uint16 badConf,) = feed.aggregatePreview(
            _u([uint256(49000), 49000, 49000]), _u([uint256(51000), 51000, 51000]),
            _u16([uint16(9000), 9000, 9000]), _i([int256(-500000), -500000, -500000]), 0, 100000, 5000);
        assertLt(badConf, goodConf);
    }

    function test_Legacy_DisagreeScaleZero_NoQuorumNoAgreement() public view {
        // disagreeScale 0 → legacy: even n=1 keeps full (calMult-only) confidence, disagreement 0
        uint256[] memory lo = new uint256[](1); lo[0] = 49000;
        uint256[] memory hi = new uint256[](1); hi[0] = 51000;
        uint16[] memory st = new uint16[](1); st[0] = 9000;
        int256[] memory cl = new int256[](1); cl[0] = 0;
        (, uint16 conf, uint32 dis) = feed.aggregatePreview(lo, hi, st, cl, 0, 100000, 0);
        assertEq(dis, 0);
        assertGt(conf, 5000, "legacy not quorum-capped");
    }

    function test_TvlDomain_NoOverflow() public view {
        (, uint16 conf,) = feed.aggregatePreview(
            _u([uint256(9_000_000_000_000_000), 9_100_000_000_000_000, 9_050_000_000_000_000]),
            _u([uint256(9_200_000_000_000_000), 9_300_000_000_000_000, 9_250_000_000_000_000]),
            _u16([uint16(8000), 8000, 8000]), _i([int256(0), 0, 0]),
            0, 100_000_000_000_000_000, 2_000_000_000_000_000);
        assertGt(conf, 0);
    }
```

- [ ] **Step 2: Run them**

Run: `cd contracts && forge test --match-contract SwarmParityTest`
Expected: PASS (parity + all edge cases).

- [ ] **Step 3: Commit**

```bash
git add contracts/test/SwarmParity.t.sol
git commit -m "test(contracts): swarm aggregation edge cases (quorum, anti-gaming, MIN-combine, legacy, TVL)"
```

---

## Task 5: Wire `refresh` to the new math (backward-compatible)

**Files:**
- Modify: `contracts/src/CompositeFeed.sol`

- [ ] **Step 1: Route `_aggregate` through `aggregatePreview` using the category bounds**

In `CompositeFeed.sol`, the current `refresh` computes `(uint256 ensemble, uint16 confidence) = _aggregate(points, stated, cals, n);`. Replace the aggregation + store so it uses the per-category bounds and stores `disagreementBps`. Change the relevant block in `refresh` (the part after `_gather` returns, when `n != 0`) to:

```solidity
        CategoryBounds memory cb = categoryBounds[categoryId];
        (uint256 ensemble, uint16 confidence, uint32 disagreementBps) =
            aggregatePreview(lows, highs, stated, cals, cb.domainMin, cb.domainMax, cb.disagreeScale);

        _feeds[categoryId] = CompositeForecast({
            value: abi.encode(ensemble),
            confidence: confidence,
            contributingAgents: n,
            lastUpdatedBlock: block.number,
            disagreementBps: disagreementBps
        });

        emit CompositeFeedRefreshed(categoryId, ensemble, confidence, n, block.number);
```

This requires `_gather` to return the raw `lows`/`highs` (not pre-collapsed midpoints) so `aggregatePreview` can clamp + compute widths. Update `_gather` to return `(uint256[] memory lows, uint256[] memory highs, uint16[] memory stated, int256[] memory cals, uint256 n)` and `_contributor` to return `(bool ok, uint256 low, uint256 high, uint16 stated, int256 cal)` (decoding low/high instead of the midpoint). Adjust the buffers in `_gather` accordingly. **Delete the old `_aggregate` function** (its logic now lives in `aggregatePreview`'s legacy + new paths).

Also update the FIRST-empty-write branch (the `n == 0` hold-last-good path) to include the new struct field:

```solidity
                existing.value = abi.encode(uint256(0));
                existing.lastUpdatedBlock = block.number;
                existing.disagreementBps = 0;
                emit CompositeFeedRefreshed(categoryId, 0, 0, 0, block.number);
```

- [ ] **Step 2: Build + run the FULL existing suite (backward-compat gate)**

Run: `cd contracts && forge build && forge test`
Expected: **all existing tests pass** (the existing `CompositeFeed.t.sol` categories have `disagreeScale==0` → legacy confidence, unchanged) PLUS the new SwarmParity tests. If any existing CompositeFeed test fails on confidence, the legacy path diverged — re-check `aggregatePreview`'s `disagreeScale==0` branch reproduces `weightedStated*calMult/(WEIGHT_SCALE*CAL_SCALE)` exactly.

- [ ] **Step 3: Commit**

```bash
git add contracts/src/CompositeFeed.sol
git commit -m "feat(contracts): route refresh through aggregatePreview + store disagreementBps (legacy-compatible)"
```

---

## Task 6: Contributor-gathering hardening (malformed-skip + min-confidence gate)

**Files:**
- Modify: `contracts/src/CompositeFeed.sol`
- Test: `contracts/test/CompositeFeedHardening.t.sol`

The domain-clamp already lives in `aggregatePreview` (parity-safe). Add the two filters that drop bad contributors in `_contributor` (so they never reach the aggregation).

- [ ] **Step 1: Write the failing test `contracts/test/CompositeFeedHardening.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {CompositeFeed} from "../src/CompositeFeed.sol";
import {ICompositeFeed} from "../src/interfaces/ICompositeFeed.sol";
import {IAgentRegistry} from "../src/interfaces/IAgentRegistry.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";

// Reuse the same mock shapes as CompositeFeed.t.sol (copy the MockRegistry + MockMarket from that file).
// (The implementer: copy the two mock contracts verbatim from test/CompositeFeed.t.sol into this file,
//  or import them if they are in a shared file.)

contract CompositeFeedHardeningTest is Test {
    CompositeFeed feed;
    // ... declare registry + market mocks (copied) ...

    bytes32 constant CAT = keccak256("METH_APR_24H");

    // helper to build a top-20 array with the given ids in front
    function _top(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[20] memory t) {
        t[0] = a; t[1] = b; t[2] = c;
    }

    function setUp() public {
        // deploy feed + mocks, setAgentRegistry/setPredictionMarket, setCategoryBounds(CAT, 0, 100000, 5000)
        // (implementer wires this like CompositeFeed.t.sol setUp)
    }

    function test_MalformedValue_IsSkipped_FeedStillRefreshes() public {
        // agent 1 = good revealed band; agent 2 = revealed but value is a wrong-length blob.
        // Expect refresh() to NOT revert and to count only the good contributor.
        // (implementer: set agent2's prediction.value to abi.encode(uint256(1)) [length 32, not 64];
        //  the contributor must be skipped, not revert the whole refresh.)
    }

    function test_BelowMinConfidence_IsSkipped() public {
        // agent with stated confidence < MIN_CONTRIB_CONF_BPS (500) must not be counted.
    }
}
```

**Implementer:** flesh out `setUp` + the two tests using the `MockRegistry`/`MockMarket` pattern from `test/CompositeFeed.t.sol` (copy those mocks into this file). The malformed case sets a revealed prediction whose `value` is `abi.encode(uint256(1))` (length 32 ≠ the expected 64) — assert `feed.refresh(CAT)` does not revert and `feed.read(CAT).contributingAgents` excludes it. The min-confidence case sets a revealed band with `confidence = 400` (< 500) and asserts it is excluded.

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd contracts && forge test --match-contract CompositeFeedHardeningTest`
Expected: FAIL (either compile error until fleshed out, then assertion failure because the contributor isn't yet skipped).

- [ ] **Step 3: Harden `_contributor` in `CompositeFeed.sol`**

In `_contributor`, after fetching the prediction and checking `status == Revealed`, add the length guard before decoding, and the min-confidence gate:

```solidity
        IPredictionMarket.Prediction memory p = predictionMarket.getPrediction(predId);
        if (p.status != IPredictionMarket.PredictionStatus.Revealed || p.value.length != 64) {
            return (false, 0, 0, 0, 0);
        }
        if (p.confidence < MIN_CONTRIB_CONF_BPS) {
            return (false, 0, 0, 0, 0);
        }
        (uint256 low, uint256 high) = abi.decode(p.value, (uint256, uint256));
        return (true, low, high, p.confidence, agentRegistry.getReputation(agentId, categoryId).calibrationScore);
```

(The `p.value.length != 64` check is what makes a malformed `abi.encode(uint256)` blob — length 32 — skip instead of reverting the whole `refresh`. The return signature must match the updated `_contributor` from Task 5: `(bool ok, uint256 low, uint256 high, uint16 stated, int256 cal)`.)

- [ ] **Step 4: Run the hardening test + full suite**

Run: `cd contracts && forge test --match-contract CompositeFeedHardeningTest`
Expected: PASS.
Run: `cd contracts && forge test`
Expected: full suite green (existing + SwarmParity + hardening).

- [ ] **Step 5: Commit**

```bash
git add contracts/src/CompositeFeed.sol contracts/test/CompositeFeedHardening.t.sol
git commit -m "feat(contracts): CompositeFeed hardening — skip malformed + sub-min-confidence contributors"
```

---

## Task 7: Full verification

**Files:** none

- [ ] **Step 1: Full forge suite + build**

Run: `cd contracts && forge build && forge test`
Expected: ALL tests pass (the original 169 + the new SwarmParity + CompositeFeedHardening). Note the new total.

- [ ] **Step 2: Confirm the TS side is untouched + still green**

Run: `pnpm --filter @predictor-index/forecasters test`
Expected: 51 tests pass (the golden vectors the parity test mirrors are unchanged).

- [ ] **Step 3: Commit any incidental cleanup (none expected)**

```bash
git status --porcelain
```
Expected: clean.

---

## Self-Review (completed by plan author)

- **Spec coverage:** §2 swarm math on-chain (`aggregatePreview` mirrors TS: clamp, rank-weights, dispersion via floor `Math.sqrt`, band-width, per-category `disagreeScale`, `MIN(cal,agree)`, quorum cap, `AGREE_FLOOR`) — Tasks 3,4; §3 ABI append `disagreementBps` — Task 1; §6 hardening (malformed-skip, min-confidence gate; domain-clamp inside the parity-safe core) — Task 6; per-category bounds owner-set for Deploy — Task 2. **Deferred (by spec):** rank-weight cap + correlation down-weighting = P2 (they'd break parity). **Plan 5:** `MarketStressMonitor` + `SentimentOracle` + Deploy sets `disagreeScale`/registers METH `domainMax=2000`/seeds F&G + backtest calibration-emit.
- **Parity discipline:** the math lives once in `aggregatePreview`, asserted bit-equal against the committed `swarm-vectors.json` (Task 3). Constants match Plan 1 exactly. `Math.sqrt` is floor (== TS `isqrt`).
- **Backward-compat:** `disagreeScale==0` reproduces the exact legacy confidence (no agreement/quorum, disagreement 0), so the 169 existing tests pass untouched (Task 5 gate); hardening filters contributors pre-aggregation so it can't perturb parity.
- **Placeholder note:** Task 3 requires transcribing 2 golden vectors from the committed JSON, and Task 6 requires copying the existing mock contracts + fleshing the two hardening tests — both are explicit, bounded instructions against committed/existing artifacts, not open-ended placeholders.
