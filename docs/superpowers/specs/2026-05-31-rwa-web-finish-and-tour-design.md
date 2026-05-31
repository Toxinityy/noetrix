# Design: Finish AI x RWA pivot on the web + terminal onboarding spotlight

**Date:** 2026-05-31
**Status:** Approved (design); pending implementation plan
**Branch:** `rwa-web-tour`

## Context

On 2026-05-30 the project pivoted to the **AI x RWA** hackathon track (see
`docs/superpowers/specs/2026-05-30-rwa-pivot-design.md`). That pivot shipped the *contract* and
*agent* side end-to-end (USDY category, `YieldAllocator`, `RiskManager`, all live on Mantle Sepolia)
plus a single Web2 page (`/rwa`). But the pivot was only **half-applied to the website**:

- **Terminal is still pre-pivot.** `frontend/src/lib/mockData.ts` defines
  `CategoryId = "METH_APR_24H" | "AAVE_MANTLE_TVL_24H"` — **no `USDY_APY_24H`**. Every terminal
  surface that maps over `CATEGORIES` (leaderboard tabs, `feed/[category]`, `category/[category]`,
  agent reputation, predictions, feed history) therefore omits USDY, even though the deployed
  contracts and both agents forecast it live.
- **Landing is still generic.** `Hero.tsx` pitches "On-chain AI agent forecasting protocol …
  subscribe to the consensus of the most calibrated agents." `CategoriesShowcase.tsx` says "two
  categories shipped" (mETH + Aave-TVL). Neither mentions RWA, yield, risk, or USDY — but the track
  is now AI x RWA.
- **No terminal onboarding** exists. The landing "Enter terminal" CTA drops a first-time visitor
  straight into the dense `/leaderboard` with no guidance.

This design closes both gaps: (1) finish the pivot across landing + terminal, and (2) add a
first-run spotlight tutorial when users enter the terminal.

The `YieldAllocator` + `RiskManager` reads on `/rwa` already work and are **not** changed here. No
contract changes.

## Goals / Non-goals

**Goals**
- Surface the **USDY_APY_24H** category everywhere the terminal already surfaces the other two, so
  the UI matches the deployed contracts (mETH · USDY · Aave-TVL).
- Reframe the **landing** (hero + categories, light copy elsewhere) to tell one AI x RWA story:
  *agents forecast and risk-manage yield across Mantle real-world assets*.
