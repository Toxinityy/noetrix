# Agent Swarm — Plan 6: Frontend Wiring + Live-Agent Runtime + Going Live

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ FRONTEND CAVEAT:** `frontend/AGENTS.md` says this is a non-standard Next.js with breaking changes. **Before editing ANY file under `frontend/`, read the relevant guide in `frontend/node_modules/next/dist/docs/`.** Match the existing component patterns exactly.

**Goal:** Make the swarm + stress visible and the agents real. (1) Surface swarm-agreement %, stress level, and Fear&Greed on `/insights`, wire the real `StressWarning` into `AlertPreview`, connect `/simulation` to the real swarm/stress math, and add a backtest view — propagating the new `disagreementBps` feed field through the snapshot + viem decoders. (2) Refactor `arima`/`naive` onto the shared `forecasters` lib with confidence-from-width (kill the fixed 5000). (3) `SeedFromReal.s.sol` seeds oracles from the committed real data. (4) A going-live ops checklist (your keys).

**Architecture:** Snapshot-first frontend (build-time `gen-insights-snapshot.ts` → committed JSON; live viem reads where available). The new on-chain reads are `CompositeFeed.read().disagreementBps`, `MarketStressMonitor.stressLevel(catId)`, and `SentimentOracle.latest()`. The agent runtime becomes a thin runner over `@predictor-index/forecasters`.

**Tech Stack:** Next.js (non-standard — read its docs), TypeScript, viem, Vitest, Playwright; Solidity (seed script).

**Spec:** `docs/superpowers/specs/2026-06-09-agent-swarm-confidence-stress-design.md` §3/§4/§9.

**Verified context:** `SnapCategory = {reputations, predictions, feedHistory, risk}` (frontend/src/lib/snapshot.ts). `InsightsSnapshot.categories: Record<CategoryId, SnapCategory>`. `/api/feed/route.ts` decodes `CompositeForecast{value, confidence, contributingAgents, lastUpdatedBlock}` — now also `disagreementBps`. `agents/arima-baseline/src/index.ts` has `const CONFIDENCE_BPS = 5000` + `submitFullCycle`; same in `naive-baseline`. New addresses (from Plan 5 Deploy serialization): `SentimentOracle`, `MarketStressMonitor`.

**Scope:** Plan 6 of 6 — the finale. Tasks 1–8 build + test with no keys; Task 9 is the going-live ops checklist (needs funded keys/RPC). The 4 new live strategy runners (mean-rev/momentum/ewma/sentiment) are listed in the ops checklist since each needs a funded hot wallet — their forecasting logic already exists in `forecasters`.

---

## Task 1: Propagate `disagreementBps` through the feed ABI + `/api/feed`

**Files:**
- Modify: `frontend/src/lib/contracts.ts` (the `read` ABI output tuple)
- Modify: `frontend/src/app/api/feed/route.ts` (decode the new field)

- [ ] **Step 1: Read the Next docs + the two files**

Read `frontend/AGENTS.md` and the relevant `frontend/node_modules/next/dist/docs/` guide for API routes. Read `frontend/src/lib/contracts.ts` (find the `compositeFeedAbi` `read` function) and `frontend/src/app/api/feed/route.ts`.

- [ ] **Step 2: Add `disagreementBps` to the `read` ABI output**

In `frontend/src/lib/contracts.ts`, the `read(bytes32)` function's `outputs` is a tuple of components `{value: bytes, confidence: uint16, contributingAgents: uint256, lastUpdatedBlock: uint256}`. **Append** a fifth component `{ name: "disagreementBps", type: "uint32" }` to that tuple's `components` array (matching the Solidity struct order — appended last).

- [ ] **Step 3: Decode + return `disagreementBps` in `/api/feed`**

