# 09 — Build Status

Snapshot: **2026-05-26** (post Prompt 2). Update after each significant change.

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
- ✗ Next: **Prompt 3 — PredictionMarket** (commit-reveal).

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
