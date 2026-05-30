# Design: AI x RWA pivot — yield + risk features and a Web2 onboarding surface

**Date:** 2026-05-30
**Status:** Approved (design); pending implementation plan

## Context

The Turing Test Hackathon tracks were redefined after this project's PRD was written. Our original
target, **AI Alpha & Data**, was recast to mean *smart-money tracking + on-chain anomaly detection
bots via Telegram/Discord* — which our project does not do. The closest literal match now is:

> **AI x RWA** — Dynamic yield strategies and automated risk management for assets including USDY
> and mETH, built on Mantle's RWA infrastructure.

Our existing build already forecasts **mETH APR** and exposes a basic risk-gating consumer, so the
fit is strong. This design pivots the project's framing to AI x RWA and adds features that map
directly to the track's language ("dynamic yield strategies", "automated risk management",
"assets including USDY and mETH").

A **second award** is also in scope: **Best User Experience / Smoothest Onboarding for Web2 Users**.
The existing app is intentionally "terminal-core" (hashes, bps, `0x…`, commit-reveal) — hostile to
non-crypto users. So the new RWA surface is designed as a *separate, deliberately Web2-friendly*
page aimed at converting traditional users.

The core protocol (13 contracts) is deployed + proven live end-to-end on Mantle Sepolia
(register → commit → reveal → resolve → CRPS score → reputation → leaderboard, confirmed
2026-05-30). These features extend it; they do not change the proven core.

**Intended outcome:** a submission that fits AI x RWA literally and competes for the Web2 UX award,
with most of the heavy protocol work already done and verified.

## Goals / Non-goals

