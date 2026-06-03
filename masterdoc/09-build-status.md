# 09 — Build Status

Snapshot: **2026-05-29** (post Prompt 12 code — DemoFeedConsumer business logic + local full-pipeline E2E + frontend decision panel; live deploy + indexer hosting + agent register + Vercel deploy + visual screenshots pending credentials). Update after each significant change.

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
- ◑ **Deployment + smoke test** (Prompt 7): `src/examples/DemoFeedConsumer.sol`, `script/Deploy.s.sol`, `script/SmokeTest.s.sol`, `config/mantle-sepolia.toml`, `contracts/.env.example` (expanded), `test/EndToEnd.t.sol`. **DemoFeedConsumer** reads CompositeFeed + decodes the packed point estimate, with a `valueFresh` staleness guard. **Deploy.s.sol** deploys all 12 contracts in dependency order, wires every cross-reference (note: ScoringEngine's registry+market are constructor immutables — no setters; PredictionMarket uses `setBonusPool` + `registerCategory`, not the Prompt's `setCategoryConfig`), registers both categories with RangeCrpsScorer domain configs, and writes `deployments/<net>.json`. Verified by dry-run simulation (anvil default key): 12 deploys + wiring + JSON write all succeed. **SmokeTest.s.sol** is self-contained (deploys + runs the full commit→reveal→resolve round-trip with block cheatcodes, asserts §7.2.4 settlement, logs every state change) — `forge script script/SmokeTest.s.sol:SmokeTest` PASSES with no live credentials: score 998334, resolver reward exactly 2% (2e16), conservation holds (2e16 + 0.97918366e18 + 0.00081634e18 == 1e18), resolvedCount 1. **EndToEnd.t.sol** is the same round-trip as a deterministic test. **Full suite: 146/146.**
  - ✗ **BLOCKED on user credentials — Part C (live deploy + Mantlescan verify) not run.** Needs funded `PRIVATE_KEY` + `MANTLE_SEPOLIA_RPC` + `MANTLESCAN_API_KEY`. Command: `forge script script/Deploy.s.sol:Deploy --rpc-url $MANTLE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast --verify`. Then `forge script script/SeedRates.s.sol:SeedRates --broadcast` to seed the mETH oracle. Live reveal/resolve is ~350 blocks apart (~12 min) so can't be one-shot scripted on Sepolia — drive tx-by-tx with `cast`. `deployments/mantle-sepolia.json` intentionally not committed (regenerated by the real broadcast; sim run produced a chainId-31337 placeholder which was deleted).
- ✓ **DemoFeedConsumer business logic + full-pipeline E2E** (Prompt 12): extended `src/examples/DemoFeedConsumer.sol` with `getCurrentMethApr`/`getCurrentAaveTvl`/`shouldAllowDeposits` (mETH APR > 400 bps) / `shouldThrottleRisk` (Aave-Mantle TVL < $500M), category ids + thresholds as constants, unset-feed safe default (throttle). Added `test_FullPipeline_FeedDrivesConsumerDecisions` to `test/EndToEnd.t.sol`: 2 agents → 10 resolve cycles each (reach ≥10 qualification) → active Revealed forecasts → `CompositeFeed.refresh` → consumer reads ensemble (~3650 bps, 2 contributors) → asserts both business-logic decisions. Proves the entire chain end-to-end. **Full suite: 147/147.**
- ✗ Next (contracts): live deploy (Prompt 7 Part C) when creds land; DemoFeedConsumer already in Deploy.s.sol (views additive, no deploy change).

