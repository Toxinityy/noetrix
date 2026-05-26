# CLAUDE.md — Predictor Index Project Masterdoc

> This file is the single onboarding artifact for any new Claude Code (or other agent) session working on the **Predictor Index** hackathon project. Read it top to bottom before doing anything else in this directory. It captures: what we're building, what state the project is in, decisions already made, and what's been ruled out. It is updated by every session that materially changes the project. **Do not delete history sections — append, don't overwrite.**

---

## 0. Quick orient

- **Project:** Predictor Index — on-chain AI agent forecasting protocol on Mantle Network
- **Hackathon:** The Turing Test Hackathon 2026 (Mantle × Bybit × Byreal × BGA)
- **Tracks:** AI Alpha & Data (primary), Grand Champion (stretch)
- **Build window:** 2 weeks
- **Team size assumption:** 1–3 builders
- **Working dir:** `D:\Hackathon\mantle-hackathon`
- **Primary user:** williamask17@gmail.com

### Files in this directory
| File | Purpose | Owner |
|------|---------|-------|
| `README.md` | The full PRD (currently v2.1). Source of truth for product spec. | Hand-authored, patched by review sessions. |
| `Prompt.md` | Sequenced Claude Code prompt series (v2.1). Drives the build prompt-by-prompt. Must stay in sync with README.md. | Same as README. |
| `CLAUDE.md` | This file. Project context + history for new sessions. | Every session appends. |

When `README.md` and `Prompt.md` disagree, **README.md wins** and `Prompt.md` is the bug.

---

## 1. What we're building (one paragraph)

A protocol where AI agents register on-chain identities (ERC-8004 soulbound NFTs), submit verifiable forecasts on Mantle ecosystem metrics (mETH APR, Aave-Mantle TVL), have their predictions auto-scored against on-chain truth via CRPS, accumulate accuracy + calibration reputation per category, and contribute to an ensemble composite feed that Mantle protocols subscribe to. Revenue model: subscription tier ($500–$2,000/mo per protocol) on the composite feed. Hackathon scope ships two categories, two reference agents (ARIMA baseline + Claude reasoner with on-chain reasoning traces via IPFS), a demo consumer contract, and a Bloomberg-terminal-aesthetic frontend.

---

## 2. Architecture at a glance

```
FRONTEND (Next.js 14)  ──┐
INDEXER (Ponder)        ─┤
                         └─→ MANTLE NETWORK (L2)
                                AgentRegistry (ERC-8004 + topAgents)
                                  ↓
                                PredictionMarket (commit-reveal + escrow)
                                  ↓
                                ResolutionEngine ──► per-category resolvers
                                  ↓                  (MethApr, AaveMantleTvl)
                                ScoringEngine ──► RangeCrpsScorer
                                  ↓
                                BonusDistributor (pull-claim)
                                  ↓
                                CompositeFeed ──► SubscriptionGate
                                  ↓
                                DemoFeedConsumer (example)
                         ↑
AGENTS (off-chain Node)──┘
  arima-baseline
  claude-reasoner (demo highlight)
  refresher (cron: calls CompositeFeed.refresh)
```

Contract count: 9 production + 2 mocks. See README.md §16 for repo layout.

---

## 3. Key invariants and design decisions

These are NOT in the PRD as headlines but matter for any session touching the code. Treat as load-bearing.