In `frontend/src/app/api/feed/route.ts`, where the response object is built from `res` (the decoded `CompositeForecast`), add `disagreementBps: Number(res.disagreementBps)` to the returned JSON. (It's ≤ 10000, safe as a Number.) Keep the existing CORS `*` + `BigInt(0)`-not-`0n` conventions.

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter frontend typecheck` (or `tsc --noEmit` per the repo's script)
Expected: exit 0.
Run: `pnpm --filter frontend build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/contracts.ts frontend/src/app/api/feed/route.ts
git commit -m "feat(web): decode disagreementBps from the CompositeFeed read (struct append)"
```

---

## Task 2: Add swarm + stress fields to the insights snapshot

**Files:**
- Modify: `frontend/src/lib/snapshot.ts` (extend `SnapCategory`)
- Modify: `frontend/scripts/gen-insights-snapshot.ts` (read the new on-chain values)

- [ ] **Step 1: Extend `SnapCategory` in `frontend/src/lib/snapshot.ts`**

Add these optional fields to the `SnapCategory` interface (optional so older snapshots + mock still render):

```ts
  /// Swarm-agreement % (100 − disagreement%); null when the feed has no swarm data.
  swarmAgreementPct: number | null;
  disagreementBps: number | null;
  /// On-chain market-stress level + the latest Fear & Greed index (0–100).
  stress: "Calm" | "Elevated" | "Stressed" | null;
  fearGreed: number | null;
```

- [ ] **Step 2: Populate them in `gen-insights-snapshot.ts`**

Read `frontend/scripts/gen-insights-snapshot.ts`. It already reads `CompositeFeed` + `RiskManager` per category via viem. Add reads for the new values and write them into each `SnapCategory`:
- `disagreementBps` from `CompositeFeed.read(catId).disagreementBps`; `swarmAgreementPct = disagreementBps == null ? null : Math.round(100 - disagreementBps / 100)`.
- `stress` from `MarketStressMonitor.stressLevel(catId)` (returns `(uint8 level, uint256 reasons)`; map `0→"Calm", 1→"Elevated", 2→"Stressed"`). Use the `MarketStressMonitor` address from the deployments JSON; if absent, set `stress: null`.
- `fearGreed` from `SentimentOracle.latest()` (returns `(uint8 value, uint256 updatedBlock)`); if the oracle address is absent, `null`.
Guard each read in try/catch so a missing/old deployment yields `null` (snapshot still generates). Add the minimal ABIs for `MarketStressMonitor.stressLevel` + `SentimentOracle.latest` to the script.

- [ ] **Step 3: Regenerate the snapshot if a live deployment is configured; else leave the committed mock-shaped snapshot**

If `NEXT_PUBLIC_*` addresses + RPC are set, run the gen script. Otherwise (no live deployment in this environment) just ensure the schema compiles — the new fields are optional and default to `null` in the committed snapshot. Update the committed `frontend/public/insights-snapshot.json` to include the new keys with `null` values per category (so the type matches), via a small edit or a `gen` run.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter frontend typecheck`
Expected: exit 0 (the new optional fields don't break existing consumers).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/snapshot.ts frontend/scripts/gen-insights-snapshot.ts frontend/public/insights-snapshot.json
git commit -m "feat(web): snapshot carries swarm-agreement %, disagreement, stress level + Fear&Greed"
```

---

## Task 3: Surface swarm agreement % + stress + F&G on `/insights`

**Files:**
- Modify: `frontend/src/app/(app)/insights/YourMoveStrip.tsx`

- [ ] **Step 1: Read the component + the Next docs**

Read `frontend/src/app/(app)/insights/YourMoveStrip.tsx` and the relevant Next doc. It already renders a risk pill + allocation bar from the snapshot `data`.

- [ ] **Step 2: Add a swarm/stress cell**

Add a cell to `YourMoveStrip` showing: **Swarm agreement** `{swarmAgreementPct ?? "—"}%`, a **Stress** pill (`Calm` green / `Elevated` amber / `Stressed` red) from `data...stress`, and **Fear & Greed** `{fearGreed ?? "—"}` with a fear/greed label. Pull these from the `SnapCategory` (the hook `useInsightsData` already returns the category). When a field is `null`, show `—` + a "calibrating / not monitored" caption. Match the existing pill/Panel styling (no new design system). Keep it accessible (sr-only text for the pills).

- [ ] **Step 3: Typecheck + build + e2e**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build`
Expected: green.
Run: `pnpm --filter frontend test:e2e` (the responsive 375px suite includes `/insights`)
Expected: pass (no horizontal overflow).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(app)/insights/YourMoveStrip.tsx
git commit -m "feat(web): /insights shows swarm agreement %, stress level, and Fear&Greed"
```

---

## Task 4: Real stress in `AlertPreview`

**Files:**
- Modify: `frontend/src/app/(app)/insights/AnomalyFeed.tsx`

- [ ] **Step 1: Read the component**

Read `frontend/src/app/(app)/insights/AnomalyFeed.tsx` (it has the `AlertPreview` Telegram/Discord mock with a hardcoded `text` prop).

- [ ] **Step 2: Drive the alert text from the real stress level**

Where `AlertPreview` is rendered, compose its `text` from the category's `stress` + `swarmAgreementPct` + `fearGreed` (e.g., `"⚠️ <CATEGORY> Stressed — swarm agreement 62%, Fear&Greed 22 (extreme fear)"` for Stressed; a calmer line for Calm/Elevated; "calibrating" when `stress == null`). Keep it a preview (no real bot) but make the content reflect the on-chain signal, not a static string.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/(app)/insights/AnomalyFeed.tsx
git commit -m "feat(web): AlertPreview reflects the real on-chain stress signal"
```

---

## Task 5: `/simulation` slider → real swarm/stress mirror

**Files:**
- Modify: `frontend/src/lib/rwaSim.ts`
- Test: `frontend/src/lib/rwaSim.test.ts` (extend, if it exists)

- [ ] **Step 1: Read `rwaSim.ts` + its test**

Read `frontend/src/lib/rwaSim.ts` (`simulateMarket(stress, base)`) and any `rwaSim.test.ts`. It currently penalizes confidence by stress and flips a risk state.

- [ ] **Step 2: Mirror the 3-source stress classification**

Add a `simulateStress(stress, base)` (or extend `simulateMarket`) that maps the slider to the same {Calm/Elevated/Stressed} bands the on-chain Monitor uses — as the slider rises, disagreement + (simulated) surprise + fear cross the Elevated then Stressed thresholds, mirroring `agents/backtest/src/stress.ts` semantics (a JS-number mirror is fine here; it's a UI simulation, but the level labels + ordering must match the contract). Return the stress level alongside the existing allocation/confidence so the slider visibly drives Calm→Elevated→Stressed.

- [ ] **Step 3: Add/extend tests**

Add vitest assertions: slider at 0 → Calm; mid → Elevated; high → Stressed; and that the level is monotone non-decreasing in the slider. Run: `pnpm --filter frontend test rwaSim`
Expected: PASS.

- [ ] **Step 4: Wire it into the `/simulation` UI (RwaClient)**

Read `frontend/src/app/(app)/simulation/RwaClient.tsx` (+ Next doc) and show the simulated stress level/pill driven by the slider, next to the allocation/safety badge.

- [ ] **Step 5: Typecheck + build + e2e**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build && pnpm --filter frontend test:e2e`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/rwaSim.ts frontend/src/lib/rwaSim.test.ts frontend/src/app/(app)/simulation/RwaClient.tsx
git commit -m "feat(web): /simulation slider drives the real Calm→Elevated→Stressed levels"
```

---

## Task 6: Backtest view (reads `backtest-snapshot.json`)

**Files:**
- Create: `frontend/src/app/(app)/insights/BacktestPanel.tsx`
- Modify: the `/insights` page to mount it (read the page file first)

- [ ] **Step 1: Read the Next docs + the insights page + the snapshot shape**

Read the relevant Next doc, `frontend/public/backtest-snapshot.json` (the shape from Plan 3: `{generatedAt, categories:[{metric, disagreeScale, trainSteps, testSteps, agents:[{label,accuracy,calibration,resolved,meanScore}], correlation:{keys,matrix}, stressTimeline:[...]}]}`), and the `/insights` page component.

- [ ] **Step 2: Create `BacktestPanel.tsx`**

A client component that fetches `/backtest-snapshot.json` (static public asset) and renders, per category: the per-agent leaderboard (accuracy/calibration/resolved/mean test score), a compact correlation heatmap (the diversity proof), and a stress-distribution summary (Calm/Elevated/Stressed counts from `stressTimeline`). Include an honesty caption ("real DefiLlama data; recent Aave/USDY windows were genuinely fearful; correlations are moderate — simple models on the same series are partly correlated"). Match the terminal-core Panel styling. Handle the fetch-missing case with an EmptyState. Keep numbers safe (all bounded).

- [ ] **Step 3: Mount it on `/insights`**

Add `<BacktestPanel />` to the `/insights` page (below the existing grid). Follow the page's existing section pattern.

- [ ] **Step 4: Typecheck + build + e2e**

Run: `pnpm --filter frontend typecheck && pnpm --filter frontend build && pnpm --filter frontend test:e2e`
Expected: green (`/insights` still no 375px overflow).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(app)/insights/BacktestPanel.tsx frontend/src/app/(app)/insights
git commit -m "feat(web): backtest panel — per-agent leaderboard, diversity heatmap, stress distribution"
```

---

## Task 7: Live-agent runtime — real confidence from band width

**Files:**
- Modify: `agents/arima-baseline/package.json`, `agents/arima-baseline/src/index.ts`
- Modify: `agents/naive-baseline/package.json`, `agents/naive-baseline/src/index.ts`

- [ ] **Step 1: Add the forecasters dep to both agents**

In each agent's `package.json`, add `"@predictor-index/forecasters": "workspace:*"` to dependencies. Run `pnpm install`.

- [ ] **Step 2: Replace fixed confidence with confidence-from-width (arima)**

Read `agents/arima-baseline/src/index.ts`. It computes `forecast = arima111(series, 1)` then submits with `CONFIDENCE_BPS = 5000`. Replace the fixed confidence: import `confidenceFromWidth` from `@predictor-index/forecasters`, and compute `const confidence = confidenceFromWidth(low, high, domainMin, domainMax)` using the clamped band `[low, high]` and the category domain (from `getCategoryConfig`/the SDK category). Pass that `confidence` to `submitFullCycle` instead of `CONFIDENCE_BPS`. Remove the `const CONFIDENCE_BPS = 5000`. Keep the ARIMA forecast logic as-is (it already lives in `forecasters` too, but the live agent may keep its local `arima111` import — the goal here is real confidence, not a forecast change).

- [ ] **Step 3: Same for naive-baseline**

Apply the identical change in `agents/naive-baseline/src/index.ts` (replace `CONFIDENCE_BPS = 5000` with `confidenceFromWidth(low, high, domainMin, domainMax)`).

- [ ] **Step 4: Typecheck both agents**

Run: `pnpm --filter @predictor-index/arima-baseline build && pnpm --filter @predictor-index/naive-baseline build`
Expected: both `tsc` clean, dist emitted.

- [ ] **Step 5: Commit**

```bash
git add agents/arima-baseline agents/naive-baseline pnpm-lock.yaml
git commit -m "feat(agents): arima+naive emit confidence-from-width (replace fixed 5000)"
```

---

## Task 8: `SeedFromReal.s.sol` — seed oracles from real data

**Files:**
- Create: `contracts/script/SeedFromReal.s.sol`
- Modify: `contracts/foundry.toml` (read access to the market-data dir, if not already broad)

- [ ] **Step 1: Read `Deploy.s.sol` + a snapshot of the real data shape**

Read `contracts/script/Deploy.s.sol` (how it references the oracles + addresses), and the shape of `agents/market-data/data/METH_APR.json` / `FEAR_GREED.json` (`{metric, unit, points:[{ts, value}], ...}`).

- [ ] **Step 2: Create `contracts/script/SeedFromReal.s.sol`**

A forge script that: reads the latest `FEAR_GREED` value and calls `SentimentOracle.setFearGreed(latest)`; and (best-effort, documented) sets the mETH/USDY oracle synthetic curves so the resolved APR matches the latest real bps (the oracles already use a synthetic curve covering any block — set the daily-growth ppm so `resolvedAprBps ≈ latestRealBps` via `ppm ≈ latestBps / 3.65`). Read addresses from `deployments/<network>.json`. Reading the JSON values: use `vm.readFile` + `vm.parseJson*` on the committed `agents/market-data/data/*.json` (add read fs_permission for that path). Keep it idempotent + documented as the bridge to real data.

- [ ] **Step 3: Dry-run the seed script**

Run: `cd contracts && forge script script/SeedFromReal.s.sol:SeedFromReal --sig "run()" 2>&1 | tail -10`
Expected: simulation succeeds (reads the JSON, computes the values; on a fresh anvil with no prior deploy it may no-op gracefully — document that it requires the deployments JSON).

- [ ] **Step 4: Commit**

```bash
git add contracts/script/SeedFromReal.s.sol contracts/foundry.toml
git commit -m "feat(deploy): SeedFromReal — seed Fear&Greed + oracle curves from committed real data"
```

---

## Task 9: Full verification + going-live ops checklist

**Files:**
- Create: `docs/GOING_LIVE.md`

- [ ] **Step 1: Full verification across all packages**

Run (report each):
- `pnpm --filter @predictor-index/forecasters test` (53)
- `pnpm --filter @predictor-index/market-data test` (20)
- `pnpm --filter @predictor-index/backtest test` (32)
- `pnpm --filter frontend typecheck && pnpm --filter frontend build && pnpm --filter frontend test:e2e`
- `cd contracts && forge test` (191+) `&& forge script script/Deploy.s.sol:Deploy --sig "run()"` (dry-run clean)
Expected: all green.

- [ ] **Step 2: Write `docs/GOING_LIVE.md` — the ops checklist (needs your keys)**

Document the live sequence (each step + the exact command), since these need funded keys/RPC and can't run in CI:
1. `forge script script/Deploy.s.sol:Deploy --rpc-url $MANTLE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast --verify` → writes new addresses (incl. SentimentOracle + MarketStressMonitor) to `deployments/mantle-sepolia.json`.
2. Set `frontend/.env` `NEXT_PUBLIC_*` (incl. the new Monitor + Oracle addresses) + rebuild.
3. `forge script script/SeedFromReal.s.sol:SeedFromReal --broadcast` → seed F&G + oracle curves from real data.
4. Register + run the 7 agents (each needs a small funded hot wallet — NOT the deployer): the 3 existing (`arima`, `naive`, `deepseek`) + **4 new thin runners** (mean-reversion, momentum, ewma-vol, sentiment) that import the matching `forecasters` strategy and submit via the SDK exactly like `arima-baseline`. Aim to clear `MIN_SWARM=3` so the feed isn't quorum-capped.
5. Run `resolver` + `refresher` bots; add a keeper that periodically calls `SentimentOracle.setFearGreed(<real F&G>)` and `MarketStressMonitor.poke(catId)`.
6. Once ≥ a few resolved predictions/category exist, run `pnpm --filter @predictor-index/backtest run:backtest` (refreshes snapshots) and `pnpm --filter frontend gen:insights` (live snapshot), then redeploy the frontend.
7. Verify contracts on Etherscan V2.

- [ ] **Step 3: Commit**

```bash
git add docs/GOING_LIVE.md
git commit -m "docs: going-live ops checklist (deploy, seed, run 7-agent swarm, keeper)"
```

---

## Self-Review (completed by plan author)

- **Spec coverage (§3/§4/§9):** snapshot + viem propagation of `disagreementBps` (Tasks 1–2); `/insights` swarm-agreement % + stress + F&G (Task 3); real `AlertPreview` from the on-chain stress (Task 4); `/simulation` mirrors the real Calm→Elevated→Stressed levels (Task 5); backtest view with the diversity heatmap + honest captions (Task 6); live-agent real confidence-from-width (Task 7); `SeedFromReal` (Task 8); the going-live ops sequence incl. the 4 new live runners + keeper (Task 9).
- **Non-standard Next.js:** every frontend task starts by reading `frontend/node_modules/next/dist/docs/` + the existing component, per `frontend/AGENTS.md`.
- **Safety:** all new frontend numbers are bounded (≤10000 / ≤100) → safe as `Number`; struct field appended last (ABI-safe); snapshot fields optional (mock/older snapshots still render).
- **Placeholder note:** the frontend component tasks are precise integrations into existing components (the implementer reads each + the Next docs); the schema/ABI/agent/seed code is complete. The 4 new live runners are deferred to the ops checklist because each needs a funded hot wallet — their forecasting logic already exists in `forecasters`.
