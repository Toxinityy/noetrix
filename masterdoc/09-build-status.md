# 09 — Build Status

Snapshot: **2026-05-28** (post Prompt 6). Update after each significant change.

## Per-package state

### Root workspace
- ✓ `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `README.workspace.md`.
- ✓ `pnpm install` clean (warnings only).
- ✗ Open: should `README.workspace.md` become root `README.md` (Prompt 13 Part D), with current `README.md` moved to `docs/PRD.md`? Defer decision.

### contracts/
- ✓ Foundry initialized (forge 1.7.1).
- ✓ `foundry.toml` configured (Solidity 0.8.24, cancun, optimizer 200, FFI on, Mantle Sepolia + mainnet RPCs, Mantlescan etherscan).
- ✓ `remappings.txt` for OZ + forge-std.
- ✓ OpenZeppelin Contracts v5.6.1 installed.
- ✓ Subdir tree per PRD §16 (`src/{interfaces,resolvers,scorers,mocks,examples}`, `test/reference`, `script/`, `config/`, `deployments/`).
- ✓ `forge build` runs.
- ✓ **AgentRegistry** (Prompt 2): `src/AgentRegistry.sol` + `src/interfaces/IAgentRegistry.sol`. 28 tests pass; coverage lines 94.5% / statements 90.7% / functions 93.3% / branches 68% (branches gap = unreachable/treasury-revert paths). Lint note: 24h timelock uses `block.timestamp` — manipulation bounded to seconds, not exploitable.
- ✓ **PredictionMarket** (Prompt 3): `src/PredictionMarket.sol` + `src/interfaces/IPredictionMarket.sol` + `src/interfaces/IBonusDistributor.sol` (stub). Commit-reveal with stake escrow, category registry (resolver/scorer/minStake/window), cancel (90% refund / 10% slash), forfeit (0.5% caller / 99.5% pool), settleStake (resolver-first per PRD §7.2.4 invariant, conservation enforced via `require sum==stake`). ReentrancyGuard on all stake-moving functions. Bonus pool slashing forwarded via `IBonusDistributor.notifySlash{value}(categoryId)`. 39 tests pass (incl. 2 fuzz × 256 runs each). Reentrancy attack test (malicious pool re-entering `commit` during `notifySlash`) confirmed reverting with `ReentrancyGuardReentrantCall`.
- ✓ **ResolutionEngine + MethAprResolver + MockMethRateOracle** (Prompt 4): `src/ResolutionEngine.sol`, `src/resolvers/MethAprResolver.sol`, `src/mocks/MockMethRateOracle.sol` + interfaces (`ICategoryResolver`, `IScoringEngine`, `IMethRateOracle`). ResolutionEngine is single source of truth for (resolver, scorer, configBytes) per categoryId; `resolve()` is permissionless and forwards `msg.sender` to ScoringEngine via `applyScore`. MethAprResolver implements PRD §7.3.1 formula `aprBps = ((rateNow*1e18/ratePrior - 1e18) * 365 * 10000) / 1e18` with clamps on zero/negative delta and on resolutionBlock < BLOCKS_PER_DAY. Mock oracle is admin-seeded via `setRate` / `setRates`. `script/SeedRates.s.sol` populates 14 days of synthetic rates from env-driven config. 27 new tests (13 ResolutionEngine + 14 MethAprResolver), 4 of which are hand-verified APR cases. Full suite now 94/94.
- ✓ **ScoringEngine + RangeCrpsScorer + calibration** (Prompt 5): `src/ScoringEngine.sol`, `src/scorers/RangeCrpsScorer.sol`, `src/interfaces/ICategoryScorer.sol`. Extended `IBonusDistributor` with `recordContribution(bytes32, uint256, uint256)` for pull-claim share tracking. Extended `IPredictionMarket` with `setScore(uint256, int256)` getter. RangeCrpsScorer implements closed-form CRPS for uniform-over-bucket forecast vs point-mass outcome over a 100-bucket configured domain, mapped to score ∈ [-1e6, +1e6] via `score = clamp((1 - 2*CRPS/D)*1e6, -1e6, +1e6)`. Math derivation documented in contract NatSpec; works in doubled coords (a' = 2a, etc.) so outcome-bucket midpoint stays integral. Python reference at `test/reference/crps_reference.py` matches Solidity *exactly* (integer truncation order identical). ScoringEngine.applyScore wires the per-resolution flow per PRD §7.4: read prediction → call scorer → compute new accuracy EMA (α=0.1) + new bucketAccuracy EMA (per confidence bucket) + computed-on-read calibration (§7.4.2) → updateReputation → compute stake split per §7.2.4 → setScore + recordContribution + settleStake. Stake conservation enforced via equality assert (`resolver + return + slash == stake`). `previewStakeSplit` + `computeCalibration` exposed as pure views for off-chain verification + indexer. Python reference at `test/reference/calibration_reference.py` matches Solidity exactly. **28 new tests (8 RangeCrpsScorer incl. 256-run fuzz, 5 Calibration incl. 256-run fuzz, 15 ScoringEngine incl. 256-run conservation fuzz). Full suite: 122/122.**
- ✓ **BonusDistributor + CompositeFeed + AaveMantleTvlResolver** (Prompt 6): `src/BonusDistributor.sol`, `src/CompositeFeed.sol`, `src/SubscriptionGate.sol`, `src/resolvers/AaveMantleTvlResolver.sol`, `src/mocks/{MockAavePool,MockAToken}.sol` + interfaces (`ISubscriptionGate`, `ICompositeFeed`, `IAaveLike`). BonusDistributor is PULL-CLAIM, zero iteration: `notifySlash` (payable, msg.value carries slashed MNT — matches existing PredictionMarket callsite, keeps native conservation), `recordContribution`, `finalizeEpoch` (rollover 5% to next epoch + 0.5% finalizer reward, both off rawPool per Prompt 6 pseudocode), `claimBonus` (controller-gated, floor-div, dust stays in contract). Authorized = PredictionMarket + ScoringEngine via single `authorized` mapping. CompositeFeed.refresh: reads AgentRegistry top-20 (built Prompt 2, read-only here), pulls each agent's latest still-Revealed prediction via new `PredictionMarket.latestRevealedPrediction(agentId, categoryId)` index (added on reveal), re-ranks contributors, rank weight `(N+1-r)/(N(N+1)/2)`, ensemble = Σ w·midpoint, confidence = weightedStated × multiplier where multiplier = 1 + mean(clip(cal,-0.5)) ∈ [0.5,1.0]. Rate-limited 100 blocks/category; `read` gated by SubscriptionGate (open v1, optional/unset = fully open). AaveMantleTvlResolver iterates pool reserves: `aToken.totalSupply × price8 / 10^underlyingDecimals` → USD 8-dec; v1 reads MockAavePool (bundles pool+oracle, archive-RPC substitute). **23 new tests (12 BonusDistributor incl. conservation + dust, 7 CompositeFeed incl. hand-verified ensemble + rate limit + confidence multiplier, 4 AaveMantleTvlResolver incl. hand-calc 3-reserve TVL). Full suite: 145/145.**
- ✗ Next: **Prompt 7 — Deployment + end-to-end smoke test** (Mantle Sepolia, 12 contracts).

### frontend/ — app pages (out-of-sequence build before Prompt 11)
- ✓ `lib/format.ts` — number / address / bps / score formatters
- ✓ `lib/mockData.ts` — 8 agents × 2 categories with realistic reputation, predictions, reasoning traces, equity curves, feed history, epochs
- ✓ UI primitives in `components/ui/`: `Panel`, `Stat`, `AddressChip`, `StatusPill`, `CategoryTabs` (Radix Tabs), `DataTable` (sortable), `Sparkline` (SVG), `NumberFlow` (Motion tween), `Skeleton`, `Collapsible` (Radix Accordion)
- ✓ App chrome in `components/app/`: `AppHeader` (sticky, terminal nav, Sepolia status pill, disabled Connect stub) + `AppFooter` (info-dense 4-column with system pointers)
- ✓ Route group `app/(app)/` with its own layout (AppHeader/Footer). Landing stays at root `app/page.tsx` outside the group.
- ✓ `/leaderboard` — sortable agent table, category tabs, composite feed snapshot card with live oscillation, top-agent panel, 4 KPI tiles, "how it works" collapsible with 4 sections.
- ✓ `/agent/[id]` — identity NFT card with gradient, system metadata panel, 4 KPI tiles, reputation radar (Recharts), equity curve (Recharts line), calibration buckets (Recharts bar), expandable per-prediction reasoning trace with IPFS payload preview (heavy investment per PRD §9.2).
- ✓ `/demo-consumer` — DemoFeedConsumer simulator with auto-refresh + manual refresh + checkbox, "what is this" panel for protocols, contract pointers, Solidity integration snippet with line numbers, callout cards.
- ✓ `/feed/[category]` (bonus) — 4 KPI tiles, composite feed history Recharts area chart with 24h-ago reference line, contributor table sorted by weight with inline bars.
- ✓ Next.js 16 idioms: `await params`, `PageProps<'/path'>` globals, server/client split per dynamic page.
- ✓ `next build` clean: 6 routes, TypeScript pass.
- ✗ Next: wallet integration (Prompt 11) — wire wagmi + Connect button + replace mock data hooks with indexer reads.

### frontend/
- ✓ `create-next-app` scaffold (Next.js 16.2.6, Tailwind v4, TS, App Router, ESLint, src dir, Turbopack, `@/*` alias).
- ✓ Deps installed: Radix UI (8 primitives), Motion v12, wagmi 3.6.15, viem 2.51, TanStack Query 5, Recharts 3.8, lucide-react, clsx + tailwind-merge + cva.
- ✓ Fonts: Inter + JetBrains Mono via next/font/google with CSS vars `--font-inter`, `--font-jbmono`.
- ✓ Design tokens in `app/globals.css`: Mantle teal accent (#33EAB3), near-monochrome dark palette, status colors (up/down/warn), `font-feature-settings: tnum`, grid background utility, `prefers-reduced-motion` global override.
- ✓ Landing page (`/`) built per PRD §9.3 v2.2 hybrid aesthetic. Sections:
  - `Nav` — sticky, backdrop-blur on scroll
  - `Hero` — **WebGL ambient swirl** (`DitheringShader`, deepest layer, Mantle teal on near-black, 4×4 dithering, swirl shape, speed=0.55, `mix-blend-mode: screen`); **cursor-driven spotlight lens** (2nd shader instance with `ripple` shape revealed via radial mask following spring-smoothed cursor); **cursor follower ring + dot** (system cursor hidden over hero, replaced with teal accent ring + 1.5px dot, both spring-tracked); **char hover** (each title letter lifts 8px + tints teal); **title parallax** (subtle magnetic offset toward cursor); kinetic char-stagger title, glow ring, corner meta. Touch devices skip all cursor effects via `(hover: hover) and (pointer: fine)` media query.
  - `LivePulse` — `requestAnimationFrame`-driven synthetic composite-feed chart (SVG paths animate, value motion-tweens, pulsing latest-dot)
  - `ReasoningReveal` — scroll-driven Claude trace card with parsed JSON sidebar (4-step trace)
  - `LeaderboardPreview` — terminal aesthetic, row stagger on viewport enter
  - `HowItWorks` — 5-step grid with stagger reveal
  - `Footer`
- ✓ **Page-stack via GSAP ScrollTrigger pin** (`frontend/src/components/ui/story-scroll.tsx`): each section is `data-flow-section min-h-screen overflow-hidden` with an inner `.flow-art-container` (transform-origin bottom-left). GSAP query selects all sections in document order, then:
  - Each non-first inner starts at `rotation: 30deg` and scrubs to 0 as it scrolls from `top bottom` → `top 25%`.
  - Each non-last section pins from `bottom bottom` → `bottom top` with `pinSpacing: false` — section sticks at viewport bottom while next slides in over it.
  - `z-index` assigned per index so later sections naturally overlay earlier.
  - Honors `prefers-reduced-motion` (skips GSAP entirely).
  - `page.tsx` uses a thin `StoryFrame` wrapper around each existing landing component so the section/inner DOM markers are present without imposing the demo template's flex/padding layout.
- ✗ Previous `SlideSection` (CSS scroll-snap) replaced by FlowArt. SlideSection file kept for reference.
- ✓ Helper `src/lib/cn.ts` (clsx + tailwind-merge).
- ✓ Verified: GET / 200 OK in 254ms, content renders.
- ⚠ Next 16 has breaking changes (see `frontend/AGENTS.md`). Read `node_modules/next/dist/docs/` before further work.
- ⚠ Cosmetic warnings deferred: extra `frontend/pnpm-workspace.yaml` from create-next-app (remove); `turbopack.root` unset in `next.config.ts`.
- ✗ All data is mocked. wagmi config + real indexer wiring at Prompt 11.
- ✗ `/agent/[id]`, `/demo-consumer` not built.
- Next: **Prompt 11 — agent detail + demo consumer pages + wire to deployed contracts**.

### indexer/
- ✓ Ponder empty template scaffolded (`pnpm create ponder`).
- ✓ Deps installed (ponder 0.16.6, hono 4.5, viem 2.21).
- ✓ Nested `.git` from create-ponder removed.
- ✗ `ponder.config.ts` not wired (no contract addresses yet).
- ✗ `ponder.schema.ts` empty.
- ✗ No event handlers, no REST endpoints.
- ✗ Not deployed.
- ⚠ Peer-dep warning: `eslint-config-ponder` expects `@typescript-eslint/* @^6.3.0`, found 8.60.0. Non-blocking.
- Next: **Prompt 8 — Ponder indexer** (after Prompt 7 deploys to Sepolia).

### agents/sdk
- ✓ `package.json` + `tsconfig.json` + `src/index.ts` (exports `PREDICTOR_SDK_VERSION`).
- ✓ `pnpm -C agents/sdk build` works.
- ✗ No actual SDK implementation.
- Next: **Prompt 9 Part A — Agent SDK**.

### agents/arima-baseline
- ✓ `package.json` + `tsconfig.json` + `src/index.ts` placeholder.
- ✓ Workspace link to `@predictor-index/sdk` resolved.
- ✗ No ARIMA implementation, no scheduler, no register script.
- Next: **Prompt 9 Part B + C + D**.

### agents/claude-reasoner
- ✓ `package.json` + `tsconfig.json` + `src/index.ts` placeholder.
- ✓ `@anthropic-ai/sdk` dep installed.
- ✓ `fewshot/` directory (empty).
- ✗ No reasoning pipeline.
- ✗ No few-shot examples (hand-written Day-9 deliverable per PRD §8.3).
- Next: **Prompt 10**.

### agents/refresher
- ✓ `package.json` + `tsconfig.json` + `src/index.ts` placeholder.
- ✗ No cron worker, no `CompositeFeed.refresh` call.
- Next: **Prompt 11 Part D** (built alongside frontend).

### Deployments
- ✗ None. Mantle Sepolia deploy at **Prompt 7**.

## Verification ledger

| Check | Status | Date |
|-------|--------|------|
| `forge build` | ✓ (compiles AgentRegistry + IAgentRegistry) | 2026-05-26 |
| `forge test --match-contract AgentRegistryTest` | ✓ 28/28 pass | 2026-05-26 |
| `forge coverage` AgentRegistry | ✓ lines 94.5% (target ≥90%) | 2026-05-26 |
| `pnpm install` (root) | ✓ | 2026-05-26 |
| `pnpm -C agents/sdk build` | ✓ | 2026-05-26 |
| No `hardhat.config.*` in own code | ✓ | 2026-05-26 |
| All §16 dirs present | ✓ | 2026-05-26 |
| `pnpm -C frontend dev` (smoke test) | ⏳ not yet attempted | — |
| `pnpm -C indexer dev` (smoke test) | ⏳ not yet attempted | — |

## Pre-flight checklist for Prompt 3 (next session)

- [ ] Confirm forge is on PATH (`forge --version`).
- [ ] Read PRD §7.2 (PredictionMarket full spec) — commit-reveal, settlement.
- [ ] Read `CLAUDE.md` §3 invariants 1, 5 (stake conservation, commit-reveal cutoff).
- [ ] Re-read `07-conventions.md` (custom errors, ReentrancyGuard required).
- [ ] Write `src/PredictionMarket.sol` + `src/interfaces/IPredictionMarket.sol` + `test/PredictionMarket.t.sol`.
- [ ] Cover all reverts (wrong nonce, before delay, after window, near resolution, low stake) + 90/10 cancel + 99.5/0.5 forfeit + fuzz random valid commit-reveal pairs + reentrancy.
- [ ] Update `09-build-status.md` + append session entry to `CLAUDE.md` §6.

## Known open questions

1. README dual-purpose: keep PRD at `README.md` or move to `docs/PRD.md` so `README.md` can become the GitHub project README (per Prompt 13 Part D). Defer.
2. Refresher cron host: Railway, Vercel cron, or GitHub Actions. Decide before Prompt 11.
3. mETH archive-block access on Mantle: can a standard RPC read `mETH.exchangeRate()` at an arbitrary historical block? If not, the v1 fallback `MockMethRateOracle` (admin-settable per-block rates) is required. Confirm during Prompt 4.
4. Aave-on-Mantle: confirm it's live with reserves to read. Contingency: drop AAVE_MANTLE_TVL_24H category and substitute `INIT_CAPITAL_TVL_24H`.
5. Mantle block time: confirm really 2s (not 3s) on both Sepolia and mainnet before any deploy.

## Risk register (top 5)

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | CRPS / calibration Solidity diverges from Python reference | Python is source of truth; ≤0.1% tolerance; 10 test cases each. |
| 2 | topAgents insertion-sort bug → wrong leaderboard → wrong composite feed | Extra targeted unit tests (5+ edge cases); single source `_updateTopAgents`. |
| 3 | Mantle block time != 2s | Verify at start of Prompt 7 (deploy). Affects every block-window constant. |
| 4 | Indexer lags chain → SEED_MODE never flips | Indexer + Railway monitoring; fallback flip on `48h elapsed`. |
| 5 | Claude reasoner produces bland predictions in cold-start | Hand-written few-shot examples Day 9 (PRD §8.3 mandate). |