| # | Invariant / decision | Where spec'd | Why |
|---|----------------------|--------------|-----|
| 1 | **Stake conservation:** `resolver_reward + returned_to_agent + slashed_to_pool == stake`. Resolver paid FIRST. | §7.2.4 | v1 had subtraction-order bug that overpaid by 2%. Patched in v2.1. Add an assert in ScoringEngine. |
| 2 | **Scorer registry single source:** ResolutionEngine owns `scorers` mapping; ScoringEngine does NOT. ScoringEngine receives scorer addr as `applyScore` param. | §7.3, §7.4 | Prevents two-mapping drift. |
| 3 | **BonusDistributor is PULL-claim, not push-iterate.** `finalizeEpoch` closes the epoch (anyone), then each agent calls `claimBonus`. No loop over agents anywhere. | §7.2.4 | Gas DoS at scale otherwise. |
| 4 | **`topAgents[categoryId]` lives in AgentRegistry**, sorted by accuracyScore desc, tiebreak lower agentId, gated by `resolvedCount >= 10`. Maintained via insertion sort inside `_updateTopAgents` called from every `updateReputation`. | §7.1 | Caps CompositeFeed.refresh enumeration. Migrate to indexer-driven in v2 (note in §15). |
| 5 | **Commit-reveal with 200-block submission cutoff.** Stops last-moment fitting near resolution. Reveal window: `[commit+10, min(commit+100, resolutionBlock-200)]`. | §4.2, §7.2.5 | Front-running mitigation. |
| 6 | **Foundry only.** No Hardhat. | §7 intro | Scope cut. |
| 7 | **Mantle block time = 2 seconds.** All time/block conversions assume this. 100 blocks ≈ 3.3 min. 43200 blocks ≈ 24h. 1000 blocks ≈ 33 min (epoch). | §13, §7.2.4 | Verify against Mantle docs before mainnet. |
| 8 | **CompositeFeed refresh trigger = external cron** (every 5 min ≈ 150 blocks). Lives at `agents/refresher/`. Manual button on `/demo-consumer` as fallback. | §7.5.3 | Permissionless refresh has no caller incentive in v1. |
| 9 | **SEED_MODE auto-flip = indexer poll on `resolvedCount`** (>=50) OR 48h elapsed. State persisted to local `agent.state.json`. | §8.2 | Avoids backdating, gives demo-day-ready leaderboard. |
| 10 | **Calibration is a CRPS-derived proxy**, not strict Brier decomposition. Documented in glossary §3. Be ready for stats-literate judges. | §3, §7.4.2 | Honest spec naming. |
| 11 | **Composite confidence clamps per-agent calibration at -0.5** before averaging into the multiplier. One badly-calibrated agent can't crater the feed. Multiplier ∈ [0.5, 1.0]. | §7.5.1 | Outlier resistance. |
| 12 | **0.1 MNT registration fee** → treasury. Sybil deterrent + initial bonus pool seed. | §7.1 | |
| 13 | **Few-shot examples for Claude reasoner are hand-written Day 9 deliverables**, NOT auto-generated. Live at `agents/claude-reasoner/fewshot/`. | §8.3 | Cold-start quality matters for demo. |
| 14 | **Subscription gate is built but open in v1.** Architectural proof, not enforced. Be prepared to justify "why not enforce" to judges. | §7.6 | |

---

## 4. Scope cuts (do NOT add these back without user approval)

These were explicitly cut from hackathon scope in v2/v2.1. They live in §14 of PRD.

- StakingPool (user staking on agents) — stretch in v1, cut in v2
- Third agent (specialized-quant)
- Third category (MNT_PRICE_7D — oracle integration too risky)
- Hardhat (Foundry only)
- /category, /submit, /about pages as Day-13 mandatory (ship only if polish allows)
- Cross-chain feed reads
- ZK-private predictions
- Python SDK
- Binary event categories
- Slashing on bad reasoning ("Proof-of-Reasoning Vault" = separate project)
- Multi-language frontend
- Mobile-native app

If a future session is tempted to add any of these, push back to the user first.

---

## 5. Current build state

### As of 2026-05-25 (project bootstrap session)
- **Code:** None. Empty directory aside from `README.md`, `Prompt.md`, `CLAUDE.md`.
- **Contracts deployed:** None.
- **Agents running:** None.
- **Frontend:** None.
- **Indexer:** None.

**Next action:** User to start Prompt 0 of `Prompt.md` in a fresh Claude Code session inside this dir.

(Future sessions: when you change build state, append a new dated entry below this one. Do not edit prior entries.)

---

## 6. Session history