- Add a terminal-core **RWA Strategy panel** on the leaderboard reading `YieldAllocator` +
  `RiskManager` (raw bps / enum, crypto-native — distinct from `/rwa`'s friendly skin).
- Add a **spotlight onboarding tour** on the leaderboard: dark low-opacity backdrop that highlights
  each feature one step at a time; auto on first visit, replayable via a header "Guide" button.

**Non-goals (YAGNI)**
- No contract/agent/indexer changes (indexer is already category-agnostic).
- No `/rwa` redesign — it works.
- No new scorer or category beyond USDY (already deployed).
- Tour is **leaderboard-only** (not a multi-page wizard) — robust for a live demo.
- No third-party tour library (react-joyride / driver.js / intro.js) — custom + dependency-free.

## Decisions (locked with user)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Pivot reach | **Full alignment** — USDY across terminal + landing reframe |
| 2 | Tour scope/trigger | **Leaderboard only**, auto on first visit + replay button, stepped spotlight |
| 3 | Yield/risk in terminal | **Add a terminal RWA Strategy panel** (on the leaderboard) in addition to `/rwa` |
| 4 | Tour tech | **Custom** CSS box-shadow spotlight + Motion (no library) |
| 5 | RWA panel placement | **Leaderboard page** (so the tour can spotlight it) |

## Part A — USDY category across the terminal

**`frontend/src/lib/mockData.ts`**
- Extend `CategoryId` to include `"USDY_APY_24H"`.
- Add a `CATEGORIES.USDY_APY_24H` entry:
  - `slug: "usdy-apy-24h"`, `unit: "bps"`, `label: "USDY 24h APY"`,
  - `minStake: 0.05`, `windowBlocks: { start: 300, end: 50_000 }`,
  - `description`: Ondo USDY price-per-share annualized over 43,200 blocks via `UsdyApyResolver`
    (mirror of the mETH resolver; v1 seeded oracle, v2 reads live Ondo).
  - `current: ~500` (≈5% APY), `unitFormatter: (n) => `${(n/100).toFixed(2)}%``.
- Add a `reputation.USDY_APY_24H` block to **all 8 mock agents** with plausible
  accuracy/calibration/resolvedCount/bucket arrays (numerically consistent with each agent's
  existing personas — e.g. claude-α strongest, naive-persistence weakest).
- `PREDICTIONS` and `makeFeedHistory` already iterate `Object.values(CATEGORIES)` → they auto-cover
  USDY once the entry exists. Add USDY `drift`/`noise` constants in `makeFeedHistory` (bps-scale,
  same order as mETH) and a USDY branch for `pointBase`/`halfWidth` in the `PREDICTIONS` generator
  (bps-scale around ~500).

**Propagation (no extra code):** leaderboard category tabs, `feed/[category]`, `category/[category]`
(both use slug routing via the categories map), agent-detail reputation, and the composite snapshot
all derive from `CATEGORIES` and pick up USDY automatically.

**`frontend/src/components/ui/CategoryTabs.tsx`** (caller `LeaderboardClient.tsx`): the tab caption
currently hardcodes `c.id === "METH_APR_24H" ? "bps" : "USD"`. Change the caller to derive the unit
label from `cat.unit` (`bps` for mETH+USDY, `USD` for Aave-TVL) so USDY reads "bps", not "USD".

**Live path:** `lib/indexer.ts` + `lib/contracts.ts` are category-agnostic (`categoryHash(label)`);
USDY resolves the moment it's in `CATEGORIES`. `lib/contracts.ts` already has `RWA_LABELS.usdy`.
No env change (USDY uses the same CompositeFeed address).

## Part B — Landing reframe to AI x RWA

**`frontend/src/components/landing/Hero.tsx`**
- Keep the `NOETRIX` kinetic title and all motion.
- Rewrite the subtitle to RWA framing, e.g.: *"AI agents forecast and risk-manage yield across
  Mantle's real-world assets — mETH and USDY. Soulbound identities, commit-reveal predictions,
  CRPS-scored into a rank-weighted consensus feed that powers yield strategy and risk controls."*
- Optionally update the corner-meta lines to include an RWA token (cosmetic).

**`frontend/src/components/landing/CategoriesShowcase.tsx`**
- "two categories shipped" → **three**; add a USDY card (title "USDY treasury yield", domain
  `[0%, 20%] APY`, cadence ~24h, formula mirrors mETH, sample band ~5%).
- Reframe the section header from "Each category is a contract" toward RWA assets while keeping the
  "category = resolver + scorer + domain" technical point.
- Grid already `md:grid-cols-2`; with three cards use `md:grid-cols-3` (or 2-col wrap) — verify
  375px + tablet.

**Light copy** in `HowItWorks.tsx` and/or `FaqAccordion.tsx`: adjust 1–2 lines so the framing reads
"yield + risk management for RWAs," not generic forecasting. Minimal — hero + categories carry it.

## Part C — Terminal RWA Strategy panel (leaderboard)

New component (e.g. `frontend/src/components/app/RwaStrategyPanel.tsx`), terminal-core aesthetic
(reuses `Panel` / `Stat` / `StatusPill`), rendered on `LeaderboardClient.tsx`.

- **Reads (live, 30s, with mock fallback):**
  - `YieldAllocator.getAllocation()` → `(allocMethBps, allocUsdyBps, methYield, usdyYield)`.
  - `RiskManager.riskState(categoryId)` for mETH + USDY → enum `{0 Normal, 1 Caution, 2 Frozen}`.
  - (Optional) `collateralFactor` / `depositCap` per category for extra stats.
- **Render:** a compact allocation bar (raw `mETH 4300 bps / USDY 5700 bps`), per-asset risk pills
  (`NORMAL` accent / `CAUTION` warn / `FROZEN` down), and 2–3 `Stat` tiles (effective yields,
  collateral factor). Crypto-native raw values — explicitly *not* the `/rwa` friendly translation.
- **Fallback:** when `hasYieldAllocator`/`hasRiskManager` are false (build / no env), use the same
  demo constants `/rwa` uses (mETH 43% / USDY 57%, Normal). Reuse the read pattern from
  `RwaClient.tsx`.
- **Placement:** below the existing "composite feed snapshot + top agent" row, above the category
  tabs (so it's a natural tour step). Tag with `data-tour="rwa-strategy"`.

## Part D — Spotlight onboarding tour (headline feature)

New `frontend/src/components/tour/` module, custom + dependency-free.

**Pieces**
- `useTour` — small state machine: `{ isOpen, stepIndex, start(), next(), prev(), skip(), finish() }`,
  plus first-run detection via `localStorage["noetrix.tour.v1"]`.
- `Spotlight.tsx` — the overlay (renders only when `isOpen`).
- Step registry (array): `{ id, selector: '[data-tour="…"]', title, body, placement? }`.
- Leaderboard elements get `data-tour` attributes: `category-tabs`, `feed-value`, `agent-table`,
  `top-agent`, `rwa-strategy`, `how-it-works`.

**Overlay mechanics**
- Fixed, full-viewport, `z-index` above app chrome (define above the header's `z-30`).
- The "spotlight" is a single positioned div sized to the **target's bounding rect + ~8px padding**
  with `box-shadow: 0 0 0 9999px rgba(0,0,0,0.66)` → a black, low-opacity backdrop everywhere
  except a cutout around the highlighted feature, plus a 1px accent ring + slight radius. This is
  literally the "black shadow with low opacity background highlighting each feature" the user asked
  for.
- Motion animates the cutout's `top/left/width/height` (spring) between steps; `prefers-reduced-
  motion` → instant, no spring.
- Before each step: `scrollIntoView({ block: "center" })` the target, then measure. Recompute the
  rect on `resize` and `scroll` (passive listener) so the cutout tracks the element.
- **Callout card** anchored near the target (placement auto-flips to stay in viewport): step counter
  `n / N`, title, body, and `Back` / `Next` / `Skip` (last step → `Finish`).

**Trigger / replay**
- Auto-start on first `/leaderboard` mount when the localStorage flag is unset; set the flag on
  finish *or* skip so it doesn't nag.
- A persistent **"Guide"** button in `AppHeader` (visible on terminal pages) calls `start()` to
  replay anytime. (If the button must drive a tour that lives on the leaderboard, either expose the
  tour via a small context provider mounted in the `(app)` layout, or have the button navigate to
  `/leaderboard?tour=1`. Implementation plan picks one; context provider preferred.)

**Steps (6)**
1. **Category tabs** — "Pick an RWA market: mETH APR, USDY APY, or Aave-on-Mantle TVL."
2. **Composite feed value** — "The rank-weighted consensus of the most calibrated agents."
3. **Agent leaderboard table** — "Every agent is an ERC-8004 soulbound identity, ranked by on-chain
   accuracy + calibration."
4. **Top-agent panel** — "The current category leader and its live reputation."
5. **RWA Strategy panel** — "Forecasts drive a dynamic yield allocation + automated risk state."
6. **How it works / bridge** — "Dig into scoring below — or try the no-wallet **Earn** simulator
   and the **Consumer** demo from the nav."

**Accessibility**
- `Esc` = skip; `←`/`→` (or `Enter`) = prev/next; focus moves into the callout when a step opens and
  is restored on close; `aria-live="polite"` announces step text; respects reduced-motion; callout
  buttons are real `<button>`s with labels.

## Files touched

- Edit: `frontend/src/lib/mockData.ts`, `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx`,
  `frontend/src/components/ui/CategoryTabs.tsx` (or just its caller),
  `frontend/src/components/landing/Hero.tsx`, `frontend/src/components/landing/CategoriesShowcase.tsx`,
  `frontend/src/components/landing/HowItWorks.tsx` and/or `FaqAccordion.tsx` (copy),
  `frontend/src/components/app/AppHeader.tsx` (+Guide button).
- New: `frontend/src/components/app/RwaStrategyPanel.tsx`, `frontend/src/components/tour/Spotlight.tsx`,
  `frontend/src/components/tour/useTour.ts` (+ step registry), and a tour context provider if the
  Guide button needs to reach the leaderboard tour.

## Verification

1. `pnpm --filter frontend build` (or `next build`) clean — landing + all `(app)` routes.
2. Leaderboard shows **three** category tabs; switching to USDY renders feed value, history, agents,
   and the USDY caption reads "bps".
3. Landing hero + categories show the RWA framing and the USDY card; 375px + tablet + reduced-motion
   pass.
4. RWA Strategy panel renders on the leaderboard (mock fallback when no env; live when addresses
   set).
5. First `/leaderboard` visit auto-starts the tour; backdrop dims, each feature is highlighted in
   turn; Back/Next/Skip/Finish work; `Esc` + arrow keys work; the flag suppresses re-show; the
   "Guide" button replays it. Reduced-motion disables the spring but the tour is still usable.

## Risks / open items

- **Box-shadow spotlight + sticky header:** the header is `sticky z-30`. The overlay must sit above
  it (`z-50`+). When a target is under the sticky header, `scrollIntoView({ block: "center" })`
  avoids the target hiding behind the header. Verify steps 1–2 specifically.
- **Rect measurement during GSAP/Motion:** the leaderboard itself has entrance motion on tab change.
  Tour measurement should run after layout settles (rAF after scroll) and re-measure on resize to
  avoid a stale cutout.
- **Live RWA panel before env is set:** falls back to demo constants (same as `/rwa`); flagged so it
  reads as demo, not a bug.
- **Mock USDY numbers are illustrative** — once the indexer serves live USDY they're replaced by
  real values; keep the mock numerically sane so demo-fallback looks right.