### indexer/ — Ponder (Prompt 8)
- ◑ Built; **codegen + `tsc` typecheck clean**. Live sync + Railway deploy blocked on real deployed addresses (Prompt 7 Part C).
- ✓ `abis/{AgentRegistry,PredictionMarket,CompositeFeed,BonusDistributor}Abi.ts` — extracted from `contracts/out` artifacts (removed ExampleContractAbi).
- ✓ `ponder.config.ts` — chain `mantleSepolia` (id 5003), 4 contracts. Address loader priority: `ADDR_*` env → `contracts/deployments/<DEPLOY_NETWORK>.json` → zero. `startBlock` from `PONDER_START_BLOCK`. Builds/typechecks before any deploy exists.
- ✓ `ponder.schema.ts` — 5 tables: `agents`, `reputations`, `predictions`, `feedSnapshots`, `bonusDistributions`. Single concatenated text PKs (`${agentId}-${categoryId}`, etc.). int256 → `bigint` (handles negatives), bytes → `hex`, confidence → `integer`, agentBonuses → `json`.
- ✓ `src/index.ts` — handlers: AgentRegistry (AgentRegistered/ControllerRotated/ReputationUpdated), PredictionMarket (Committed/Revealed/Cancelled/Forfeited/Resolved — Resolved carries score, increments totalResolved), CompositeFeed (CompositeFeedRefreshed → snapshot), BonusDistributor (EpochFinalized → row, BonusClaimed → append agentBonuses JSON). Uses **PredictionMarket.PredictionResolved** for status+score (no need to index ScoringEngine.PredictionScored — agentId/categoryId already on the prediction row).
- ✓ `src/api/index.ts` — REST per §10: `/leaderboard?category=&limit=`, `/agent/:id`, `/agent/:id/predictions?offset=&limit=&status=`, `/category/:id`, `/feed/:category/history?limit=`. Plus built-in `/graphql` + `/sql`. `categoryHash()` accepts label ("METH_APR_24H") or raw bytes32; bigint→string `serialize()` for JSON. drizzle ops (`eq/and/desc`) imported from `ponder` (it re-exports them) — avoids adding drizzle-orm as a direct dep.
- ✓ `.env.example` — PONDER_RPC_URL_MANTLE_SEPOLIA, PONDER_START_BLOCK, ADDR_*, DATABASE_URL.
- ✗ **BLOCKED — live run + Railway deploy.** Needs deployed addresses (set `ADDR_*` or have Deploy.s.sol write the JSON) + `PONDER_RPC_URL_MANTLE_SEPOLIA` + `PONDER_START_BLOCK` (= AgentRegistry deploy block). Then `pnpm dev` locally / Railway service with `DATABASE_URL` Postgres. Verify: `curl /leaderboard?category=METH_APR_24H&limit=10`.
- ✗ Next: **Prompt 9 — Agent SDK + ARIMA agent**.

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
- ◑ **Prompt 11 live-wiring layer**: `lib/{env,contracts,wagmi,indexer,hooks}.ts` + `components/providers/Providers.tsx` (WagmiProvider + QueryClientProvider in root layout) + `frontend/.env.example`. Hooks (`useLeaderboard`/`useFeedHistory`) fetch the indexer REST on a 30s TanStack refetch when `NEXT_PUBLIC_INDEXER_URL` is set, else **mock fallback** (also falls back on live error/empty). **AppHeader Connect** = real wagmi injected connector. **Leaderboard** rewired to hooks + adds calibrating badge (resolvedCount<10) + skeleton + empty state. **Demo-consumer** = live `CompositeFeed.read` (30s) + manual refresh button wired to `CompositeFeed.refresh` (RateLimited caught). `next build` clean in mock mode.
- ✗ **Live data path unverified** (no indexer/contracts; no browser/375px run). Agent-detail + feed pages still mock (Part B reasoning-trace IPFS wiring deferred to post-deploy). Vercel deploy pending addresses.
- Next: deploy contracts (Prompt 7 C) + indexer → set NEXT_PUBLIC_* → rebuild → Vercel deploy + walk-through (desktop + 375px).