### 2026-05-26 — GSAP ScrollTrigger pin (FlowArt) replaces scroll-snap
**Type:** Build (landing UX correction round 2)
**Touched files:** `frontend/package.json` (gsap, @gsap/react), `frontend/src/components/ui/story-scroll.tsx` (new), `frontend/src/app/globals.css` (removed scroll-snap rules), `frontend/src/app/page.tsx` (rewrite to FlowArt + StoryFrame wrapper), `frontend/src/components/landing/{Hero,LivePulse,ReasoningReveal,LeaderboardPreview,HowItWorks,Footer}.tsx` (outer class: `h-full overflow-y-auto` → `min-h-screen flex-1` so children fill FlowSection's min-h-screen container)

**What happened:**
- User wanted the "sticky / stop" feel and provided a 3rd-party GSAP ScrollTrigger pattern (`story-scroll.tsx` from a designali-in template). Requirement: don't change existing landing content.
- Installed `gsap@3.15.0` + `@gsap/react@2.1.2`.
- Pasted `story-scroll.tsx` verbatim at `components/ui/`. It exports `FlowArt` (default) and `FlowSection`. FlowArt registers ScrollTrigger, queries `[data-flow-section]` + `.flow-art-container`, then:
  - sets z-index per index so later sections overlay earlier
  - tweens inner from `rotation: 30deg` (bottom-left origin) → `0deg` over `top bottom` → `top 25%`
  - pins every non-last section from `bottom bottom` → `bottom top` with `pinSpacing: false`
- Built `StoryFrame` wrapper in `page.tsx` that emits the required DOM markers without the FlowSection demo's content-layout opinion (`flex justify-between gap-6 px-[4vw] pt-[clamp(...)] pb-[4vw]`). This keeps each landing component's own styling untouched.
- Removed `scroll-snap-type` and `scroll-behavior` from `globals.css` — they fought GSAP's programmatic scroll handling.
- Adjusted each landing component's outer `<section>` from `h-full overflow-y-auto` to `min-h-screen flex-1` so it correctly fills FlowArt's `min-h-screen` parent (h-full on a child needs an explicit height on the parent; flex-1 + min-h-screen works inside the FlowArt flex column).

**Why this and not CSS scroll-snap:**
- User reported "no sticky effects" with the snap approach — scroll-snap fires the snap then releases, no visible pin/overlap moment.
- GSAP pin physically holds the section in place while the next one transforms in over it. The visual "stop" is unmistakable.
- GSAP also honors reduced-motion (the effect short-circuits inside `useGSAP` when the media query matches).

**Trade-offs accepted:**
- Bundle size: gsap + @gsap/react adds ~70 KB gz. Acceptable for a landing-heavy page.
- ScrollTrigger refresh on resize / layout changes is built into the library — no manual wiring needed.
- Hero is now the FIRST FlowArt section, so it doesn't pin (only non-last sections pin). Means Hero scrolls away normally as section 2 enters. That matches user's "section 2 onwards" framing.

### 2026-05-26 — Scroll-snap stops (replace sticky page-stack)
**Type:** Build (landing UX correction)
**Touched files:** `frontend/src/app/globals.css`, `frontend/src/components/landing/SlideSection.tsx` (rewrite), `frontend/src/app/page.tsx`

**What happened:**
- User: "I don't see any sticky effects … I want section 2-footer to have a Stop animation triggered only by mouse-scrolling."
- Diagnosed: previous SlideSection used very long scrollBudget (140-180vh per section) with sticky pin — the transitions were smooth but lacked the discrete "stop" feel of an awwwards scroll-snap page.
- Rewrote: each `SlideSection` is now one viewport tall (`h-svh`), gets `snap-start snap-always`, and `html` was given `scroll-snap-type: y mandatory` in globals.css. The browser locks scroll position to each section boundary; wheel/touch flicks advance one stop at a time.
- Slide animation still plays during the snap transition because Motion's `useScroll({ offset: ['start end', 'end start'] })` tracks the section's progress through the viewport — when the snap interpolates the scroll position, the motion values update in lockstep.
- Added `filter: blur(0→14px)` to the entrance/exit so the animation reads as a clear focus pull (in addition to y/opacity/scale).
- `prefers-reduced-motion`: scroll-snap disabled (`scroll-snap-type: none`) so the user gets normal smooth scroll without forced stops. Inner motion transforms also collapse (y/scale → 0, blur → 0).

**Why scroll-snap and not custom wheel-jacking:**
- CSS scroll-snap is browser-native — handles wheel, touch, keyboard, and accessibility correctly without intercepting events.
- Wheel-jacking breaks keyboard nav, screen readers, and pinch-zoom.
- The "stop" feel is achieved cleanly with `snap-mandatory` + `snap-always` (the latter forces a stop at every snap point, not just the closest).

**Caveats:**
- Sections with `overflow-y-auto` (LivePulse, ReasoningReveal) allow internal scroll when content exceeds `h-svh` on small viewports. Internal scroll consumes wheel events before snap engages — so on narrow phones, the user may need to flick twice to advance. Acceptable for now; address in Prompt 11 polish (make sections truly fit 100svh).
- iOS Safari has had snap glitches historically — test on real device before submission.

### 2026-05-26 — Cursor interactivity + page-stack scroll
**Type:** Build (landing polish)
**Touched files:** `frontend/src/components/landing/Hero.tsx` (rewrite), `frontend/src/components/landing/SlideSection.tsx` (new), `frontend/src/app/page.tsx`, `frontend/src/components/landing/{LivePulse,ReasoningReveal,LeaderboardPreview,HowItWorks,Footer}.tsx` (outer wrapper class adjustments)

**What happened:**
- User wanted (a) cursor interactivity in Hero and (b) overlapping page-stack scroll (each section slides up, next emerges from bottom).
- **Hero cursor interactivity:**
  - Detects hover-capable input via `matchMedia("(hover: hover) and (pointer: fine)")`. Touch devices skip all cursor effects.
  - Tracks cursor pixel position (relative to section) via `useMotionValue`, spring-smoothed via `useSpring` (350/38 for pixel, 180/32 for percentage).
  - **Spotlight lens:** a second `DitheringShader` instance (shape `ripple`, faster speed 1.4) sits beneath a `radial-gradient` mask (`useMotionTemplate`) that follows the cursor. Mix-blend `screen`. Reveals only a ~340px circle of intensified swirl beneath the cursor.
  - **Cursor follower:** absolute 48px ring (teal border, mix-blend screen, glow shadow) tracking spring-smoothed pixel coords, plus a 6px solid dot tracking raw coords (so the dot feels instant, the ring lags slightly = "trailing" feel). System cursor hidden over hero (`cursor: none` while hovering).
  - **Magnetic title:** title block subtly offsets toward cursor (max ±12px x, ±8px y).
  - **Char hover:** each title `<motion.span>` has `whileHover` that lifts the char 8px and tints it teal. CTAs also scale on hover/tap.
  - All cursor effects honor `useReducedMotion()` (offset → 0, scales unchanged).
- **Page-stack scroll (`SlideSection`):**
  - Each section is wrapped in a `relative h-{scrollBudget}vh` container with `z-index` set to `index + 1` (later sections overlay earlier).
  - Inside, a `sticky top-0 h-svh overflow-hidden` pin holds the section visible while the user scrolls through the budget.
  - Inner content (`motion.div`) gets scroll-tied `y` / `opacity` / `scale` based on the section's own scroll progress (`useScroll({ target: ref, offset: ['start end', 'end start'] })`).
  - Entrance: 0 → 0.32 of progress (slide in from 8vh below + fade in + scale 0.96→1).
  - Hold: 0.32 → 0.68.
  - Exit: 0.68 → 1 (slide up -12vh + fade out + scale 1→0.97).
  - Per-section overrides: `noEntrance` (first section appears instant on load) and `noExit` (last section stays pinned, no fade out).
- **page.tsx** composes Hero (index 0, noEntrance), LivePulse (1), ReasoningReveal (2), LeaderboardPreview (3), HowItWorks (4), Footer (5, noExit).
- **Existing sections** had `py-32` and no fixed height, so they overflowed the new `h-svh` sticky pins. Adjusted each section's outer `<section>` className to `flex h-full ... flex-col justify-center overflow-y-auto px-6 py-20` — content vertically centers within viewport, with internal scroll as a safety net for tall content on small screens.

**Decisions:**
- Built `SlideSection` as a generic wrapper rather than refactoring each section's internal markup. Keeps existing components intact; the wrapper is opt-in.
- Used `useMotionTemplate` for the spotlight mask — required because CSS doesn't accept raw motion values, only strings. Tags both `WebKitMaskImage` and `maskImage` for Safari + standard.
- Hid the system cursor over the hero only while hovering. CTA links remain `pointer: auto` because they don't change cursor at the section level — and clicking is unaffected.
- Hero's previous scroll-fade (`titleY`/`gridY`/`ringOpacity` driven by hero-internal `useScroll`) was removed because `SlideSection` now handles the entire section's fade/scale on scroll. Without removal, the two scroll-driven motions would compound and feel jittery.

**Risks / followups:**
- Page is now significantly taller in document flow (~960vh total). Mobile scroll feel may need throttling — verify on phone.
- Spotlight shader (2nd WebGL context) may impact GPU on low-end devices. Could conditionally render at higher device tiers.
- Internal section padding (`py-20`) may not fit content on `iPhone SE`-sized viewports for the more text-heavy sections (LivePulse, ReasoningReveal). `overflow-y-auto` is the safety valve but ugly. Address at Prompt 11 polish.

### 2026-05-26 — Hero ambient WebGL shader (DitheringShader)
**Type:** Build (landing enhancement)
**Touched files:** `frontend/src/components/ui/dithering-shader.tsx` (new), `frontend/src/components/landing/Hero.tsx`, `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- User dropped a 3rd-party WebGL2 dithering-shader component (designali-in/dithering-shader) and asked for Hero integration matching theme.
- Tech alignment: project does not use shadcn (uses Radix direct per PRD §9.1 v2.2), so `@/lib/utils` was substituted with our `@/lib/cn`; component placed at `frontend/src/components/ui/dithering-shader.tsx` (the `ui/` folder is just a naming convention here, not shadcn-tied).
- Component improvements over the template:
  - Added `fill` prop that resizes canvas to fill its parent via `ResizeObserver`.
  - DPR-aware sizing (capped at 2× to keep GPU load reasonable).
  - `speed === 0` renders one static frame instead of skipping all draws.
  - Cleaner cleanup (ResizeObserver disconnect + program delete on unmount).
- Hero integration:
  - Deepest layer (`-z-30`), `pointer-events-none`, `aria-hidden`, behind grid + glow ring.
  - Theme-matched: `shape="swirl"`, `type="4x4"`, `colorBack="#050607"` (matches `--color-bg`), `colorFront="#33EAB3"` (Mantle teal), `pxSize=3`, `speed=0.55`.
  - `mix-blend-mode: screen` so the swirl reads as additive light on the dark substrate.
  - `useReducedMotion()` → `speed=0` (renders one static frame, no animation loop) for accessibility.
  - Scroll-driven `opacity` (`0.45 → 0` over the hero's scroll progress) so it gracefully exits as the user scrolls into the data sections.

**Decisions:**
- Did NOT create a `@/lib/utils` (shadcn-style) — kept `@/lib/cn` as our single class-merge helper. If a future copy-paste imports `@/lib/utils`, swap to `@/lib/cn` at integration time.
- Did NOT introduce a `/components/ui/` shadcn registry — `ui/` here just holds 3rd-party visual primitives. Our app shells stay in `components/landing/` (and future `components/dashboard/` for terminal-core).

### 2026-05-26 — Cinematic landing page (frontend kickoff)
**Type:** Build (out-of-sequence — landing built before Prompt 3 PredictionMarket on user request)
**Touched files:** `frontend/src/app/{layout,page,globals.css}.tsx`, `frontend/src/lib/cn.ts`, `frontend/src/components/landing/{Nav,Hero,LivePulse,ReasoningReveal,LeaderboardPreview,HowItWorks,Footer}.tsx`, `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- User wanted to see frontend before continuing contracts work. Built the full cinematic landing per PRD §9.3 v2.2 (hybrid aesthetic) with Motion v12 (formerly Framer Motion).
- Layout: switched from Geist to Inter + JetBrains Mono via `next/font/google` with CSS variables. Dark theme is the default; no light theme yet.
- `globals.css`: defined design tokens as CSS custom properties (`--color-bg`, `--color-bg-elev-1/2`, `--color-border`, `--color-text*`, `--color-accent` Mantle teal, `--color-up/down/warn`); registered them via Tailwind v4 `@theme inline`. Added `.num` / `.tabular` utility for `font-variant-numeric: tabular-nums`; `.bg-grid` / `.bg-grid-fine` for hero parallax background; `.mask-radial-fade` for hero grid edge fade; global `prefers-reduced-motion` override.
- 6 client components in `src/components/landing/`:
  - **Nav** — fixed, `useScroll` drives `backdrop-filter`/`background`/`border` motion values; nav links + "Live feed" CTA.
  - **Hero** — `useScroll(target=ref)` drives title `y`/`opacity`, subtitle `y`, parallax grid `y`, glow ring `scale`/`opacity`. Title is char-by-char `motion.span` stagger with `blur(12px)→0` filter transition; last char of "INDEX" colored teal. Sub-elements (ticker breadcrumb, CTAs, corner meta) have entrance transitions.
  - **LivePulse** — `useAnimationFrame` synthesizes a moving composite-feed value; SVG draws an animated band + main + dashed secondary path; pulsing latest-dot uses repeating `r`/`opacity` cycle; stats panel shows live `displayValue` via `useMotionValue` + `useTransform`.
  - **ReasoningReveal** — `useScroll` (target=ref) drives `x`/`opacity` on the card; 4-step trace renders with `whileInView` stagger; sidebar shows parsed JSON forecast + realized value + CRPS score.
  - **LeaderboardPreview** — terminal-aesthetic table, row stagger on viewport enter; mock data.
  - **HowItWorks** — 5-step grid, viewport stagger.
  - **Footer** — static, info-dense, three columns.
- All Motion components honor `useReducedMotion()` — animations collapse to no-op when user requests reduced motion. CSS also overrides globally.
- Verified: `GET / 200 OK in 254ms` (hot reload), 2 occurrences of "Predictor" in HTML.

**Decisions during landing build:**
- All data is hand-written mock. Real indexer wire-up is Prompt 11's responsibility.
- Used Motion v12 import path: `from "motion/react"` (Motion's React-bindings package). NOT `framer-motion`.
- Kept hero readable on 375px (sr-only fallback for the kinetic title's screen-reader text).
- No wagmi `WagmiProvider` mounted yet — would require a client root and chain config; deferred to Prompt 11.

**Open / deferred items:**
- Remove redundant `frontend/pnpm-workspace.yaml` that `create-next-app` added (currently triggers Next.js multi-lockfile warning).
- Set `turbopack.root` explicitly in `next.config.ts`.
- Build `/agent/[id]` + `/demo-consumer` pages.
- Mount a wagmi + TanStack Query root layout once Prompt 7 deploys + addresses are known.

### 2026-05-26 — Prompt 2 (AgentRegistry)
**Type:** Build (Prompt 2)
**Touched files:** `contracts/src/AgentRegistry.sol`, `contracts/src/interfaces/IAgentRegistry.sol`, `contracts/test/AgentRegistry.t.sol`, `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- Implemented AgentRegistry per PRD §7.1: ERC-8004 soulbound NFT (OZ ERC721 base, `_update` reverts on transfer), 0.1 MNT registration fee forwarded to treasury, 24h controller rotation timelock (two-step propose+execute), per-agent per-category `Reputation` struct (with `bucketAccuracy[10]` / `bucketCount[10]`), `topAgents[categoryId]` fixed-size top-20 array, `_updateTopAgents` internal insertion-sort (sort by accuracyScore desc, tiebreak lower agentId, gated by `resolvedCount >= 10`).
- `onlyScoringEngine` modifier with admin-set `scoringEngine` address.
- Controller rotation: rotates the off-chain authority handle in `_agents[id].controller` and `controllerToAgent` mapping. The ERC721 token itself stays at original minter address — preserves "soulbound to identity" without breaking ERC721 invariants.
- Tests: 28 cases covering register (zero fee, wrong fee, happy path, monotonic IDs, controller-already-bound), soulbound (transfer / safeTransfer / approve+transfer all revert), rotation (happy, before timelock, non-controller propose, zero new controller, same controller, already-bound new controller, no pending), reputation auth (non-ScoringEngine reverts, all fields apply), topAgents (qualifies-only-after-min, sorts desc, tiebreak lower id, eviction beyond 20, repositions on rescore, never duplicates, insertion at bottom + handles below-threshold + handles new top entry), fuzz monotonic IDs.
- Bug fix during test run: test helper `_registerN` used `0x1000 + i` per call → cross-call address collision triggered ControllerAlreadyBound on the second `_registerN` invocation. Fixed by promoting to instance `_ctrlNonce` counter.
- Coverage: lines 94.5% / statements 90.7% / functions 93.3% / branches 68% on `AgentRegistry.sol`. Branch gap = `if (!ok) revert TransferFailed()` (treasury call always succeeds for EOA mock), the `from == 0 && to == 0` impossible path in `_update`, and a couple of revert tail paths.

**Decisions during Prompt 2:**
- Used a separate `IAgentRegistry` interface in `src/interfaces/` (anticipates ScoringEngine + CompositeFeed dependency).
- `controllerToAgent` is also `public` (auto-getter); callers can read directly.
- `tokenURI` returns the `metadataURI` from `AgentProfile` directly — no JSON wrapping. Matches PRD §8.1.1 which says metadata is IPFS-pointed.
- Did NOT implement `ERC2981` (royalties) or `ERC721Enumerable` — out of scope.
- Lint warning on `block.timestamp` for the timelock: accepted (24h window, manipulation bounded to seconds, not exploitable).

**Open items rolling forward:**
- ScoringEngine must call `AgentRegistry.updateReputation(...)` with the full `bucketAccuracy[10]` + `bucketCount[10]` arrays it computed. Calldata size is small (10 × int256 + 10 × uint256 = 640 bytes). No optimization needed.
- ResolutionEngine may want to read `controllerOf(agentId)` to know who got the resolver-reward credit before settling stake. Already exposed.

### 2026-05-26 — Prompt 1 (in-progress) + frontend stack pivot v2.1 → v2.2
**Type:** Build (Prompt 1) + spec patch
**Skill:** superpowers:brainstorming, ui-ux-pro-max (consulted, not executed)
**Touched files:** `README.md` (v2.1 → v2.2), `Prompt.md` (v2.1 → v2.2), `CLAUDE.md` (this entry), root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `README.workspace.md`, `contracts/` (forge init + OZ install + foundry.toml + remappings + subdirs)

**What happened:**
- Installed foundry (forge 1.7.1) via foundryup; added `C:\Users\William A\.foundry\bin` to user PATH (persistent).
- Initialized pnpm workspace at root (Node 22.20, pnpm 10.33). Workspace covers frontend, indexer, agents/{sdk,arima-baseline,claude-reasoner,refresher}. Note: `refresher/` added to workspace list now (it ships in Prompt 11).
- Scaffolded `contracts/` with `forge init --no-git`, installed OpenZeppelin contracts v5.6.1, removed template Counter.sol files, wrote `foundry.toml` (Solidity 0.8.24, cancun, optimizer 200, mantle_sepolia + mantle_mainnet RPC endpoints + Mantlescan etherscan config), `remappings.txt`, `contracts/package.json`, and the subdir tree per PRD §16 (`src/{interfaces,resolvers,scorers,mocks,examples}`, `test/reference`, `deployments/`, `config/`).
- Kept existing `README.md` (PRD) untouched at root; placed workspace package index at `README.workspace.md` to avoid clobbering the PRD. **Open question:** consolidate later (e.g., rename PRD to `docs/PRD.md` and make `README.md` the GitHub README per Prompt 13 Part D).
- **Frontend stack pivot (PRD §9 patched):** User pushed back on shadcn/ui (concern: limited customization for awwwards-tier aesthetic). Discussed tradeoffs honestly — shadcn is copy-paste Radix, not rigid. Settled on: Radix UI primitives directly (no shadcn CLI) + Tailwind + Motion (formerly Framer Motion). Aesthetic direction also changed from pure Bloomberg-terminal to hybrid: terminal core (data surfaces) + cinematic landing (hero on `/`). Patched README §9.1, §9.3 and Prompt.md Prompt 1 + Prompt 11 + Prompt 13. Bumped both docs to v2.2.

**Still in-progress / blocked on user decision:**
- Frontend scaffold method (create-next-app full vs manual vs defer).
- Indexer scaffold method (create-ponder vs manual vs defer).
- Agents subpackages (just placeholders for now or full TS package.json each).
- After scaffold: verify `forge build` and `pnpm install` both run clean.

**New invariants to add to §3 next time it's edited:**
- **No shadcn/ui.** Use Radix UI headless primitives directly + Tailwind + Motion. Reason: visual control for cinematic landing; shadcn pre-styled wrappers fight the aesthetic.
- **Hybrid aesthetic.** Terminal core (data tables, charts) ≠ cinematic landing (hero only). Don't mix on same surface. `prefers-reduced-motion` falls cinematic back to static.
- **Type pair:** Inter (UI) + JetBrains Mono (numbers, addresses, hashes) via next/font. No other fonts.

### 2026-05-25 — Bootstrap + PRD v2.1 patches
**Type:** Brainstorm / review
**Skill:** superpowers:brainstorming
**Touched files:** `README.md` (v2 → v2.1), `Prompt.md` (v2 → v2.1), `CLAUDE.md` (created)

**What happened:**
- Read `read.me` (legacy v1 prompt series), then user-supplied `README.md` v1, gave critical review.
- User produced `README.md` v2 + `Prompt.md` v2 incorporating most v1 feedback (stake math, calibration, rank-based weighting, commit-reveal, scope cuts, revenue model).
- Reviewed v2; found 15 residual issues (5 critical, 4 medium, 6 minor).
- User authorized patches. Applied critical + medium fixes inline, bumped both files to v2.1.
- Created this masterdoc.

**Open items / risks carried forward:**
- Verify Mantle Sepolia + mainnet block time really is 2s (not 3s) — affects every block-window calculation in the PRD.
- Confirm DoraHacks submission form actually has a "Grand Champion nomination" field.
- Confirm Aave-on-Mantle is live and has reserves to read at build time. Contingency: `INIT_CAPITAL_TVL_24H`.
- Decide whether refresher cron lives in Vercel cron, GitHub Actions, or Railway. Pick before Prompt 11.
- Verify mETH contract exposes historical exchange rate queryable at arbitrary block — if not, fall back to MockMethRateOracle pattern.

**Decisions NOT taken (still open):**
- Hot-key handling for the refresher cron — env-var? KMS? Just a `.env` file for hackathon?
- Whether to record on-chain a hash of every Claude prompt + response, or just store via IPFS hash in contentHash. Currently spec leans IPFS-only; on-chain hash is cheap, consider adding.
- Whether `/about` page should embed live stream during AI Awakening (PRD §9 hints at it; not in must-have list).

---

## 7. How a new session should boot

Concrete checklist for any new Claude session in this dir:

1. **Read in order:** `CLAUDE.md` (this file) → `README.md` → `Prompt.md`.
2. **Confirm understanding** by checking the invariants in §3 of this file are reflected in current PRD.
3. **Check session history (§6)** for what was last touched and what's open.
4. **If user asks "where are we":** answer using §5 (current build state) + §6 (last session).
5. **If user is starting build:** they paste Prompt 0 from `Prompt.md` to begin.
6. **If user wants to change spec:** make patches to `README.md`, then propagate to `Prompt.md`, then append a session entry to §6 of this file.
7. **If you delete or skip a scope item:** make sure it's listed in §4. If not, ask the user.
8. **Always end the session by appending to §6** with what changed.

---

## 8. Anti-patterns observed (learn from these)

- **Don't trust read.me.** It's the legacy v1 prompt series and contradicts v2.1 PRD in places (e.g., agent count, third category). Use `Prompt.md` instead.
- **Don't reintroduce push-distribution to BonusDistributor** — it was explicitly switched to pull for gas DoS reasons.
- **Don't write `softmax(accuracy × calibration)`** anywhere — it has a sign-flip bug. CompositeFeed uses rank-based weighting only.
- **Don't compute `realized_accuracy = score / 1e6`** raw — it's signed. Use `(score_norm + 1) / 2` to map to [0, 1] per §7.4.2.
- **Don't add a top-N agent enumeration loop** outside AgentRegistry's `_updateTopAgents`. CompositeFeed reads the array, doesn't sort.
- **Don't backdate predictions.** Use SEED_MODE short windows. Backdating was rejected in v2.

---

## 9. Glossary one-liners (so you don't have to re-read §3 of PRD)

- **Agent:** off-chain AI controlled by `controller` wallet, identified by ERC-8004 NFT.
- **Category:** prediction class with own resolver + scorer + min stake.
- **Commit-reveal:** two-phase submission. Commit hash on-chain, reveal value 10–100 blocks later.
- **EMA α = 0.1:** all reputation updates use this exponential moving average weight.
- **Epoch:** 1000 blocks ≈ 33 min on Mantle. BonusDistributor pools per (categoryId, epoch).
- **Top-20:** AgentRegistry's per-category sorted list of qualifying agents. Used by CompositeFeed.
- **CRPS:** Continuous Ranked Probability Score. Closed form for uniform-over-bucket vs point-mass outcome.
- **Calibration:** -|stated_confidence_midpoint - realized_accuracy|² weighted across confidence buckets, mapped to [-1e6, 0].

---

**End of CLAUDE.md.**
