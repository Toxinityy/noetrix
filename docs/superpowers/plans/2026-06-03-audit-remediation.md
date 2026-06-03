# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the code-actionable findings from the 2026-06-03 architecture audit (`docs/superpowers/specs/2026-06-03-architecture-audit.md`) — the re-run enablers, two correctness fixes, and doc/code reconciliation — and capture the credential-gated operational fixes as a runbook.

**Architecture:** Five self-contained code tasks (TDD where the surface is testable) across three layers — Solidity contracts (Foundry), Node bot config (TypeScript), and docs — plus an operational runbook appendix for the credential-gated items that cannot be unit-tested.

**Tech Stack:** Solidity 0.8.24 + Foundry (forge), TypeScript + viem (bots), Markdown (PRD).

**Scope note:** This plan covers only what can be implemented + verified *without credentials*. The credential-gated items (explorer verification, growing on-chain data, Vercel env, baking the hero trace) are in the **Operational Runbook** at the end — they are exact commands to run, not TDD tasks. The frontend cached-tier hook (audit #6) is listed as a follow-up that needs its own read-first pass of `frontend/src/lib/hooks.ts`.

**Branch:** Already on `architecture-audit` (audit doc + the USDY refresher fix C2 are committed there: `ec39c26`, `65bdf74`). Continue on this branch.

---

## File Structure

| File | Change | Task |
|------|--------|------|
| `contracts/src/BonusDistributor.sol` | `finalizeEpoch` — skip rollover when next epoch already finalized | 1 |
| `contracts/test/BonusDistributor.t.sol` | add out-of-order finalize test | 1 |
| `contracts/src/scorers/RangeCrpsScorer.sol` | add `MAX_DOMAIN` guard | 2 |
| `contracts/test/RangeCrpsScorer.t.sol` | add domain-too-large + large-safe-domain tests | 2 |
| `agents/{resolver,refresher,arima-baseline,claude-reasoner}/src/config.ts` | normalize `0x` key prefix via `requiredKey` helper | 3 |
| `agents/resolver/src/state.ts` + `agents/resolver/src/index.ts` | key resolver cursor on deployment address (auto-reset on redeploy) | 4 |
| `docs/PRD.md` (§7.2.4) + `contracts/src/PredictionMarket.sol` (NatSpec) | reconcile finalize math prose to code; document stake==msg.value | 5 |

---

## Phase 1 — Re-run enablers (do these before growing on-chain data)

These two fixes remove the foot-guns that will bite the pipeline re-run you need in order to grow `resolvedCount ≥ 10` and re-snapshot (audit C1).

### Task 1: Fix rollover-stranding on out-of-order epoch finalization (audit H1)

**Files:**
- Modify: `contracts/src/BonusDistributor.sol:105-120` (`finalizeEpoch`)
- Test: `contracts/test/BonusDistributor.t.sol` (add one test + it reuses existing helpers)

- [ ] **Step 1: Write the failing test**

Add this test to `contracts/test/BonusDistributor.t.sol` (after `test_FinalizeEpoch_Twice_Reverts`, before the `claimBonus` section):

```solidity
    // ─── Out-of-order finalization must not strand the rollover ──────────────────

    function test_FinalizeOutOfOrder_NoRolloverStranding() public {
        // Seed epoch 1's pool with 1 ether (setUp left us at block 1000 = epoch 1).
        _seedPool(1 ether);

        // Advance past the end of epoch 2 (block 3000) so BOTH epoch 1 and 2 are finalizable.
        vm.roll(3 * dist.EPOCH_BLOCKS()); // block 3000 → epoch 3

        // Finalize epoch 2 FIRST (its pool is empty). This freezes finalPool[2] = 0.
        vm.prank(finalizer);
        dist.finalizeEpoch(CATEGORY, 2);

        // Now finalize epoch 1. Its 5% rollover would normally credit pool[2] — but pool[2]
        // is already finalized, so the rollover must be RETAINED in epoch 1, not stranded.
        vm.prank(finalizer);
        dist.finalizeEpoch(CATEGORY, 1);

        uint256 finalizerReward = (1 ether * 50) / 10_000; // 0.5%

        assertEq(
            dist.finalPool(CATEGORY, 1),
            1 ether - finalizerReward,
            "rollover retained in epoch 1's finalPool (not deducted), since epoch 2 is closed"
        );
        assertEq(dist.pool(CATEGORY, 2), 0, "no rollover stranded in the already-finalized next epoch");
        assertEq(
            address(dist).balance,
            dist.finalPool(CATEGORY, 1),
            "all remaining value is claimable; nothing stranded"
        );
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd contracts && forge test --match-test test_FinalizeOutOfOrder_NoRolloverStranding -vvv`
Expected: FAIL — current code credits `pool[2] += 0.05 ether` and sets `finalPool[1] = 0.945 ether`, so both the `finalPool(CATEGORY,1)` and `pool(CATEGORY,2)` assertions fail.

- [ ] **Step 3: Implement the fix**

Replace the body of `finalizeEpoch` in `contracts/src/BonusDistributor.sol` (lines 105-120) with:

```solidity
    function finalizeEpoch(bytes32 categoryId, uint256 epoch) external nonReentrant {
        if (finalized[categoryId][epoch]) revert AlreadyFinalized();
        if (block.number < (epoch + 1) * EPOCH_BLOCKS) revert EpochNotEnded();

        uint256 rawPool = pool[categoryId][epoch];
        uint256 finalizerReward = (rawPool * FINALIZER_BPS) / BPS_DENOMINATOR;
        uint256 rollover;

        // Only roll over to the next epoch if it can still receive funds. If epoch+1 is already
        // finalized, its claimable pool is frozen, so a rollover would be permanently stranded —
        // retain it in THIS epoch's claimable pool instead. Conserves value in any finalize order.
        if (!finalized[categoryId][epoch + 1]) {
            rollover = (rawPool * ROLLOVER_BPS) / BPS_DENOMINATOR;
            pool[categoryId][epoch + 1] += rollover;
        }

        finalPool[categoryId][epoch] = rawPool - rollover - finalizerReward;
        finalized[categoryId][epoch] = true;

        emit EpochFinalized(categoryId, epoch, rawPool, finalPool[categoryId][epoch], rollover, finalizerReward, msg.sender);

        if (finalizerReward > 0) _sendValue(msg.sender, finalizerReward);
    }
```

- [ ] **Step 4: Run the new test + the full BonusDistributor suite**

Run: `cd contracts && forge test --match-contract BonusDistributorTest -vvv`
Expected: PASS — the new test passes AND the existing `test_FinalizeEpoch_Computes_Rollover_And_FinalizerReward` still passes (epoch 2 is not finalized in that test, so the normal rollover path is unchanged).

- [ ] **Step 5: Run the full contract suite (no regressions)**

Run: `cd contracts && forge test`
Expected: PASS — all tests green.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/BonusDistributor.sol contracts/test/BonusDistributor.t.sol
git commit -m "fix(bonus): retain rollover when next epoch already finalized (audit H1)

Out-of-order finalizeEpoch credited the rollover into an already-frozen,
already-finalized pool with no claim path. Now the rollover is retained in
the current epoch when the next is closed. Conserves value in any order.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2: Guard the CRPS domain against cube overflow (audit M1)

**Files:**
- Modify: `contracts/src/scorers/RangeCrpsScorer.sol:34-57`
- Test: `contracts/test/RangeCrpsScorer.t.sol`

- [ ] **Step 1: Write the failing tests**

Add these two tests to `contracts/test/RangeCrpsScorer.t.sol` (after `test_InvalidDomain_TooNarrow_Reverts`):

```solidity
    function test_DomainTooLarge_Reverts() public {
        // Domain ≳ 1e21 risks overflowing SCALE * (2D)^3 in the case-3 deduction.
        bytes memory hugeConfig = abi.encode(uint256(0), uint256(2e24));
        vm.expectRevert(RangeCrpsScorer.DomainTooLarge.selector);
        scorer.score(_pred(0, 1e23), _outcome(5e23), 0, hugeConfig);
    }

    function test_LargeSafeDomain_Scores_InBounds() public view {
        // AAVE-TVL-scale domain (1e17) must still score without reverting.
        bytes memory cfg = abi.encode(uint256(0), uint256(1e17));
        int256 s = scorer.score(_pred(4e16, 6e16), _outcome(5e16), 0, cfg);
        assertLe(s, int256(1_000_000), "score above SCORE_MAX");
        assertGe(s, int256(-1_000_000), "score below SCORE_MIN");
    }
```

- [ ] **Step 2: Run the tests to verify the first fails**

Run: `cd contracts && forge test --match-test "test_DomainTooLarge_Reverts|test_LargeSafeDomain_Scores_InBounds" -vvv`
Expected: `test_DomainTooLarge_Reverts` FAILS (no `DomainTooLarge` error exists yet — compile error or arithmetic panic, not the expected revert); `test_LargeSafeDomain_Scores_InBounds` may pass already (1e17 is in range).

- [ ] **Step 3: Implement the guard**

In `contracts/src/scorers/RangeCrpsScorer.sol`, add the constant + error near the other constants (after line 38):

```solidity
    /// @dev Upper bound on D = domainMax - domainMin. The case-3 deduction computes
    ///      SCALE * ((2D)^3-scale terms); with D ≤ 1e21 the largest intermediate
    ///      (SCALE * 16 * D^3 ≈ 1.6e70) stays far below 2^256, so no overflow/DoS.
    uint256 private constant MAX_DOMAIN = 1e21;
```

```solidity
    error DomainTooLarge();
```

Then in `score`, after computing `D` (line 55) and before `uint256 w = D / N;` (line 56), insert:

```solidity
        if (D > MAX_DOMAIN) revert DomainTooLarge();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd contracts && forge test --match-contract RangeCrpsScorerTest -vvv`
Expected: PASS — both new tests pass and all existing reference-vector/boundary/fuzz tests still pass (deployed domains 1e5/1e17/2e3 are all ≤ 1e21).

- [ ] **Step 5: Run the full contract suite**

Run: `cd contracts && forge test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contracts/src/scorers/RangeCrpsScorer.sol contracts/test/RangeCrpsScorer.t.sol
git commit -m "fix(scorer): reject oversized CRPS domains to prevent cube overflow (audit M1)

A category with domain >~1e21 would overflow SCALE*(2D)^3 in the in-band
deduction, reverting score() -> resolve() and stranding stake. Guarded with
MAX_DOMAIN=1e21 (deployed domains 1e5/1e17/2e3 are all safe).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Normalize the `0x` private-key prefix across all 4 bots (audit M2)

The recurring "private key missing 0x prefix → invalid private key at startup" foot-gun. Each bot config passes the raw env string straight to viem. Add a `requiredKey` helper that prefixes + length-checks.

**Files:**
- Modify: `agents/resolver/src/config.ts`, `agents/refresher/src/config.ts`, `agents/arima-baseline/src/config.ts`, `agents/claude-reasoner/src/config.ts`

- [ ] **Step 1: Add the helper + use it in the resolver config**

In `agents/resolver/src/config.ts`, after the `required` function (line 22), add:

```typescript
function requiredKey(name: string): Hex {
  const v = required(name);
  const k = v.startsWith("0x") ? v : `0x${v}`;
  if (k.length !== 66) {
    throw new Error(`${name} must be a 32-byte hex key (66 chars incl 0x); got length ${k.length}`);
  }
  return k as Hex;
}
```

Then change line 50 from:

```typescript
    privateKey: required("RESOLVER_PRIVATE_KEY") as Hex,
```

to:

```typescript
    privateKey: requiredKey("RESOLVER_PRIVATE_KEY"),
```

- [ ] **Step 2: Apply the identical helper + call change to the other three configs**

In each of `agents/refresher/src/config.ts`, `agents/arima-baseline/src/config.ts`, `agents/claude-reasoner/src/config.ts`:
1. Add the **same** `requiredKey` helper shown in Step 1 (right after that file's `required` function).
2. Find the private-key line — grep to locate the exact env var name:

Run: `grep -rn "PRIVATE_KEY.*as Hex\|required(.*PRIVATE_KEY" agents/refresher/src/config.ts agents/arima-baseline/src/config.ts agents/claude-reasoner/src/config.ts`

3. Replace each `required("<NAME>_PRIVATE_KEY") as Hex` with `requiredKey("<NAME>_PRIVATE_KEY")` (keep the exact env name from the grep — e.g. `REFRESHER_PRIVATE_KEY`, `CONTROLLER_PRIVATE_KEY`).

- [ ] **Step 3: Typecheck each package**

Run:
```bash
cd agents/resolver && npx tsc --noEmit && cd -
cd agents/refresher && npx tsc --noEmit && cd -
cd agents/arima-baseline && npx tsc --noEmit && cd -
cd agents/claude-reasoner && npx tsc --noEmit && cd -
```
Expected: each exits 0.

- [ ] **Step 4: Add the 0x guidance to the four `.env.example` files**

For each `agents/<bot>/.env.example`, find the `*_PRIVATE_KEY=` line and add a comment above it:

```
# Must include the 0x prefix (66 chars total). A bare 64-hex key now auto-prefixes, but include 0x to be safe.
```

- [ ] **Step 5: Commit**

```bash
git add agents/*/src/config.ts agents/*/.env.example
git commit -m "fix(bots): auto-normalize 0x private-key prefix + length-check (audit M2)

Recurring 'invalid private key' startup foot-gun: a bare 64-hex key now
auto-prefixes via requiredKey() with a 66-char guard. Applied to all 4 bots.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: Auto-reset the resolver cursor on redeploy (audit M2)

A stale `resolver.state.json` cursor from a previous deployment makes the resolver skip fresh predictions 1..N after a redeploy (the documented "empty leaderboard" poison). Key the cursor on the PredictionMarket address so a redeploy auto-resets it.

**Files:**
- Modify: `agents/resolver/src/state.ts`
- Modify: `agents/resolver/src/index.ts` (the `loadState()` call site)

- [ ] **Step 1: Update the state module**

Replace the entire contents of `agents/resolver/src/state.ts` with:

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const STATE_FILE = resolve(process.cwd(), "resolver.state.json");

export interface ResolverState {
  /// Lowest predictionId not yet known to be in a terminal state.
  cursor: number;
  /// PredictionMarket address this cursor is valid for. On a redeploy the address
  /// changes, so a stale cursor is discarded instead of skipping fresh predictions.
  deployment: string;
}

export function loadState(deployment: string): ResolverState {
  if (existsSync(STATE_FILE)) {
    try {
      const s = JSON.parse(readFileSync(STATE_FILE, "utf8")) as ResolverState;
      if (
        typeof s.cursor === "number" &&
        s.cursor >= 1 &&
        typeof s.deployment === "string" &&
        s.deployment.toLowerCase() === deployment.toLowerCase()
      ) {
        return s;
      }
    } catch {
      /* fall through to default */
    }
  }
  return { cursor: 1, deployment };
}

export function saveState(state: ResolverState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
```

- [ ] **Step 2: Update the call site**

Run: `grep -n "loadState\|saveState" agents/resolver/src/index.ts`

Change the `loadState()` call to pass the PredictionMarket address from config — i.e. `loadState(config.predictionMarket)` (use whatever the config variable is named in that file; it is the `predictionMarket: Hex` field from `ResolverConfig`). `saveState(state)` is unchanged (the `deployment` field rides along on the `state` object).

- [ ] **Step 3: Typecheck**

Run: `cd agents/resolver && npx tsc --noEmit`
Expected: exit 0. (If it errors on the `loadState()` arity, the call site wasn't updated — fix Step 2.)

- [ ] **Step 4: Commit**

```bash
git add agents/resolver/src/state.ts agents/resolver/src/index.ts
git commit -m "fix(resolver): key cursor on PredictionMarket address; auto-reset on redeploy (audit M2)

A stale resolver.state.json cursor from a prior deploy skipped fresh predictions
1..N after a redeploy. The cursor now carries the deployment address and resets
when it changes. (Agent state files are a follow-up; same pattern applies.)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> **Follow-up (not in this task):** `agents/arima-baseline/src/state.ts` and `agents/claude-reasoner/src/state.ts` (`agent.state.json`, fields `{mode, seedStartTimestamp}`) have the same stale-across-redeploy hazard. Apply the identical address-keying pattern after reading those files. Until then, the operational rule stands: `rm agents/resolver/resolver.state.json agents/*/agent.state.json` after every redeploy (see runbook).

---

## Phase 2 — Documentation reconciliation

### Task 5: Reconcile PRD §7.2.4 to the contract + document the stake==msg.value choice (audit M4, L1)

**Files:**
- Modify: `docs/PRD.md` (§7.2.4 finalizeEpoch pseudocode, ~lines 338-356)
- Modify: `contracts/src/PredictionMarket.sol` (NatSpec on `commit`)

- [ ] **Step 1: Fix the PRD finalizeEpoch pseudocode**

In `docs/PRD.md` §7.2.4, the current pseudocode (≈lines 338-344) reads:

```
finalizeEpoch(categoryId, epoch):
  rollover           = pool[categoryId][epoch] × 0.05
  finalPool          = pool[categoryId][epoch] - rollover
  ...
  pool[categoryId][epoch+1] += rollover
  finalized[categoryId][epoch] = true
```

and the note (≈line 356) says the finalizer is paid "0.5% of `finalPool` ... deducted from finalPool before claim math." Replace that block + note to match the **deployed contract** (both deductions off the raw pool, and rollover skipped when the next epoch is already finalized):

```
finalizeEpoch(categoryId, epoch):
  rawPool            = pool[categoryId][epoch]
  finalizerReward    = rawPool × 0.005            # 0.5% of the RAW pool
  rollover           = (next epoch not yet finalized) ? rawPool × 0.05 : 0   # 5% of the RAW pool
  finalPool          = rawPool - rollover - finalizerReward
  pool[categoryId][epoch+1] += rollover
  finalized[categoryId][epoch] = true
```

And update the prose note to: "`finalizeEpoch` callable by anyone; pays caller 0.5% of the **raw** epoch pool as a gas reward. The 5% rollover seeds the next epoch — unless that epoch is already finalized, in which case the rollover is retained in this epoch's claimable pool (no stranding)."

- [ ] **Step 2: Document the stake==msg.value choice in PredictionMarket**

In `contracts/src/PredictionMarket.sol`, add a NatSpec line to the `commit` function (above the `function commit(...)` signature, ~line 116) making the intent explicit:

```solidity
    /// @dev The escrowed stake equals `msg.value` in full — there is no maximum and no surplus
    ///      refund. Callers stake exactly what they send; any amount above `minStake` is
    ///      intentional additional collateral (and additional slash risk on a poor score).
```

- [ ] **Step 3: Verify the contract still builds (NatSpec-only change)**

Run: `cd contracts && forge build`
Expected: compiles clean.

- [ ] **Step 4: Commit**

```bash
git add docs/PRD.md contracts/src/PredictionMarket.sol
git commit -m "docs: reconcile PRD 7.2.4 finalize math to contract; document stake==msg.value (audit M4, L1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Final verification

### Task 6: Full-suite green check

- [ ] **Step 1: Contracts**

Run: `cd contracts && forge test`
Expected: PASS — all tests, including the two new ones (rollover out-of-order, domain guard).

- [ ] **Step 2: Bots typecheck**

Run: `for d in resolver refresher arima-baseline claude-reasoner; do (cd agents/$d && npx tsc --noEmit && echo "$d OK"); done`
Expected: all four print `OK`.

- [ ] **Step 3: Reasoner unit tests still pass (it has vitest)**

Run: `cd agents/claude-reasoner && npx vitest run`
Expected: PASS (the key-normalization change doesn't touch forecast parsing).

---

## Operational Runbook (credential-gated — run, don't TDD)

These resolve the audit's must-do items that need keys/RPC/hosting and cannot be unit-tested. Run in this order before submission.

**R1 — Verify the 17 contracts (audit H6).** Highest credibility-per-hour.
```bash
# Etherscan API V2 (preferred) — needs an Etherscan V2 API key:
cd contracts
export ETHERSCAN_API_KEY=<v2-key>
forge verify-contract --chain-id 5003 \
  --verifier-url https://api.etherscan.io/v2/api \
  <address> <src/Path.sol:Contract> --watch
# ...repeat per contract in deployments/mantle-sepolia.json (17 total)
# Fallback: Sourcify
forge verify-contract --chain-id 5003 --verifier sourcify <address> <src/Path.sol:Contract>
```

**R2 — Grow resolvedCount ≥10/category, then re-snapshot (audit C1 + C2).** USDY is now in the refresher (commit `65bdf74`).
```bash
# 0. After any redeploy ONLY: rm stale state so cursors/seed-mode reset.
rm -f agents/resolver/resolver.state.json agents/*/agent.state.json
# 1. Burst-run the pipeline against a PAYG RPC (not free tier) with the machine kept awake.
#    Run bots via compiled dist + node (NOT pnpm) with ABSOLUTE log paths, e.g.:
#    cd /abs/agents/resolver && node dist/index.js > /abs/logs/resolver.log 2>&1
#    Run arima, reasoner, resolver, refresher until ≥10 resolved per category.
# 2. Stop the bots (data persists on-chain + in the indexer).
# 3. Regenerate BOTH snapshots against the SAME RPC, then git diff to confirm both moved:
cd frontend
CHAIN_RPC=<payg-rpc> pnpm --filter frontend gen:fallback
SNAPSHOT_RPC_URL=<payg-rpc> pnpm --filter frontend gen:insights
git diff --stat public/fallback-leaderboard.json public/insights-snapshot.json
```
Verify after: `grep -c '"calibrationScore": 0' public/*.json` should drop, and `resolvedCount` values should be ≥10.

**R3 — Ship Vercel with the live indexer OFF (audit M2/C1).** Set the production build to NOT define `NEXT_PUBLIC_INDEXER_URL` (or set it empty), so the frontend reads the committed snapshot/mock deterministically with no flaky live fetch at the booth.

**R4 — Bake the hero reasoning trace (audit M2 ops).** Pre-generate one USDY reasoner forecast → resolve → IPFS-pin the trace (needs `OPENROUTER_API_KEY` + `PINATA_JWT`), and reference the pinned CID in the demo. Do NOT generate the trace live at the booth.

**R5 (future code pass) — Cached tier for `useFeedHistory` + `useSmartMoneyBands`.** Read `frontend/src/lib/hooks.ts`, mirror the existing live→cached→mock tier that `useLeaderboard` already implements (with the "Showing cached data" banner) so these two hooks stop silently serving unlabeled mock on a live failure. Needs its own read-first pass; not specified here to avoid guessing at the hook's shape.

---

## Self-Review

- **Spec coverage:** Audit §9 must-do → R1 (verify), C2 (done, committed), R2 (grow+snapshot). Should-do → R3 (Vercel), R4 (trace), Task 3/4 (re-run enablers), R5 (cached tier, deferred-with-pointer). Nice-to-have → Task 1 (H1), Task 2 (M1), Task 3+4 (M2), Task 5 (M4+L1). Framing → audit §7 (no code). All code-actionable items are covered; credential-gated items are in the runbook; the one un-read surface (hooks.ts) is an explicit read-first follow-up, not a guessed code task.
- **Placeholder scan:** No "TBD/TODO". Every code step shows complete code; every command shows expected output. Task 3 Step 2 and Task 4 Step 2 use `grep` to locate exact env names / call sites (the helper/state code itself is fully shown) — this is read-to-locate, not a placeholder.
- **Type consistency:** `requiredKey(name): Hex` used identically in Task 3 across all four configs; `loadState(deployment: string)` / `ResolverState { cursor, deployment }` consistent between Task 4 Steps 1–2; `MAX_DOMAIN`/`DomainTooLarge` and the `finalizeEpoch` rollover variable names match between the impl and the tests.
- **Verification:** Every code task ends in a `forge test` / `tsc --noEmit` gate; Phase 3 re-runs the full suites.