### frontend/
- ✓ `create-next-app` scaffold (Next.js 16.2.6, Tailwind v4, TS, App Router, ESLint, src dir, Turbopack, `@/*` alias).
- ✓ Deps installed: Radix UI (8 primitives), Motion v12, wagmi 3.6.15, viem 2.51, TanStack Query 5, Recharts 3.8, lucide-react, clsx + tailwind-merge + cva.
- ✓ Fonts: Inter + JetBrains Mono via next/font/google with CSS vars `--font-inter`, `--font-jbmono`.
- ✓ Design tokens in `app/globals.css`: Mantle teal accent (#33EAB3), near-monochrome dark palette, status colors (up/down/warn), `font-feature-settings: tnum`, grid background utility, `prefers-reduced-motion` global override.
- ✓ Landing page (`/`) built per PRD §9.3 v2.2 hybrid aesthetic. Sections:
  - `Nav` — sticky, backdrop-blur on scroll
  - `Hero` — **WebGL ambient swirl** (`DitheringShader`, deepest layer, Mantle teal on near-black, 4×4 dithering, swirl shape, speed=0.55, `mix-blend-mode: screen`); **cursor-driven spotlight lens** (2nd shader instance with `ripple` shape revealed via radial mask following spring-smoothed cursor); **cursor follower ring + dot** (system cursor hidden over hero, replaced with teal accent ring + 1.5px dot, both spring-tracked); **char hover** (each title letter lifts 8px + tints teal); **title parallax** (subtle magnetic offset toward cursor); kinetic char-stagger title, glow ring, corner meta. Touch devices skip all cursor effects via `(hover: hover) and (pointer: fine)` media query.
  - `LivePulse` — `requestAnimationFrame`-driven synthetic composite-feed chart (SVG paths animate, value motion-tweens, pulsing latest-dot)
  - `ReasoningReveal` — scroll-driven DeepSeek trace card with parsed JSON sidebar (4-step trace)
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

### agents/sdk (Prompt 9 Part A)
- ✓ Full SDK: `src/{abis,types,categories,addresses,ipfs,agent,index}.ts`. `tsc` clean, dist emitted.
- ✓ `Agent` class: `commit / reveal / submitFullCycle / register / getCategoryConfig`. viem clients (custom Mantle Sepolia chain), `nonceManager` for batch nonce caching, 3-attempt retry w/ backoff, default gas estimation. Commit hash matches PredictionMarket.reveal recomputation exactly; predictionId parsed from `PredictionCommitted` receipt log. Reveal polls block number into `[commit+DELAY, commit+WINDOW]`.
- ✓ Categories (keccak label ids + domains mirroring Deploy.s.sol), 3-tier address loader (same as indexer), `uploadContent` (keccak contentHash + optional Pinata IPFS pin).
- ✗ Live exercise pending deployed addresses + funded key.
- Next: consumed by Prompt 10 (DeepSeek reasoner) + Prompt 11 (refresher).

### agents/arima-baseline (Prompt 9 Parts B+C+D)
- ✓ `src/{arima,config,state,indexer,index}.ts` + `scripts/register.ts` + `.env.example`. `tsc` clean, dist emitted.
- ✓ Self-contained ARIMA(1,1,1) (pure TS, no native/WASM): d=1 diff, CSS estimation of (phi,theta) via grid+refine, integrated forecast + 95% interval from cumulative psi-weights.
- ✓ Main loop: indexer history (range midpoints; synthetic 15-pt seed if <10) → fit → clamp band to domain → upload provenance → `submitFullCycle` (5000 bps). SEED_MODE state machine (`agent.state.json`) w/ auto-flip on resolved-count ≥50 OR 48h elapsed; seed offset 350 blocks / 30-min cadence, normal 43200 / 6h.
- ✓ `register.ts`: §8.1.1 metadata → IPFS (or data: URI) → `register()` w/ 0.1 MNT → writes AGENT_ID to .env.
- ✗ NOT run live (needs deployed addresses + funded controller key + ideally live indexer). Hosting (GH Actions cron / Railway) deferred.
- Next: live register + run once Prompt 7 Part C deploys.

### agents/deepseek-reasoner (Prompt 10 — demo highlight)
- ✓ `src/{config,state,indexer,news,context,prompt,forecast,index}.ts` + `scripts/register.ts` + `.env.example`. `tsc` clean, dist emitted.
- ✓ Pipeline: per category → getCategoryConfig → parallel [feed history, agent resolved history+scores, CryptoPanic 24h news] → Markdown context → few-shot + user prompt → OpenRouter `chat/completions` → parse/validate JSON → clamp band+confidence → upload full prompt+response+forecast (contentHash) → `submitFullCycle`. JSONL debug log.
- ✓ System prompt verbatim per §8.3 + "scores are PUBLIC on-chain" honesty nudge; strict JSON output contract.
- ✓ **Few-shot (Part B): 6 hand-written examples** (`fewshot/{meth-apr,aave-tvl}-{1,2,3}.json`), 3 regimes each (calm / trend+catalyst / high-variance|regime-break), teaching calibration discipline. `loadFewShot` filters by category. Verified 3+3 load.
- ✓ SEED_MODE auto-flip (same as ARIMA), register.ts (§8.1.1 metadata → IPFS/data-URI → register 0.1 MNT → AGENT_ID to .env). Default model `deepseek/deepseek-chat-v3.1` (OPENROUTER_MODEL override).
- ✗ NOT run live: needs deployed addresses + funded key + OPENROUTER_API_KEY (+ optional PINATA_JWT/CRYPTOPANIC_TOKEN/live indexer). OpenRouter call path unexercised (no key this session). Hosting deferred.
- Next: live register + run once Prompt 7 Part C deploys; then Prompt 11 (refresher + frontend wiring).

### agents/refresher (Prompt 11 Part D)
- ✓ `src/{config,index}.ts` + `.env.example`. `tsc` clean, dist emitted.
- ✓ Loop (default 5 min ≈ 150 blocks) calls `CompositeFeed.refresh(categoryId)` for both categories. `--once`/`REFRESH_ONCE` single-shot mode for Vercel/GH-Actions cron. Idempotent: simulates first, catches `RateLimited()` (custom errors in ABI so viem decodes by name) and logs skip. CompositeFeed addr from `ADDR_COMPOSITE_FEED` env → deployments JSON.
- ✗ NOT run live: needs `REFRESHER_PRIVATE_KEY` (separate hot wallet) + deployed CompositeFeed. Hosting choice (Vercel/GH-Actions/Railway) deferred.

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
| `tsc` agents/sdk (full impl) | ✓ clean, dist emitted | 2026-05-29 |
| `tsc` agents/arima-baseline (full impl + register) | ✓ clean, dist emitted | 2026-05-29 |
| `tsc` agents/deepseek-reasoner (full impl + register) | ✓ clean, dist emitted | 2026-05-29 |
| deepseek-reasoner few-shot load (3+3) | ✓ | 2026-05-29 |
| `tsc` agents/refresher (full impl) | ✓ clean, dist emitted | 2026-05-29 |
| `next build` (frontend, post live-wiring, mock mode) | ✓ 6 routes, TS pass | 2026-05-29 |
| `forge test` (full suite, post Prompt 12) | ✓ 147/147 pass | 2026-05-29 |
| `next build` (frontend, post Prompt 12 decision panel) | ✓ 6 routes, TS pass | 2026-05-29 |
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
| 5 | DeepSeek reasoner produces bland predictions in cold-start | Hand-written few-shot examples Day 9 (PRD §8.3 mandate). |