**Goals**
- Add **USDY** (Ondo's yield-bearing RWA stablecoin, live on Mantle) as a forecast category.
- Ship a **dynamic yield-strategy** contract (allocation across mETH + USDY).
- Ship an **automated risk-management** contract (per-asset risk params from forecasts).
- Ship a **Web2-friendly `/rwa` page** with an interactive deposit simulator, no wallet required.
- Reframe docs (README, SUBMISSION, CLAUDE.md) to AI x RWA.

**Non-goals (YAGNI / honest scope)**
- No custody / no real fund movement — all consumer contracts are advisory (read-only views). A real
  vault would embed them; building custody is out of hackathon scope.
- No wallet, login, or auth on `/rwa` — explicitly avoided for the Web2 audience.
- No new scorer (RangeCrpsScorer is reused for the new category — just a new domain).
- No re-theming of the existing terminal-core app; `/rwa` is an additive, separate surface.

## Architecture overview

```
            agents (arima + reasoner) forecast 3 categories
                 mETH APR · USDY APY · Aave-Mantle TVL
                              │
                     PredictionMarket → ResolutionEngine
                       ↓ (UsdyApyResolver added)
                     ScoringEngine → CompositeFeed
                              │ read()
        ┌─────────────────────┼──────────────────────┐
   YieldAllocator        RiskManager           DemoFeedConsumer (existing)
   (yield strategy)   (risk management)
        └─────────────────────┬──────────────────────┘
                       /rwa Web2 page
              (simulator reads feed values, computes
               projected yield/allocation/risk client-side)
```

Dependency order for build: **USDY category → YieldAllocator + RiskManager → /rwa page**.

## Feature 1 — USDY yield category (data layer)

Mirrors the proven mETH pattern (validated live today), lowest risk.

- New category label `USDY_APY_24H`, domain `[0, 2000]` bps (~0–20% APY; USDY realistically ~5%).
- **`contracts/src/resolvers/UsdyApyResolver.sol`** — structural copy of `MethAprResolver.sol`:
  annualizes a price-per-share delta over `BLOCKS_PER_DAY` (43200). Same edge-case clamps
  (prior==0 or now<=prior → 0).
- **USDY oracle** — reuse the `MockMethRateOracle` synthetic-curve design (a second instance, or a
  generic mock) so it resolves at any block. Seed in `Deploy.s.sol` with a growth ppm tuned to
  ~500 bps APY. Keep the override-table + revert-on-unset behavior intact.
- **`RangeCrpsScorer`** reused as-is (new domain only).
- Register the category on both `ResolutionEngine` and `PredictionMarket` in `Deploy.s.sol`.
- Add one category-config entry to **both** agents (`agents/arima-baseline/src/config.ts`,
  `agents/claude-reasoner/src/config.ts`) so they forecast USDY (synthetic seed center ~500 bps for
  ARIMA; description + news currencies for the reasoner). Few-shot examples optional (reasoner
  degrades gracefully with none).
- Indexer needs no change (category-agnostic).

**Verification:** `cast call UsdyApyResolver.resolve(0x, <block>)` returns ~500 bps at an arbitrary
block (same check that proved the mETH resolver). Full forge suite stays green.

## Feature 2 — YieldAllocator (dynamic yield strategy)

**`contracts/src/examples/YieldAllocator.sol`** — advisory consumer, read-only.

- Reads `feed.read(METH_APR_24H)` and `feed.read(USDY_APY_24H)` via `ICompositeFeed`.
- **Confidence-weighted effective yield** per asset: `eff = forecastYield × confidence / 10000`.
  Penalizes uncertain forecasts so the strategy doesn't chase a high-but-shaky number.
- **Target allocation (bps, sums to 10000):** `allocMeth = effMeth × 10000 / (effMeth + effUsdy)`,
  remainder to USDY.
- **Safety fallbacks:** if either feed is stale (reuse the `valueFresh` staleness pattern from
  `DemoFeedConsumer`) or both effective yields ≈ 0 → return a 50/50 default rather than reverting.
- Views:
  - `getAllocation() → (allocMethBps, allocUsdyBps, methYield, usdyYield)`
  - `rebalanceSignal() → bool` — true if current allocation drifts > `REBALANCE_THRESHOLD_BPS`
    from a stored baseline (the trigger a vault would act on). Baseline set by an owner-only
    `snapshotBaseline()` (or constructor default 50/50).
- Thresholds as public constants. Wired in `Deploy.s.sol`.

**Verification:** unit test with mocked feed values (e.g. mETH 3000 bps @ conf 9000, USDY 500 bps
@ conf 9000 → mETH-heavy allocation); stale-feed → 50/50 fallback. Live `cast call getAllocation()`
after deploy.

## Feature 3 — RiskManager (automated risk management)

**`contracts/src/examples/RiskManager.sol`** — single shared manager keyed by `categoryId`,
advisory, read-only.

- Per asset (mETH, USDY — extensible by categoryId), derived from forecast value + confidence +
  freshness:
  - `collateralFactor(categoryId) → bps`: `baseCf × confidence / 10000`, clamped to
    `[FLOOR_CF, BASE_CF]`. Confident forecast → near-full factor; shaky → conservative.
  - `depositCap(categoryId) → uint`: `MAX_CAP × confidence / 10000` (low confidence → tighter cap).
  - `riskState(categoryId) → enum {Normal, Caution, Frozen}`: `Frozen` if stale or confidence below
    a hard floor; `Caution` if confidence mid-band; else `Normal`.
  - `isPaused(categoryId) → bool` = `riskState == Frozen`. Stale/no-data → paused (safe default,
    matching the existing consumer's philosophy).
- Asset registry: owner registers `(categoryId → {baseCf, maxCap})` so it's generic across assets.
- Thresholds/policy as public constants. Wired in `Deploy.s.sol`.

**Verification:** unit tests across confidence bands (high → Normal + high CF; mid → Caution; stale
→ Frozen + paused + zero cap). Live `cast call` per asset after deploy.

## Feature 4 — /rwa Web2 onboarding surface

A **separate, deliberately Web2-friendly** route in the existing `(app)` group. NOT terminal-core.
Targets the Best UX / Smoothest Web2 Onboarding award.

**Interaction model:** Explore + simulated action. **No wallet, no login, no MetaMask, ever.** A
"what-if" deposit simulator computes projected outcomes client-side from the live feed values.

**Aesthetic:** warm, approachable — rounded cards, generous spacing, soft Mantle-teal gradients,
large readable numbers, plain language. Reuses design tokens + fonts but its own friendlier skin
(not Panel/DataTable terminal primitives). The `ui-ux-pro-max` skill will be consulted during build
for the Web2 visual/onboarding system.

**Layout (top → bottom):**
1. **Hero** — one plain sentence: *"AI agents forecast the best yield across Mantle's real-world
   assets, so you don't have to."* Trust line: *"Explore freely — nothing here moves real money."*
   No wallet button anywhere.
2. **Simulator (centerpiece)** — a `$____` deposit input/slider ($100–$100k). On change, live:
   - **Projected annual yield** ($ + %), NumberFlow tween.
   - **Auto-balanced mix** — friendly split bar: "X% mETH staking · Y% USDY treasury"
     (from `YieldAllocator`, relabeled).
   - **Safety check** — plain badge: "✓ Looking healthy" / "⚠ Cautious" / "⏸ Paused"
     (from `RiskManager`, no enum jargon).
   - All computed client-side from live feed values — no auth, no chain write, instant.
3. **"How the AI decides"** — progressive disclosure, collapsed by default; expands to a 3-step
   plain-language explainer (forecast → score → allocate). Crypto detail hidden unless asked.
4. **Soft CTA** — *"Want the full picture?"* → links to the terminal leaderboard. The web2 → web3
   bridge.

**Jargon translation (baked into copy):** bps → %, "mETH APR" → "mETH staking yield",
USDY → "USDY treasury yield", composite feed → "AI consensus forecast", confidence → "AI
confidence", collateral factor / riskState → "safety check".

**Mechanics:** works on mock fallback (no infra needed for the demo); responsive incl. 375px;
respects reduced-motion; keyboard + screen-reader accessible (builds on the prior a11y pass);
skeleton while feed loads.

**Wiring:** add `YieldAllocator` + `RiskManager` ABIs + addresses to `frontend/src/lib/contracts.ts`
and env (`NEXT_PUBLIC_ADDR_YIELD_ALLOCATOR`, `NEXT_PUBLIC_ADDR_RISK_MANAGER`); reuse the established
live-read + mock-fallback hooks. Add `/rwa` to `AppHeader` nav. Client component.

## Cross-cutting: deploy + docs

- **`Deploy.s.sol`**: deploy USDY oracle + `UsdyApyResolver` + `YieldAllocator` + `RiskManager`;
  register USDY category on ResolutionEngine + PredictionMarket; seed the USDY oracle synthetic
  curve; register both assets on RiskManager; write all new addresses to the deployments JSON.
- **Docs reframe to AI x RWA**: `README.md`, `docs/SUBMISSION.md`, `docs/PREFLIGHT.md`, `CLAUDE.md`
  §0 track line. Pitch becomes "verifiable AI forecasting for RWA yield + risk management on Mantle."
- **CLAUDE.md scope-cuts (§4)**: the third category (USDY) and the new consumers were previously
  cut; this design re-adds them deliberately with user approval — note that in the session history.

## Risks / open items

- **mETH is liquid-staking, not strictly an RWA** — but the track explicitly lists mETH as an
  included asset, so organizers count it. USDY is an unambiguous RWA, strengthening the fit.
- **USDY synthetic oracle** is a mock (like mETH's) — honest "v1 uses a seeded oracle; v2 reads the
  live Ondo USDY contract via archive RPC." Same justification already accepted for mETH.
- **Redeploy required** — adding contracts + a category means re-running `Deploy.s.sol` (fresh
  addresses) and re-registering agents (new AGENT_IDs) OR adding USDY to the existing deployment via
  incremental scripts. Decision deferred to the implementation plan; clean redeploy is simplest
  since the live run is still early.
- **Allocator/RiskManager are advisory** (no custody) — be ready to state this to judges as a
  deliberate scope choice, not a gap.
- **Cost** — a 3rd category adds ~50% more agent LLM calls (still negligible, ~$0.0018/seed tick).
  The real cost is test/verify time, not money. 16 days remain — comfortable.

## Verification (end-to-end)

1. `forge test` green after new contracts (USDY resolver, allocator, risk manager unit tests).
2. Redeploy to Sepolia; `cast call` each new view returns sane values
   (USDY resolver ~500 bps; allocator allocation sums to 10000; risk manager Normal/Caution/Frozen).
3. Agents forecast all 3 categories; resolver resolves USDY predictions; leaderboard shows USDY.
4. `/rwa` page: `next build` clean; simulator updates live on the feed (or mock); 375px + reduced
   motion + keyboard pass; no wallet prompt anywhere.
5. Demo: drag the deposit slider → projected yield + allocation + safety badge update — the Web2
   story in one shot.
