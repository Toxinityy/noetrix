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

### 2026-05-29 — Prompt 12 (DemoFeedConsumer business logic + local full-pipeline E2E + frontend decision panel); live deploy/screenshots pending creds
**Type:** Build (Prompt 12 — Part A consumer views + deterministic E2E test; live deploy + visual screenshots blocked on creds)
**Touched files:**
- `contracts/src/examples/DemoFeedConsumer.sol` (extend) — added Part A business-logic views.
- `contracts/test/EndToEnd.t.sol` (extend) — added `test_FullPipeline_FeedDrivesConsumerDecisions` + 2-agent multi-cycle helper.
- `frontend/src/lib/contracts.ts` (extend) — `demoConsumerAbi` + `DEMO_THRESHOLDS`.
- `frontend/src/app/(app)/demo-consumer/DemoConsumerClient.tsx` (extend) — protocol-decision panel + `DecisionCard`.
- build-status, CLAUDE.md.

**What happened:**
- **DemoFeedConsumer (Part A)**: added `getCurrentMethApr()`/`getCurrentAaveTvl()` → (value, confidence); `shouldAllowDeposits()` → mETH APR forecast > 400 bps; `shouldThrottleRisk()` → Aave-Mantle TVL forecast < $500M (500e6·1e8 USD 8-dec). Category ids + thresholds as public constants. Kept the prior `latest`/`valueFresh`. An unset/zero TVL feed reads as 0 → throttle true (documented safe default). `forge build` clean.
- **End-to-end test (Part B, local substitute)**: `test_FullPipeline_FeedDrivesConsumerDecisions` drives the *whole* chain deterministically — 2 agents register, each runs 10 commit→reveal→resolve cycles (reaching the ≥10 resolved top-agent qualification), then each posts one more forecast left Revealed (active feed contributor), `CompositeFeed.refresh(METH)`, then asserts the consumer reads it: `getCurrentMethApr() ≈ 3650` bps (band [3600,3700] midpoint, 2 contributors, confidence > 0), `shouldAllowDeposits() == true` (3650 > 400), and `shouldThrottleRisk() == true` with the AAVE feed unset (0 < $500M). Proves registry→market→resolution→scoring→reputation→topAgents→CompositeFeed→DemoFeedConsumer. **Full suite 147/147** (was 146; +1).
- **Frontend (update to read the consumer)**: demo-consumer page now shows a "What this protocol decides" panel with two `DecisionCard`s (shouldAllowDeposits / shouldThrottleRisk) rendering the true/false decision + the rule + good/bad tone. Reads on-chain from `DemoFeedConsumer` (30s refetch) when `NEXT_PUBLIC_ADDR_DEMO_CONSUMER` is set, else derives the same decision client-side from the feed value via `DEMO_THRESHOLDS` (mirrors the contract constants). `next build` clean.

**Decisions:**
- **Local deterministic E2E instead of the live 1-hour run.** Prompt 12 Part B describes a live pipeline + screenshots — blocked on deploy + funded keys. The forge test is the faithful substitute: it exercises every contract hop including the top-agent gate (≥10 resolved) and the feed→consumer business logic, which the prior Prompt-7 EndToEnd (single agent, single round-trip) did not. Screenshots remain a post-deploy task.
- **Tested METH pipeline fully + AAVE via the safe-default path**, not a second full resolution pipeline. AAVE's resolver/scorer round-trip is already covered by `AaveMantleTvlResolver.t.sol`; re-running a 10-cycle AAVE qualification here would be redundant gas for no new coverage. `shouldThrottleRisk` is still meaningfully asserted (unset feed → 0 → throttle).
- **Frontend decision card has a client-side fallback** mirroring the contract thresholds, so the "true/false decision" demo surface renders even before `DemoFeedConsumer` is deployed (shows METH 3812 bps → deposits enabled; AAVE ~$142M → risk throttled). Source label flips to "on-chain" once the address is set.
- **No Deploy.s.sol change needed** — it already deploys DemoFeedConsumer (Prompt 7); the new views are additive.

**Risks / followups:**
- **Live deploy + visual screenshots NOT done — needs Prompt 7 Part C creds.** Required screenshots (Prompt 12 verify gate): leaderboard with ≥2 agents + ≥5 resolved; agent-detail with a Claude reasoning trace; demo-consumer showing a true/false decision. The decision panel + leaderboard are wired; the agent-detail reasoning trace is still mock (Part B wiring deferred from Prompt 11).
- **50+ resolved predictions** for the final verify gate come from running the agents in SEED_MODE ~24h post-deploy (ARIMA + Claude reasoner, Prompts 9/10).
- DemoFeedConsumer's $500M throttle floor + 400 bps deposit floor are illustrative; if the deployed category domains/scales differ materially from the demo data, revisit the thresholds so the decisions read sensibly on the live feed.

### 2026-05-29 — Prompt 11 (refresher cron + frontend live-wiring layer); live verify pending deploy
**Type:** Build (Prompt 11 — Part D refresher complete; frontend data/provider/wagmi layer + leaderboard/demo-consumer/Connect wired with mock fallback. `next build` clean; live data path unverified until contracts deploy + indexer runs)
**Touched files:**
- `agents/refresher/src/{config,index}.ts` (new), `agents/refresher/.env.example` (new).
- `frontend/src/lib/{env,contracts,wagmi,indexer,hooks}.ts` (new), `frontend/src/components/providers/Providers.tsx` (new), `frontend/.env.example` (new).
- `frontend/src/app/layout.tsx` (mount Providers), `frontend/src/components/app/AppHeader.tsx` (real Connect), `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx` (rewrite to hooks), `frontend/src/app/(app)/demo-consumer/DemoConsumerClient.tsx` (live read + real refresh).
- build-status, CLAUDE.md.

**What happened:**
- **Refresher (Part D)**: standalone Node app, viem clients. Loop (default 5 min ≈ 150 blocks) calls `CompositeFeed.refresh(categoryId)` for both categories. `--once` / `REFRESH_ONCE=true` for platform-managed cron (Vercel/GitHub Actions) — one pass then exit. Idempotent: simulates first, catches the expected `RateLimited()` revert (custom errors added to the ABI so viem decodes by name) and logs "skipped". CompositeFeed addr from `ADDR_COMPOSITE_FEED` env → deployments JSON. `tsc` clean, dist emitted.
- **Frontend data layer**: `env.ts` (NEXT_PUBLIC_* config + `hasIndexer`/`hasFeed` flags + explorer helpers); `contracts.ts` (`categoryHash` = keccak label, CompositeFeed read/refresh ABI + custom errors); `wagmi.ts` (createConfig, Mantle Sepolia chain from env, injected connector, ssr:true); `indexer.ts` (typed REST client → normalized `LeaderRow`/`LivePrediction`/`LiveFeedPoint`, decodes range bytes); `hooks.ts` (`useLeaderboard`/`useFeedHistory` — TanStack Query 30s refetch when `hasIndexer`, else **mock fallback**, also falling back to mock on live error/empty with an `isError` flag). `Providers.tsx` (WagmiProvider + QueryClientProvider) mounted in root layout.
- **Connect (AppHeader)**: real wagmi `useAccount`/`useConnect`/`useDisconnect`. Mounted-guard placeholder to avoid hydration drift; shows truncated address + disconnect when connected, "Connect" via injected connector otherwise.
- **Leaderboard (Part A)**: rewritten to consume `useLeaderboard`/`useFeedHistory`. Adds the three Part-A requirements the mock UI lacked: **calibrating badge** for `resolvedCount < 10` (in table + top-agent panel), **skeleton** while loading, **empty state** ("No agents yet — be the first to register"). Source pill shows Live vs Demo data. Top-agent panel + KPIs derive from live rows; composite snapshot card + sparkline from live feed history. Bonus-pool KPI still from mock epoch (not in indexer).
- **Demo-consumer (Part C)**: live `useReadContract` of `CompositeFeed.read` (30s refetch, decodes the abi.encoded point estimate) overrides the headline value/confidence/contributors/block when `hasFeed`. Manual **refresh button wired to `useWriteContract` → `CompositeFeed.refresh`**, with RateLimited caught and surfaced ("Rate-limited — wait ~100 blocks"). Mock 5s simulation now only runs when NOT live. Chart pulls live feed history when available. Addresses + explorer links from env.
- **`next build` clean**: 6 routes, TypeScript pass; only the pre-existing benign Recharts SSR width/height warning. With no env set (the build case), everything renders on mock exactly as before.

**Decisions:**
- **Mock fallback is the default + the build/no-env behavior.** Hooks return mock immediately when `NEXT_PUBLIC_INDEXER_URL` is unset, and fall back to mock (flagging `isError`) on a live fetch error/empty result. This keeps the site fully functional for judges before deploy and means `next build` validates the real code paths without needing infra. Live path activates purely by setting env — no code change.
- **Normalized `LeaderRow` shape instead of the rich mock `Agent`.** The indexer's reputations table only has accuracy/calibration/resolvedCount/lastUpdatedBlock (no name/kind/badges/equityCurve). Leaderboard now renders against `LeaderRow`; live agent "name" is `agent #<id>` and `kind` is inferred from the name (CLAUDE/ARIMA/ENSEMBLE/QUANT). The top-agent panel dropped the mock "equity ×" stat (replaced with last-update block) since equity isn't on-chain-derivable here. v2: fetch agent metadata (name/model) from IPFS via metadataURI for live display names.
- **Agent-detail + feed pages left on mock this session.** Part B's expandable reasoning trace is the demo moment but pulls the trace from IPFS (contentHash) — unverifiable without a live pin + deployed data, so wiring it now would be building blind. Hooks + indexer client are in place to wire them in one pass post-deploy.
- **Connect uses the injected connector only** (MetaMask/Rabbit/etc.). No WalletConnect projectId needed for the hackathon demo. ssr:true on the wagmi config + a mounted-guard on the button avoid Next hydration mismatches.
- **Refresher is dual-mode** (long-running loop OR `--once` for cron) rather than committing to one host. Decision on Vercel cron vs GitHub Actions vs Railway deferred (CLAUDE.md §3 invariant 8 + the open item from the 2026-05-25 bootstrap).

**Risks / followups:**
- **Live data path UNVERIFIED.** Only `next build` (mock mode) is confirmed. No running indexer, no deployed CompositeFeed, no browser/runtime/375px check this session. Per Prompt 11's final check, walk through each page on desktop + 375px against the live indexer once deployed; the Recharts SSR warning is cosmetic (client re-sizes on hydration).
- **Refresher + frontend live use need Prompt 7 Part C addresses.** Refresher: `REFRESHER_PRIVATE_KEY` (separate small hot wallet, NOT an agent key) + `ADDR_COMPOSITE_FEED`. Frontend: set `NEXT_PUBLIC_INDEXER_URL` + `NEXT_PUBLIC_ADDR_COMPOSITE_FEED` (+ others) and redeploy (NEXT_PUBLIC_* inline at build, so a rebuild is required after addresses land).
- **Vercel deploy not done** (no addresses/indexer yet). When deploying: set the NEXT_PUBLIC_* env, `next build`, report the public URL (Prompt 11 final step).
- **`indexer.ts` decodes prediction value as `Number(bigint)`** — fine for bps/8-dec-USD magnitudes (< 2^53) but would lose precision for raw 18-dec wei-scale values. Categories here are safe; keep in mind if a future category uses large raw units.
- **Leaderboard live `name`/`kind` are derived, not authoritative.** Until IPFS metadata is fetched, live agents show as `agent #N` with a guessed glyph. Cosmetic; the numbers (accuracy/calibration/resolved) are authoritative from the indexer.

### 2026-05-29 — Prompt 10 (Claude reasoner — demo highlight); register/live-run pending creds
**Type:** Build (Prompt 10 — all code + few-shot examples; on-chain register + live loop blocked on deployed addresses + funded controller key + ANTHROPIC_API_KEY)
**Touched files:**
- `agents/claude-reasoner/src/{config,state,indexer,news,context,prompt,forecast,index}.ts` (new/rewrite).
- `agents/claude-reasoner/scripts/register.ts` (new), `agents/claude-reasoner/.env.example` (new).
- `agents/claude-reasoner/fewshot/{meth-apr-1,2,3,aave-tvl-1,2,3}.json` (new — 3 per category).
- `agents/claude-reasoner/package.json` (start path fix), build-status, CLAUDE.md.

**What happened:**
- **Reasoner pipeline (§8.3 / Prompt 10 Part A)**: per category per tick → `getCategoryConfig` (domain) → parallel fetch [feed history, agent's own resolved history+scores, CryptoPanic 24h news] → `buildContext` (Markdown block) → `loadFewShot` + `buildUserPrompt` → `getForecast` (Anthropic `messages.create`) → parse/validate JSON → clamp band to domain + clamp confidence → `uploadContent({systemPromptIncluded, userPrompt, rawResponse, parsedForecast, ...})` → `submitFullCycle` via SDK. Full prompt+response+parsed forecast is the on-chain `contentHash` payload (keccak; pinned to IPFS if PINATA_JWT). Structured JSONL debug log to `reasoner.log.jsonl`.
- **System prompt** verbatim per spec ("...reputation depends on calibrated forecasts. Overconfidence will harm your calibration score; underconfidence will harm your accuracy ranking...") + explicit "accuracy and calibration are PUBLIC on-chain" to incentivize honest confidence. Strict JSON output contract (predicted_value{lower,upper}, confidence 0-10000 bps, reasoning).
- **Few-shot (Part B — Day-9 deliverable)**: hand-wrote 3 examples per category in `fewshot/*.json`, each shaped `{category, context, reasoning, predicted_value, confidence}`. Each shows observed data → hypothesis → forecast range → confidence justification across 3 regimes (calm/mean-revert, trend w/ catalyst, high-variance or regime-break). Reasoning explicitly teaches the calibration lesson (don't narrow below observed noise; widen on trends; don't anchor to pre-shock level). `loadFewShot` filters by `category` field and concatenates into the user prompt.
- **SEED_MODE (Part C)**: identical to ARIMA — `agent.state.json` `{mode, seedStartTimestamp}`, auto-flip on resolved-count ≥50 OR 48h elapsed; seed 350-block/30-min, normal 43200/6h. Indexer-unreachable count = 0 (never falsely flips).
- **register.ts (Part D)**: §8.1.1 metadata (name "Claude Reasoner", model from CLAUDE_MODEL) → IPFS/data-URI → `register()` w/ 0.1 MNT → writes AGENT_ID to .env.
- **`tsc` clean, dist emitted.** Verified: fewshot loader returns 3+3, `buildUserPrompt` includes examples + output contract.

**Decisions:**
- **Context "category data" = composite-feed snapshots (real on-chain ensemble values) + the agent's own resolved predictions w/ CRPS scores**, NOT realized truth outcomes — the indexer doesn't store category outcomes (same limit as ARIMA). The feed history is a genuine on-chain signal; the agent's own scored history enables in-prompt self-reflection (the few-shot examples model this). v2: index resolver outcomes for true-series context.
- **News optional via CryptoPanic v1 API + token.** No token (or error) → empty news, prompt says "reason from on-chain data alone." Avoided an RSS-XML parser dep; kept dependency-free (global fetch).
- **Default model `claude-opus-4-7`** (env `CLAUDE_MODEL` overrides; spec allowed opus-4-7 or sonnet). Opus for demo-highlight reasoning quality.
- **Few-shot values anchored to the demo's early observed scale** (METH ~3000 bps, AAVE ~1.4e16 = ~$140M) so examples are consistent with the synthetic-seed/early-feed values Claude will actually see in-context. Note: METH domain (max 100000 bps, bucket 1000) is wide vs. realistic ~3% APR — a deploy-config coarseness already flagged; examples use the as-deployed domain.
- **`start` script fixed to `dist/src/index.js`** (tsconfig rootDir "." → output mirrors `dist/src/` + `dist/scripts/`). Same one-line fix applied to arima-baseline in the prior session is now applied here.

**Risks / followups:**
- **NOT run live** — needs deployed addresses (Prompt 7 Part C), funded controller key, `ANTHROPIC_API_KEY`, ideally live indexer + `PINATA_JWT` + `CRYPTOPANIC_TOKEN`. Run: `pnpm --filter @predictor-index/claude-reasoner register` once, then `... start`.
- **No Anthropic call was exercised** (no API key in this session). The `getForecast` parse path (fence-strip + outer-brace slice + shape validation) is reviewed but unverified against a real model response. First live run should confirm the model honors the JSON-only contract; the extractor tolerates ```json fences as a safety net.
- **Hosting deferred** (GH Actions cron / Railway) — same as ARIMA + indexer.
- Few-shot copy references numbers (3000 bps regime, $140M TVL, ±noise) — if the deployed domain/category math or seed centers change materially, refresh the examples so in-context observed values and example values stay on the same scale.
- CryptoPanic v1 API may require a paid plan for some token tiers; if it 4xx's the agent degrades gracefully to no-news. Confirm the free tier works with the chosen token before relying on news in the demo.

### 2026-05-29 — Prompt 9 (Agent SDK + ARIMA baseline); register/live-run pending creds
**Type:** Build (Prompt 9 — all code; on-chain register + live submission loop blocked on deployed addresses + funded controller key)
**Touched files:**
- `agents/sdk/src/{abis,types,categories,addresses,ipfs,agent,index}.ts` (new/rewrite) — full SDK.
- `agents/arima-baseline/src/{arima,config,state,indexer,index}.ts` (new/rewrite) — ARIMA agent.
- `agents/arima-baseline/scripts/register.ts` (new), `agents/arima-baseline/.env.example` (new).

**What happened:**
- **SDK (`@predictor-index/sdk`)**: `Agent` class with `commit / reveal / submitFullCycle / register / getCategoryConfig`. viem clients (custom-defined Mantle Sepolia chain from rpcUrl), `nonceManager` from `viem/accounts` for batch nonce caching, bounded retry (3 attempts, linear backoff) on all writes, viem default gas estimation. Commit builds `value = abi.encode(uint256 low, uint256 high)`, random 32-byte nonce, `commitHash = keccak256(abi.encode(uint256 agentId, bytes32 categoryId, bytes value, uint16 confidence, bytes32 nonce))` — matches PredictionMarket.reveal's recomputation exactly. predictionId + commitBlock parsed from the `PredictionCommitted` receipt log (not the simulate result, which can drift). Reveal polls block number until `[commitBlock+REVEAL_DELAY, commitBlock+REVEAL_WINDOW]`, reads the constants on-chain, throws if window missed. RevealMaterial held in an in-memory Map keyed by predictionId (submitFullCycle is same-process; cross-process reveal accepts explicit material).
- **Categories**: `categoryId(label)=keccak256(label)`; domains mirror Deploy.s.sol (METH `[0,100000]` bps, AAVE `[0,1e17]` USD-8dec, 100 buckets). `getCategoryConfig` reads PredictionMarket.getCategory + decodes configBytes → domain.
- **addresses.ts**: same 3-tier loader as the indexer (ADDR_* env → `contracts/deployments/<DEPLOY_NETWORK>.json` → throw). `DEPLOYMENTS_FILE` overrides path; default resolves `../../contracts/deployments` from cwd.
- **ipfs.ts**: `uploadContent` computes `contentHash = keccak256(content)` (verifiable on-chain regardless of IPFS), and pins to IPFS via Pinata REST if `PINATA_JWT` set (returns cid/uri), else hash-only with a warn. No heavy w3up dep.
- **ARIMA agent**: self-contained ARIMA(1,1,1) in pure TS (no native/WASM dep) — d=1 differencing, conditional-SSE estimation of (phi, theta) via coarse grid + local refine (c pinned to mean(w)(1-phi)), forecast integrated back to levels, 95% interval from integrated MA(∞) psi-weights (cumulative ARMA(1,1) weights). Main loop: load state → poll indexer resolved-count → SEED auto-flip check → per category fetch history (range midpoints of resolved revealed predictions; synthetic 15-pt seed if <10) → fit → clamp 95% band to domain → upload provenance JSON → `submitFullCycle` with fixed 5000 bps confidence. SEED mode: offset 350 blocks (~12 min), cadence 30 min. Normal: offset 43200 (~24h), cadence 6h.
- **SEED_MODE (Part C)**: `agent.state.json` `{ mode, seedStartTimestamp }`; auto-flip when resolved-count ≥ 50 OR elapsed > 48h, persisted on flip. Indexer-unreachable count treated as 0 so a transient outage never falsely flips.
- **register.ts (Part D)**: builds §8.1.1 metadata, pins to IPFS (or base64 data: URI fallback), `Agent.register(uri)` with the on-chain `REGISTRATION_FEE` (0.1 MNT), writes `AGENT_ID` back to `.env`.
- **Both packages typecheck + emit clean** (`tsc` EXIT 0; dist js for all SDK + arima modules + register.js).

**Decisions:**
- **SDK public API accepts a structured `RangeValue {low,high}` OR pre-encoded `Hex` for `value`** — encodes internally via `encodeRangeValue`. Cleaner/type-safe than forcing callers to abi-encode (Prompt B sketched the agent encoding; SDK owning it is better and the agent just passes the range object).
- **Pure-TS ARIMA over the `arima` npm pkg / Python sidecar** (Prompt offered "or"). Avoids native/WASM install + child_process fragility on Windows/CI; the CSS estimator + integrated psi-weight intervals are a legitimate ARIMA(1,1,1). Documented in `arima.ts`.
- **`contentHash` = keccak256(content), not an IPFS CID.** The field is bytes32; a CIDv0 multihash digest is 32 bytes but coupling the on-chain value to IPFS availability is fragile. keccak is self-verifying; the CID (when pinned) lives in the provenance JSON + logs.
- **predictionId from the receipt event, not simulate.** Concurrent commits could change `nextPredictionId` between simulate and mine; the `PredictionCommitted` log (matched on our commitHash) is authoritative.
- **register() lives on the Agent class** (constructed with agentId=0n; register ignores it). One fewer export; the constructor key is the controller that gets bound.

**Risks / followups:**
- **NOT run live — needs deployed addresses (Prompt 7 Part C) + a funded controller key.** To run: deploy contracts (writes deployments JSON), `pnpm --filter @predictor-index/arima-baseline register` once, then `pnpm --filter @predictor-index/arima-baseline start`. Indexer should be live too (history + flip count); without it the agent uses synthetic seeds and treats count as 0 (stays in seed mode until 48h).
- **Hosting (GitHub Actions cron OR Railway) not set up** — same deferral as the indexer. The loop is a long-running `while(true)`; on Actions it'd be a scheduled single-tick variant instead. Decide before demo.
- **Series = range midpoints of the agent's *own* resolved predictions**, not the realized on-chain truth (the indexer doesn't store category outcomes). Fine as an autoregressive seed for a baseline; if v2 wants true-outcome ARIMA, index the resolver outcome or read it on-chain.
- **ARIMA horizon = 1 step** (next observation), not literally 43200 blocks ahead. The interval still widens by the integrated psi-weights; acceptable for a baseline. The forecast targets "the next resolution" which is what gets scored.
- **Synthetic seed centers are guesses** (METH 3000 bps, AAVE 1.4e16 ≈ $140M). Once real resolved history ≥10 points exists, synthetic is never used. Tune centers if the first-run bands look off vs. the live metric.

### 2026-05-28 — Prompt 8 code (Ponder indexer); live run/Railway deploy pending creds
**Type:** Build (Prompt 8 — indexer code; live sync + hosting blocked on deployed addresses + creds)
**Touched files:**
- `indexer/abis/{AgentRegistry,PredictionMarket,CompositeFeed,BonusDistributor}Abi.ts` (new) — extracted from `contracts/out`; removed `ExampleContractAbi.ts`.
- `indexer/ponder.config.ts` (rewrite) — Mantle Sepolia (5003), 4 contracts, env→json→zero address loader.
- `indexer/ponder.schema.ts` (rewrite) — 5 tables.
- `indexer/src/index.ts` (rewrite) — all event handlers.
- `indexer/src/api/index.ts` (rewrite) — REST endpoints + graphql/sql.
- `indexer/.env.example` (new), `masterdoc/09-build-status.md`, `CLAUDE.md`.

**What happened:**
- Built the Ponder 0.16 indexer per PRD §10 / Prompt 8. **`ponder codegen` + `tsc` both clean.** ABIs pulled from compiled Foundry artifacts via a one-off node script.
- Config resolves contract addresses with a 3-tier fallback (`ADDR_*` env → `contracts/deployments/<DEPLOY_NETWORK>.json` → zero) so it builds/typechecks before any live deploy; once Deploy.s.sol broadcasts (writes the JSON) the addresses flow in with no code change.
- 5 schema tables (agents, reputations, predictions, feedSnapshots, bonusDistributions) with concatenated text PKs; int256 columns use `bigint` (signed), bytes use `hex`, agentBonuses uses `json`.
- Handlers cover AgentRegistry (AgentRegistered/ControllerRotated/ReputationUpdated), PredictionMarket lifecycle (Committed/Revealed/Cancelled/Forfeited/Resolved), CompositeFeed (CompositeFeedRefreshed), BonusDistributor (EpochFinalized + BonusClaimed). 5 REST endpoints + the built-in graphql/sql mounts.

**Decisions:**
- **Indexed PredictionMarket.PredictionResolved, NOT ScoringEngine.PredictionScored**, for prediction status+score. The prediction row already carries agentId/categoryId from PredictionCommitted, so the Resolved event (which has score) is sufficient — avoids adding ScoringEngine as a 5th indexed contract.
- **Imported drizzle operators (`eq/and/desc`) from `ponder`** (it re-exports them) rather than adding `drizzle-orm` as a direct dependency — keeps package.json minimal and resolvable under pnpm (drizzle-orm is only a transitive dep, not name-resolvable from indexer/).
- **`categoryHash()` in the API accepts a label or a raw bytes32** — the frontend can query `?category=METH_APR_24H` (hashed to match the contract's `keccak256("LABEL")` id) or pass the hex directly.
- **bigint→string `serialize()`** wraps every JSON response so Hono doesn't throw on bigint columns.

**Risks / followups:**
- **BLOCKED — live sync + Railway hosting need deployed addresses + creds** (depends on Prompt 7 Part C). To run: set `ADDR_*` (or rely on the deployments JSON) + `PONDER_RPC_URL_MANTLE_SEPOLIA` + `PONDER_START_BLOCK` (AgentRegistry deploy block, so it doesn't scan from 0), then `pnpm dev` (local PGlite) or a Railway service with a Postgres `DATABASE_URL`. Then `curl /leaderboard?category=METH_APR_24H&limit=10`.
- Indexer only typecheck-verified (no live sync against a real chain yet) — same blocker as the contract deploy. The handler/endpoint logic is unverified against real event streams until then.
- `reputations.resolvedCount` is stored as the value from ReputationUpdated (authoritative), not derived by counting prediction rows — keep using the event value to stay consistent with on-chain state.

### 2026-05-28 — Prompt 7 code (Deploy + SmokeTest + DemoFeedConsumer + e2e test); live deploy pending creds
**Type:** Build (Prompt 7 — all code artifacts; Part C live deploy/verify blocked on user credentials)
**Touched files:**
- `contracts/src/examples/DemoFeedConsumer.sol` (new) — reference consumer reading CompositeFeed.
- `contracts/script/Deploy.s.sol` (new) — deploys all 12 contracts + full wiring + writes `deployments/<net>.json`.
- `contracts/script/SmokeTest.s.sol` (new) — self-contained round-trip with state logging, runs credential-free.
- `contracts/test/EndToEnd.t.sol` (new) — same round-trip as a deterministic test.
- `contracts/config/mantle-sepolia.toml` (new) — network + category + placeholder real-protocol addresses.
- `contracts/.env.example` (edit) — expanded (deployer, verify key, SeedRates + DEPLOY_NETWORK overrides).
- `contracts/foundry.toml` (edit) — `fs_permissions` write access to `./deployments` for the JSON dump.
- `masterdoc/09-build-status.md`, `CLAUDE.md`.

**What happened:**
- **DemoFeedConsumer**: `latest(categoryId)` reads `CompositeFeed.read` and decodes the abi.encode(uint256) point estimate → (value, confidence, contributors, updatedBlock). `valueFresh(categoryId, maxStaleBlocks)` reverts `FeedStale()` if the feed hasn't refreshed recently — the freshness gate a real consumer should use.
- **Deploy.s.sol**: deploys in PRD order (AgentRegistry → PredictionMarket → BonusDistributor → ScoringEngine → RangeCrpsScorer → ResolutionEngine → MockMethRateOracle → MockAavePool → MethAprResolver → AaveMantleTvlResolver → CompositeFeed → SubscriptionGate → DemoFeedConsumer). Wires everything, registers both categories on ResolutionEngine **and** PredictionMarket, sets CompositeFeed deps. Reads `PRIVATE_KEY` env, owner/treasury = deployer. Writes `deployments/<DEPLOY_NETWORK>.json`. **Dry-run simulation (anvil key) verified**: all 12 deploy + wire + JSON write succeed.
- **SmokeTest.s.sol**: deploys the scoring path fresh, runs register → seed oracle → commit → reveal → resolve using block cheatcodes, asserts §7.2.4, logs every state change. `forge script script/SmokeTest.s.sol:SmokeTest` **PASSES credential-free**: score 998334, resolver reward 2e16 (exactly 2%), conservation `2e16 + 0.97918366e18 + 0.00081634e18 == 1e18`, resolvedCount 1.
- **EndToEnd.t.sol**: identical round-trip wired as a test; asserts status Resolved, score>0, resolvedCount==1, accuracy moved, resolver==2%, full conservation, market released full stake, slash credited to the epoch pool, and that the now-Resolved prediction is excluded from the live feed. **Full suite 146/146.**

**Decisions:**
- **Adapted wiring to actual contract APIs, not the Prompt's literal sketch.** ScoringEngine's `agentRegistry`/`predictionMarket` are constructor immutables (Prompt listed `setAgentRegistry`/`setPredictionMarket` — those setters don't exist). PredictionMarket uses `setBonusPool` (not `setBonusDistributor`) and `registerCategory(...)` (not `setCategoryConfig`). Deploy.s.sol reflects the real surface.
- **SmokeTest is self-contained (fresh deploy) + credential-free**, run via `forge script` simulation. Live-chain block advancement can't be scripted in one shot (reveal/resolve ~350 blocks ≈ 12 min apart on Sepolia), so the round-trip proof is local; live walk-through must be driven tx-by-tx with `cast`. EndToEnd.t.sol gives the same guarantee in CI.
- **`address(this)` is rejected in forge scripts** — SmokeTest uses a literal `deployer` EOA + `vm.startPrank(deployer)` around deploy/wire/oracle-seed so owner-gated calls pass.
- **Category domain configs** (RangeCrpsScorer): METH_APR `[0, 100000]` bps (width 1000), AAVE_TVL `[0, 1e17]` USD-8dec (width $10M). Placeholders bracketing plausible values; documented in `config/mantle-sepolia.toml`.
- **`deployments/mantle-sepolia.json` NOT committed.** The sim run wrote a chainId-31337 placeholder; deleted it. The real `--broadcast` regenerates the authoritative file with Sepolia (5003) addresses.

**Risks / followups:**
- **Part C (live deploy + Mantlescan verify) NOT done — needs user creds.** Funded `PRIVATE_KEY`, `MANTLE_SEPOLIA_RPC`, `MANTLESCAN_API_KEY`. Run: `forge script script/Deploy.s.sol:Deploy --rpc-url $MANTLE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast --verify`, then `SeedRates.s.sol --broadcast` to seed the mETH oracle (and seed MockAavePool reserves for the TVL category). Verify all 12 on the explorer, then update `deployments/mantle-sepolia.json` with verification URLs. **Prompt 8 (indexer) needs the real addresses first.**
- Deploy.s.sol wires the **mock** oracles (MockMethRateOracle, MockAavePool). For a demo with live data, seed them post-deploy; for v2, swap to real Aave/mETH addresses from `config/mantle-sepolia.toml` (needs archive RPC).
- WINDOW_START hard-set to 300 (== MIN_RESOLUTION_OFFSET). A category whose `allowedWindowStart` < 300 would revert at registerCategory — 300 is the safe floor.

### 2026-05-28 — Prompt 6 (BonusDistributor + CompositeFeed + AaveMantleTvlResolver + SubscriptionGate)
**Type:** Build (Prompt 6)
**Touched files:**
- `contracts/src/BonusDistributor.sol` (new) — pull-claim epoch bonus pool, zero iteration.
- `contracts/src/CompositeFeed.sol` (new) — rank-weighted ensemble + outlier-resistant confidence.
- `contracts/src/SubscriptionGate.sol` (new) — §7.6 read gate, open in v1.
- `contracts/src/resolvers/AaveMantleTvlResolver.sol` (new) — §7.3.2 reserve-sum TVL in USD 8-dec.
- `contracts/src/mocks/{MockAavePool,MockAToken}.sol` (new) — archive-RPC substitute for Aave reads.
- `contracts/src/interfaces/{ISubscriptionGate,ICompositeFeed,IAaveLike}.sol` (new).
- `contracts/src/interfaces/IPredictionMarket.sol` (edit) — added `latestRevealedPrediction(agentId, categoryId)`.
- `contracts/src/PredictionMarket.sol` (edit) — `_latestRevealed[agentId][categoryId]` index written on `reveal`, exposed via the new view.
- `contracts/test/{BonusDistributor,CompositeFeed,AaveMantleTvlResolver}.t.sol` (new) — 23 tests.
- `masterdoc/09-build-status.md`, `CLAUDE.md`.

**What happened:**
- **BonusDistributor** per Prompt 6 Part A + §7.2.4. PULL-CLAIM, no loop over agents. `notifySlash` kept as `(bytes32 categoryId) payable` (NOT the Prompt's `(bytes32, uint256)` form) because the deployed PredictionMarket already calls `notifySlash{value: ...}(categoryId)` — msg.value carries the slashed MNT, which is what conserves native value end-to-end (Prompt 5 already settled this decision). `recordContribution(categoryId, agentId, weight)` and `notifySlash` both gated by a single `authorized` mapping (deploy wires PredictionMarket + ScoringEngine via `setAuthorized`). `finalizeEpoch`: rollover 5% credited to epoch+1, finalizer reward 0.5%, **both deducted off rawPool** (followed Prompt 6's explicit pseudocode, which differs slightly from README §7.2.4 wording that takes the 0.5% off `pool−rollover` — see risk below). `claimBonus`: controller-gated, floor-div `finalPool × share / total`, dust unclaimable. ReentrancyGuard + checks-effects-interactions on finalize/claim.
- **CompositeFeed** per Part B + §7.5. `refresh` rate-limited to 100 blocks/category (first refresh always allowed since `lastUpdatedBlock==0`). Reads AgentRegistry top-20 (built Prompt 2, **read-only** here — no re-sort), pulls each top agent's latest still-`Revealed` prediction via the new PredictionMarket index, decodes `(low,high)` → midpoint point estimate. Re-ranks contributors after skips; rank `r` weight `(N+1-r)/(N(N+1)/2)`, summing to 1 (fixed-point 1e18). Ensemble = Σ w·midpoint. Confidence = `weightedStated × multiplier`, multiplier = `1 + mean(clip(cal/1e6, -0.5))` ∈ [0.5,1.0], clamped to [0,10000]. Empty contributor set → writes zeros (no div-by-zero). `read` gated by SubscriptionGate when set (unset = fully open).
- **SubscriptionGate** built now (tiny) so CompositeFeed compiles + `read` works; Prompt 7 just deploys + wires it.
- **AaveMantleTvlResolver** per Part C + §7.3.2. Iterates `pool.getReservesList()`; per reserve `aToken.totalSupply × oracle.getAssetPrice(asset)8 / 10^aTokenDecimals` (decimal-normalized to clean 8-dec USD). `predictionValue`/`resolutionBlock` ignored (global metric). MockAavePool bundles pool registry + price oracle; MockAToken stubs totalSupply/decimals.
- **forge test: 145/145 green** (was 122; +23). CompositeFeed + BonusDistributor tested with local interface mocks for deterministic state; ensemble + 3-reserve TVL hand-verified.

**Decisions:**
- **`notifySlash` signature retained as payable single-arg** (diverges from Prompt 6 literal spec) to match the already-deployed PredictionMarket callsite and preserve native-MNT conservation. The Prompt's `(bytes32, uint256 amount)` form would not move ETH.
- **`finalizeEpoch` deducts both rollover (5%) + finalizer reward (0.5%) off the raw pool** per Prompt 6's executable pseudocode. README §7.2.4 prose instead implies finalizer 0.5% comes off `(pool − rollover)`. Divergence is ~0.025% of pool; flagged below. Conservation invariant (Σ claimable ≤ finalPool) holds either way.
- **Added `latestRevealedPrediction` index to PredictionMarket** rather than having CompositeFeed scan all predictions. Written on `reveal`; CompositeFeed re-checks `status == Revealed` at read time (handles the case where the latest revealed prediction has since resolved).
- **CompositeFeed reads top-20, never sorts** — honors invariant §3.4 (sorting lives only in AgentRegistry `_updateTopAgents`).
- **SubscriptionGate optional on CompositeFeed** (address(0) = open). Lets the feed be deployed/used before the gate is wired.

**Risks / followups:**
- **finalizeEpoch math divergence from README §7.2.4** (see Decisions). If a stats-literate judge cross-checks the PRD prose against the contract, the 0.5%-base differs. Recommend reconciling README §7.2.4 to match the contract (off-rawPool) in a future doc pass, or vice-versa if the user prefers the prose.
- AaveMantleTvlResolver uses placeholder mock pool/oracle. Prompt 7 deploy must pass real Aave-on-Mantle Pool + AaveOracle addresses (contingency INIT Capital per §7.3.2) OR keep the mock for the hackathon demo. Real reserves at historical blocks still need archive RPC — mock is the pragmatic v1.
- CompositeFeed ensemble currently weights by the band **midpoint**. The scorer (RangeCrpsScorer) treats the prediction as a uniform band; the feed collapses it to a point. Acceptable for a single composite value, but the band width (a confidence signal) is discarded. Note for v2 (could surface band as a feed field).
- `recordContribution` weight is the `(score²·stake)/1e12` value ScoringEngine already computes; very large stakes → large weights, but BonusDistributor only sums/divides them, so no overflow concern at realistic scale.

### 2026-05-27 — Landing content + UI/UX polish pass
**Type:** Build (frontend additive — 2 new landing sections + a11y / contrast / states primitives)
**Touched files:**
- `frontend/src/components/landing/CategoriesShowcase.tsx` (new) — 2-card grid showcasing the two shipped categories with sample range-band SVG, scorer formula peek, cadence + agent-count metadata.
- `frontend/src/components/landing/FaqAccordion.tsx` (new) — 8-item Radix Accordion answering the questions judges raise: on-chain vs centralized, oracle vs ensemble, CRPS vs Brier, Sybil deterrence, commit-reveal, revenue, stake split, ERC-8004.
- `frontend/src/components/ui/EmptyState.tsx` (new) — dashed-border state with optional icon, title, body, action; `role="status"` + `aria-live="polite"`.
- `frontend/src/components/ui/ErrorState.tsx` (new) — red-tinted state with `role="alert"`, retry slot, status-dot caption.
- `frontend/src/app/page.tsx` (edit) — inserted Categories + FAQ StoryFrames into the FlowArt sequence (now 8 sections: Hero → LivePulse → Categories → Reasoning → Leaderboard → How → FAQ → Footer).
- `frontend/src/components/landing/Nav.tsx` (edit) — added Categories + FAQ anchor links, focus-visible ring on link items.
- `frontend/src/components/app/AppHeader.tsx` (edit) — visually-hidden skip-to-content link (becomes visible on keyboard focus).
- `frontend/src/app/(app)/layout.tsx` (edit) — `<main id="main" tabIndex={-1}>` so the skip-link can land focus.
- `frontend/src/components/ui/DataTable.tsx` (edit) — `aria-sort` on sortable `<th>`, descriptive `aria-label` on sort button, focus-visible ring, `aria-hidden` on chevron icon.
- `frontend/src/app/globals.css` (edit) — global `:focus-visible` outline rule, `.skip-link` styles, lifted `--color-text-muted` from `#5a6273` to `#6b7384` to clear WCAG 4.5:1 against the dark background.
- `frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx` (edit) — empty-predictions cell now uses `EmptyState` primitive instead of bare muted text.

**What happened:**
- User asked: is UI/UX polished? If not, polish it; plus add more content to the landing page. After brainstorming-style scoping (multi-select), user picked new sections (Categories + FAQ) and polish priorities (loading/empty/error states + typography/spacing + accessibility).
- **Categories showcase**: card per shipped category (`METH_APR_24H`, `AAVE_MANTLE_TVL_24H`) with: domain label, mini-sparkline, range-band SVG showing the agent's predicted [low, high] band against the dashed reference + a solid actual-value line, scorer formula in mono, cadence (~24h / 43200 blocks), agent-count chip, deep-link to /feed/<slug>. Cards stack on mobile, two-col on md+.
- **FAQ**: 8 hand-written objections. Each Q tagged `Q.01..Q.08` in mono, ChevronDown rotates 180° on open and turns accent. Answer prefixed with `A.` accent. Uses Radix Accordion `type="multiple"` so multiple Q/A can be open at once. `viewport={{ once: true }}` entry transition respects `useReducedMotion`.
- **Polish layer**:
  - `:focus-visible` global rule = 2px accent outline + 2px offset, so any native focusable element (anchors, buttons, inputs) gets a visible keyboard ring even when components forget. Components that already define a ring (DataTable sort, Collapsible) keep theirs via `:focus-visible:ring-…` Tailwind utilities.
  - Skip-link follows WCAG technique G1: hidden at `top: -40px`, slides to `top: 12px` on focus.
  - `--color-text-muted` was failing contrast at `#5a6273` (≈ 3.4:1) — bumped to `#6b7384` (≈ 4.7:1). Comments inline cite the math so future edits don't regress.
  - `aria-sort` reports `ascending` / `descending` / `none` on `<th>` for screen-reader users. Sort button `aria-label` includes the active direction.
- `EmptyState` + `ErrorState` are primitives; integrated `EmptyState` into the agent-detail predictions list as a concrete usage example. Full multi-page integration (skeletons via `useTransition`, error fallbacks on demo-consumer) deferred until real data lands in Prompt 11 — wiring placeholders against mocks would be churn that the indexer integration replaces anyway.
- `next build` clean: 6 routes, TypeScript pass, only the pre-existing benign Recharts SSR width/height warning (documented in prior session as harmless).

**Decisions:**
- **Did NOT integrate `ErrorState` into demo-consumer's live-read path.** Mock data never fails; the component is ready for use once a real wagmi `useReadContract` watcher replaces the simulated interval. Adding fake error state under mock data would be theatre, not polish.
- **Did NOT add skeletons via `useTransition` on category tabs** for the same reason. The tab switch is instant against synchronous mock data; a forced skeleton would feel wrong. When the indexer attaches, `useTransition({ isPending })` lights up automatically.
- **Categories showcase placement: slot 3 (after LivePulse, before ReasoningReveal).** Reason: LivePulse establishes "what a feed looks like in motion"; Categories then says "and here are the two we ship"; ReasoningReveal then dives into how one agent justifies its forecast. Narrative escalator from abstract → concrete → reasoning.
- **FAQ placement: slot 7 (after HowItWorks, before Footer).** End of the story is "is this trustworthy?" → FAQ owns that. Footer is just metadata.
- **FAQ Q&A copy is opinionated, not bland.** Each answer commits to a specific claim with numbers (e.g., "0.1 MNT registration fee", "10–100 blocks", "20 agents per category", "$500–$2,000/mo"). Bland FAQs lose hackathon judges; specific ones win them.
- **Type pair unchanged** — Inter + JetBrains Mono per PRD §9.1. No new fonts. All new components reuse existing tokens (`--color-bg-elev-1`, `--color-accent`, `--color-border`, etc.).

**Risks / followups:**
- The Categories sample data is hand-tuned to look narratively right (claude-reasoner-α forecasting mETH APR ≈ 3.42% with a tight ±0.2% band, arima-baseline forecasting Aave-Mantle TVL at $142.6M). When the indexer attaches (Prompt 11), the sample-prediction-per-category fields swap from hand-data to the latest revealed prediction by the top-1 agent per category.
- FAQ entries reference numbers that must stay in sync with PRD: "20 agents", "0.1 MNT fee", "10–100 block reveal window", "200-block cutoff", "α=0.1", "≥10 resolved", "[0.5, 1.0] multiplier", "2% resolver reward", "$500/$1,000/$2,000 tiers". If PRD changes any of those, update FAQ copy.
- Skip-link assumes a `<main id="main">` mounted by the `(app)` layout. Landing (`app/page.tsx`) does NOT have a `<main id="main">` because it's a single-purpose marketing route — the skip-link in AppHeader is not rendered there (AppHeader only mounts inside `(app)/layout.tsx`). No bug, but worth knowing.
- `EmptyState` + `ErrorState` are styled for terminal-core surfaces, not for landing — don't drop them into the landing page without restyling.

### 2026-05-27 — Prompt 5 (ScoringEngine + RangeCrpsScorer + calibration + 2 Python references)
**Type:** Build (Prompt 5 — most numerically-sensitive prompt)
**Touched files:**
- `contracts/src/scorers/RangeCrpsScorer.sol` (new) — closed-form CRPS for uniform-over-bucket forecast vs point-mass outcome.
- `contracts/src/ScoringEngine.sol` (new) — wires score → reputation update → stake split → BonusDistributor.recordContribution → PredictionMarket.settleStake.
- `contracts/src/interfaces/ICategoryScorer.sol` (new).
- `contracts/src/interfaces/IBonusDistributor.sol` (edited) — added `recordContribution(bytes32, uint256, uint256)`.
- `contracts/src/interfaces/IPredictionMarket.sol` (edited) — added `setScore(uint256, int256)`.
- `contracts/test/reference/crps_reference.py` (new) — Python reference for RangeCrpsScorer; generates 10 hand-picked test vectors.
- `contracts/test/reference/calibration_reference.py` (new) — Python reference for §7.4.2; generates 10 test vectors + EMA spot-checks.
- `contracts/test/RangeCrpsScorer.t.sol` (new) — 8 tests (Python vector + 4 boundary + fuzz).
- `contracts/test/Calibration.t.sol` (new) — 5 tests (Python vector + threshold + fuzz).
- `contracts/test/ScoringEngine.t.sol` (new) — 15 tests (stake settlement at perfect/neutral/worst/positive, reputation updates, access control, fuzz conservation).
- `contracts/test/PredictionMarket.t.sol` + `contracts/test/ResolutionEngine.t.sol` (edited) — added empty `recordContribution` stub to existing IBonusDistributor mocks so they still compile after the interface extension.
- `masterdoc/09-build-status.md`, `CLAUDE.md`.

**What happened:**
- Implemented RangeCrpsScorer per PRD §7.4.1. Forecast = uniform[a, b] with a, b snapped to bucket boundaries from the (predLow, predHigh) input. Outcome = point mass at the outcome bucket's midpoint. Domain split into N=100 equal-width buckets via `categoryConfig = abi.encode(uint256 domainMin, uint256 domainMax)`. Closed-form CRPS in three cases (y<a, y>b, a≤y≤b). Maps to `score = clamp((1 - 2*CRPS/D)*1e6, -1e6, +1e6)`. Computed in doubled coordinates (a'=2a, b'=2b, y'=2y) so the half-bucket-width outcome midpoint stays integer.
- Implemented ScoringEngine per PRD §7.4. `applyScore(predictionId, outcome, scorer, categoryConfig, resolverCaller) external onlyResolutionEngine`. Flow: (1) read prediction; (2) require status==Revealed; (3) call scorer + clamp result; (4) compute new bucketAccuracy[bucketIdx] via EMA `((9*old + realized_scaled)/10)` where `realized_scaled = (score+1e6)/2`, plus new accuracy_score via same EMA on the raw score; (5) compute new calibration via `_calibration` (§7.4.2 squared-error sum × 4 / total_count / 1e6, negated, clamped to [-1e6, 0], returns 0 if total < 10); (6) `agentRegistry.updateReputation(...)`; (7) compute stake split per §7.2.4 (resolver 2%, then `return_rate_scaled = 5e5 + score/2` clamp [0, 1e6], returned = remaining × rate / 1e6, slashed = remaining - returned, conservation asserted); (8) `predictionMarket.setScore`; (9) optional `bonusDistributor.recordContribution(categoryId, agentId, max(0, score)² × stake / 1e12)`; (10) `predictionMarket.settleStake(returned, slashed, resolverReward, resolverCaller)`; (11) emit `PredictionScored` for indexer.
- Two Python reference files **exactly mirror** the Solidity integer arithmetic (same operation order, same `//` truncation). Solidity tests hard-code the values printed by the Python scripts and assert **exact equality** (not relative tolerance — the math agrees bit-for-bit). 10 CRPS cases ranging from perfect-centered to inverted-bounds-auto-swap; 10 calibration cases from cold-start through max-miscalibration.
- 28 new tests on top of the prior 94: **122/122 full suite green**, including three 256-run fuzz tests (CRPS bounds, calibration sign, stake conservation across all valid scores). Stake conservation fuzzed across full `[-1e6, +1e6]` range never fails.
- Verified by hand against PRD math: perfect score (1e6) → 0.98 stake returned, 0 slashed, contribution = full stake; neutral (0) → 49% / 49% split + 2% resolver, 0 contribution; worst (-1e6) → 0 return, 98% slashed, 0 contribution; +500k → 73.5% return, 24.5% slash, contribution = stake/4.

**Decisions:**
- **Stack-too-deep refactor in two places.** `RangeCrpsScorer.score` originally had 18+ locals across the case-3 branch; extracted to a `_deduction(a2, b2, y2, D)` helper. `ScoringEngine.applyScore` similarly had too many locals across the tuple destructures + emit; split into `_applyReputation` (returns `(newAccuracy, newCalibration)` only and persists buckets in-place) + `_settleAndEmit`. Kept viaIR off (faster CI) since the refactor was clean.
- **ICategoryScorer stays `pure`.** Production scorers (RangeCrpsScorer) are pure. Test's `FixedScorer` initially used `view` to read a `canned` state var — Solidity blocked the mutability widening on override. Reworked `FixedScorer` to decode the canned score from `outcome` bytes (`abi.decode(outcome, (int256))`), which keeps it pure. Tests pass the desired score as `abi.encode(int256(...))` to `applyScore`.
- **Did NOT** pre-compute `score` and pass via `settleStake` parameter as Prompt 5 sketched ("...settleStake(predictionId, returned_to_agent, 0 /* bonus unused */, resolver_reward, resolverCaller)"). That contradicts PredictionMarket's existing `returnAmount + bonusAmount + resolverReward == stake` invariant (otherwise the slashed ETH has no destination). Instead: ScoringEngine passes `slashedToPool` as `bonusAmount` to `settleStake`, and PredictionMarket forwards via `IBonusDistributor.notifySlash{value: slashedToPool}` inside settleStake — ETH conservation maintained, pull-claim semantics preserved (Prompt 5 wording was talking about *agent bonus claims* via `claimBonus`, not the slash-flow). Documented in §6 risks.
- **bucketCount EMA threshold = 10 total.** Per §7.4.2 — cold-start (total < 10) returns 0. After threshold, full squared-error formula applies. Matches Python reference.
- **Contribution computed as `(s² × stake) / 1e12` only when `score > 0`.** Saves an SSTORE for zero-or-negative scores and matches PRD §7.2.4 `max(0, score_norm)²`. No contribution → no recordContribution call (skipped to save gas).
- **Two public pure views: `computeCalibration(buckets, counts)` + `previewStakeSplit(stake, score)`.** Used in tests and intended for indexer/UI parity. Both pure; no storage needed.

**Risks / followups:**
- BonusDistributor still a 2-method stub interface (`notifySlash` + `recordContribution`). The full contract — epoch closing, pull-claim, finalize-with-rollover, finalize-caller 0.5% reward — lives in Prompt 6 along with CompositeFeed.
- `_calibration`'s int256 sum could in principle overflow if a single bucket accumulates ≥ ~2^200 count × 1e12 squared-diff. Realistically impossible (the practical cap is ~1e10 resolutions across all agents combined). No defensive saturation; document as v1 simplification.
- `recordContribution` is called with `share = (score² × stake) / 1e12` — this can be a very large number for big stakes (up to ~stake itself). When BonusDistributor finalizes the epoch and divides `pool × agent_share / total_share`, mind precision: in v1 we use floor div so dust accumulates in the contract (unclaimable). Acceptable.

### 2026-05-26 — Full app frontend (out-of-sequence per user request)
**Type:** Build (frontend pages 2-N; landing was already done)
**Touched files:**
- `frontend/src/lib/format.ts` (new) — number/address/bps/score formatters
- `frontend/src/lib/mockData.ts` (new) — 8 agents × 2 categories of realistic mock data (agents, predictions, reasoning traces, equity curves, feed history, epochs)
- `frontend/src/components/ui/{Panel,Stat,AddressChip,StatusPill,CategoryTabs,DataTable,Sparkline,NumberFlow,Skeleton,Collapsible}.tsx` (new) — 10 terminal-style primitives
- `frontend/src/components/app/{AppHeader,AppFooter}.tsx` (new) — separate chrome from landing's cinematic Nav/Footer
- `frontend/src/app/(app)/layout.tsx` (new) — route-group layout wrapping all terminal-core pages with AppHeader/AppFooter; landing stays at `app/page.tsx` outside the group
- `frontend/src/app/(app)/leaderboard/{page,LeaderboardClient}.tsx` (new) — sortable agent table, category tabs, composite feed snapshot card, top-agent panel, 4 KPI tiles, "how it works" collapsible
- `frontend/src/app/(app)/agent/[id]/{page,AgentDetailClient}.tsx` (new) — identity NFT card, system metadata panel, 4 KPI tiles, reputation radar (Recharts), equity curve (Recharts line), calibration buckets (Recharts bar), expandable reasoning rows with full IPFS payload preview
- `frontend/src/app/(app)/demo-consumer/{page,DemoConsumerClient}.tsx` (new) — DemoFeedConsumer simulator (live read with auto-refresh + manual refresh), "what is this" panel for protocols, contract address panel, Solidity integration snippet
- `frontend/src/app/(app)/feed/[category]/{page,FeedClient}.tsx` (new) — 4 KPI tiles, composite feed history Recharts area chart with 24h-ago reference line, contributor table with weight bars
- `frontend/src/components/landing/{Hero,Nav}.tsx` (edited) — CTAs now link to /leaderboard; nav items link to /leaderboard, /feed/meth-apr-24h, /demo-consumer
- `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- User asked for "full frontend high-fidelity, get whole image, same color theme" before Prompt 5. Built all four PRD §9.2 hackathon pages plus a bonus `/feed/[category]` page.
- Reused existing design tokens (`--color-bg`, `--color-accent` #33EAB3, `--color-up/down/warn`, Inter + JetBrains Mono) — no new tokens, no new fonts.
- Adhered to PRD §9.3 hybrid model: landing stays cinematic (GSAP pin, dithering shader, kinetic title). All other pages are terminal-core (sparse color, mono numbers, low-contrast gridlines, micro-only motion).
- **Next.js 16 idioms followed:** `params` is awaited as Promise; used the global `PageProps<'/path/[seg]'>` type helper. Server pages do the await + lookup, then forward to a sibling client component (`*Client.tsx`) for interactive surfaces.
- Mock data is comprehensive: 4 kinds of agents (CLAUDE, ARIMA, QUANT, ENSEMBLE) with realistic reputation deltas, per-bucket calibration arrays, equity curves, IPFS reasoning blob with 4-step trace (frame/search/infer/forecast) for Claude agents only.
- All Recharts components dark-themed inline (border-strong axes, text-muted ticks, accent line, low-opacity area fills, border dashed gridlines). Tooltips styled to terminal aesthetic.
- `next build` clean: 6 routes (`/`, `/_not-found`, `/agent/[id]` dynamic, `/demo-consumer`, `/feed/[category]` dynamic, `/leaderboard`), TypeScript pass, static generation ok (Recharts emits a benign width/height warning during SSR — harmless, hydration sizes the chart on client).

**Decisions:**
- **Route group `(app)` for terminal pages**, landing stays at root. This lets `app/(app)/layout.tsx` mount the AppHeader/AppFooter only on the terminal pages without touching the landing's cinematic chrome.
- **Split each dynamic page into `page.tsx` (server, awaits params) + `*Client.tsx` (client interactive shell)**. Next.js 16 requires the await; clean separation also keeps the metadata generation in the server file.
- **No wallet/wagmi mount yet** — Prompt 11 territory. AppHeader's "Connect" button is rendered as a `disabled` stub with explanatory title attribute.
- **`/feed/[category]` shipped as a bonus** (not in PRD §9.2 must-haves) because it makes the consumer demo concrete: clicking through from leaderboard → composite feed → consumer shows the full data path.
- **Agent kinds use a 2-char glyph token** (CL/AR/QU/EN) instead of an icon to keep the visual language uniform with the terminal core. Color-coded per kind so the leaderboard scans at a glance.
- **Calibration bar is a single-direction warn-tone bar** (since values live in [-1e6, 0], closer to 0 is better). Made magnitude-anchored for intuitive sorting.
- **Reasoning trace expansion is button-row** (not modal). Keeps context — judges can scroll the prediction history and see traces inline.
- **Composite feed snapshot card uses live oscillation** via `useAnimationFrame` + sine wave so the leaderboard hero strip feels alive. NumberFlow tweens the value between ticks.
- **Auto-refresh in /demo-consumer is opt-out via checkbox.** Off by default for prefers-reduced-motion users (via `useReducedMotion()`); manual refresh always works.

**Risks / followups:**
- Mock data is hand-crafted, intentionally narrative-shaped (claude-reasoner-α wins, β trades accuracy for calibration, γ is the aggressive variant). When the indexer wires up in Prompt 11, the visual hierarchy will change — the page layouts handle real data the same way.
- Wallet integration (wagmi WagmiProvider + chain config + Connect button) is the only missing piece for end-to-end interactivity. Currently judges see a fully static-feel terminal — fine for the visual proof, but submission demo will need at least a read-only wallet connection.
- The "live read" in `/demo-consumer` is simulated. When CompositeFeed deploys (Prompt 7), swap the `setInterval` for a wagmi `useReadContract` watch. Hook surface is the same.
- AppHeader nav active-state matching uses `pathname.startsWith(item.href.split("/").slice(0, 2).join("/"))` — works but is brittle for nested routes; if more top-level paths get added, refactor to a proper matcher.
- Next.js emits a multi-lockfile warning because the workspace has both root and `frontend/` pnpm-workspace.yaml. Filed in existing build-status as a deferred cleanup.

### 2026-05-26 — Prompt 4 (ResolutionEngine + MethAprResolver + MockMethRateOracle)
**Type:** Build (Prompt 4)
**Touched files:** `contracts/src/ResolutionEngine.sol` (new), `contracts/src/resolvers/MethAprResolver.sol` (new), `contracts/src/mocks/MockMethRateOracle.sol` (new), `contracts/src/interfaces/{ICategoryResolver,IScoringEngine,IMethRateOracle}.sol` (new), `contracts/test/ResolutionEngine.t.sol` (new), `contracts/test/MethAprResolver.t.sol` (new), `contracts/script/SeedRates.s.sol` (new), `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- Implemented ResolutionEngine per PRD §7.3 + Prompt 4 spec. Single source of truth for `(categoryId → resolver, scorer, configBytes)`. `resolve(predictionId)` is permissionless; the caller becomes `resolverCaller` passed through `IScoringEngine.applyScore` and ultimately earns the 2% gas reward inside `PredictionMarket.settleStake`. Three failure modes encoded with distinct errors: `AlreadyResolved`, `PredictionNotRevealed`, `ResolutionBlockNotReached`. Owner-gated `registerCategory` rejects duplicates and zero addresses; `updateCategory` allows in-place mutation for already-registered ids.
- Implemented MethAprResolver per PRD §7.3.1 formula `aprBps = ((rateNow * 1e18 / ratePrior - 1e18) * 365 * 10000) / 1e18`. Edge cases: `ratePrior == 0` or `rateNow <= ratePrior` returns 0; `resolutionBlock < BLOCKS_PER_DAY (43200)` short-circuits to 0. Reads from `IMethRateOracle.getRateAt`.
- Implemented MockMethRateOracle as a minimal admin-seeded `mapping(uint256 => uint256) rates` store with `setRate` / `setRates` batch and `getRateAt` (reverts on unset) + `rateOrZero` (non-reverting). Used for v1 because direct mETH staking-contract reads at arbitrary historical blocks require an archive node.
- Built `script/SeedRates.s.sol`: env-driven (`MOCK_METH_ORACLE`, `BASE_BLOCK`, `SEED_DAYS`, `DAILY_GROWTH_PPM`) script that populates 15 (= days+1) consecutive daily snapshots into the oracle with a synthetic linear-growth pattern (default 0.0008%/day ≈ 2.92% APR baseline).
- Tests: 13 ResolutionEngine cases (constructor, register/update happy + reverts, resolve happy with full E2E settle through PredictionMarket via a `MockScoringEngine`, resolve reverts on already-resolved, before-block, unrevealed, scoring-engine-unset, category-not-registered) + 14 MethAprResolver cases (3 hand-verified APR computations: 1.01/1.00 → 36500 bps, 1.0001/1.00 → 365 bps, 1.5/1.2 → 912500 bps; edge: equal rates → 0, negative delta → 0, prior unset → oracle reverts, resolutionBlock below day window → 0, prediction-value irrelevance, oracle access control). Full suite: 94/94 across four contracts.

**Decisions:**
- **`MockScoringEngine` in tests forwards to `PredictionMarket.settleStake` with a fixed 2%/98%/0% split** so the E2E resolve flow can be observed end-to-end (resolver paid in MNT, agent returned residual, status transitioned to Resolved, score persisted). This lets us assert `AlreadyResolved` revert by attempting a second `resolve()` — the second attempt sees `status == Resolved` and reverts with the matching error.
- **`AlreadyResolved` check ordered BEFORE `PredictionNotRevealed`.** Both could route through a generic "wrong status" revert, but giving double-resolution attempts a distinct error makes the resolver-bot's failure path debuggable.
- **`updateCategory` admitted as a separate function** (Prompt 4 spec did not list it). Reason: tying admin to *one-shot* `registerCategory` would lock in any config error and force a full redeploy. Owner-only mutation is acceptable v1 risk.
- **`MethAprResolver` ignores `predictionValue`** because APR resolution is a global metric — same outcome regardless of any one agent's forecast. Tested explicitly via `test_Resolve_IgnoresPredictionValue`.
- **Oracle reverts on unset rate** rather than returning 0. The resolver's clamp logic only fires on `ratePrior == 0` and `rateNow <= ratePrior`; if a resolver bot calls `resolve()` for a block range where the oracle isn't seeded, the call should fail loudly so the bot retries after the next `SeedRates` run.
- **Build-time concern surfaced and noted:** PredictionMarket's `settleStake` currently requires `bonusPool != address(0)` even when `bonusAmount == 0`. The mock scoring engine works around this by ensuring the bonus pool is wired in the test setUp; production ScoringEngine will pass non-zero bonusAmount on imperfect scores so the check stays sensible. No change made.

**Risks / followups:**
- ScoringEngine (Prompt 5) will need to: (a) read prediction state from PredictionMarket, (b) call ICategoryScorer via the scorer addr passed in, (c) update AgentRegistry reputation, (d) split stake per §7.2.4 formula, (e) call BonusDistributor with both `recordContribution` (storage) and `notifySlash` (ETH) — note PRD §7.4 step 6 wants notifySlash here but the ETH lives in PredictionMarket, so it actually flows via `PredictionMarket.settleStake`'s bonusAmount routing.
- BonusDistributor stub (`IBonusDistributor`) needs to be expanded to a full contract with `recordContribution(bytes32 categoryId, uint256 agentId, uint256 share)` view-storage method. Will define in Prompt 5/6.
- The "must use archive RPC" warning for direct mETH reads should be moved into the contract NatSpec block — currently only in CLAUDE.md.

### 2026-05-26 — Prompt 3 (PredictionMarket commit-reveal)
**Type:** Build (Prompt 3)
**Touched files:** `contracts/src/PredictionMarket.sol` (new), `contracts/src/interfaces/IPredictionMarket.sol` (new), `contracts/src/interfaces/IBonusDistributor.sol` (new stub), `contracts/test/PredictionMarket.t.sol` (new), `masterdoc/09-build-status.md`, `CLAUDE.md`

**What happened:**
- Implemented PredictionMarket per PRD §7.2 + Prompt.md Prompt 3 spec. ERC-stake escrow keyed on native MNT (`msg.value`).
- Constants: `REVEAL_DELAY_BLOCKS=10`, `REVEAL_WINDOW_BLOCKS=100`, `SUBMISSION_CUTOFF_BLOCKS=200`, derived `MIN_RESOLUTION_OFFSET=300`, `CANCEL_REFUND_BPS=9000`, `FORFEIT_CALLER_BPS=50`, `MAX_CONFIDENCE_BPS=10000`.
- Category registry (`mapping(bytes32 => Category)`): resolver, scorer, minStake, allowedWindowStart, allowedWindowEnd, configBytes, registered flag. `registerCategory` validates `allowedWindowStart >= MIN_RESOLUTION_OFFSET` so any successful commit leaves the full reveal+cutoff buffer.
- `commit`: validates category registered, `resolutionBlock >= block.number + 300`, delta within category window, stake >= minStake, msg.sender == agentRegistry.controllerOf(agentId). Stores Prediction in `Committed` state.
- `reveal`: checks status, recomputes `keccak256(abi.encode(agentId, categoryId, value, confidence, nonce))`, asserts reveal window `[commit+10, commit+100]` AND `block.number <= resolutionBlock - 200`, confidence ≤ 10000. Writes value/confidence/status.
- `cancel`: only controller, only pre-resolution. 90% refund to controller, 10% forwarded to bonus pool via `IBonusDistributor.notifySlash{value}(categoryId)`. Status → Cancelled. Allowed from either Committed or Revealed.
- `forfeitUnrevealed`: anyone after `commitBlock + REVEAL_WINDOW_BLOCKS`, only on Committed. 0.5% caller reward (push via `call{value}`), 99.5% to pool. Status → Forfeited.
- `settleStake(predictionId, returnAmount, bonusAmount, resolverReward, address resolver) onlyScoringEngine`: enforces `returnAmount + bonusAmount + resolverReward == p.stake` (StakeConservationViolated revert), pays resolver FIRST per PRD §7.2.4 invariant, then controller, then pool. Status → Resolved. Score is stored via a separate `setScore(uint256, int256) onlyScoringEngine` so ScoringEngine can persist it atomically alongside the settle call.
- ReentrancyGuard on `commit`, `cancel`, `forfeitUnrevealed`, `settleStake`. Reveal is non-mutating-stake so left guard-free.
- `IBonusDistributor` interface stub created at `contracts/src/interfaces/IBonusDistributor.sol` with single `notifySlash(bytes32) payable` entrypoint. Full BonusDistributor lives in Prompt 5; using a stub lets PredictionMarket compile and be tested independently.
- Tests: 39 cases in `PredictionMarket.t.sol`. Covers happy paths + every revert path (category unregistered, stake below min, resolution too soon, outside window, non-controller commit, wrong nonce, reveal too early/late, confidence out of range, already revealed, cancel after resolution, cancel non-controller, cancel already-resolved, forfeit before window, forfeit already-revealed, settle non-scoring-engine, settle pre-reveal, conservation violation, bonus-pool-unset on forfeit), 2 fuzz tests (commit-reveal roundtrip 256 runs, settleStake conservation 256 runs), and 1 reentrancy test (malicious pool's `notifySlash` calls `market.commit` during cancel → reverts with `ReentrancyGuardReentrantCall`). 67/67 across both suites pass.

**Decisions:**
- **`settleStake` signature extended** beyond PRD §7.2 to include `address resolver` (Prompt.md was already explicit). Prevents the storage roundtrip ScoringEngine would otherwise need to remember the original `resolve()` caller. Score still written via `setScore` rather than as a `settleStake` parameter so ScoringEngine can decouple the two writes if needed.
- **`MIN_RESOLUTION_OFFSET = REVEAL_WINDOW + SUBMISSION_CUTOFF = 300` is a hard floor independent of category.** Category's `allowedWindowStart` must be ≥ 300 (enforced at registration). This collapses an unreachable subspace of the reveal validation: `block.number > resolutionBlock - 200` and `block.number > commitBlock + 100` always trigger in the same order. The `RevealTooCloseToResolution` branch remains for defense-in-depth but the corresponding test asserts the `RevealTooLate` branch fires first — documented in the test comment block.
- **`setScore` kept as separate `onlyScoringEngine` setter.** Adding `score` as a `settleStake` parameter would create a four-stage shuffle (resolver/controller/pool/score) inside one nonReentrant function. The two-call pattern lets ScoringEngine commit score even if settle reverts for accounting reasons (and lets ResolutionEngine emit a `Scored` event prior to settlement if desired).
- **Stake conservation enforced via equality assert**, not subtraction. ScoringEngine is required to pre-compute the three numbers that sum to `stake`. Pushes the math (and any rounding-residue handling) up into ScoringEngine where the score-to-amount formula lives.
- **Bonus pool slash uses `notifySlash{value}(categoryId)` for all three sources** (cancel slash, forfeit pool, settle bonus). BonusDistributor (Prompt 5) reads `msg.value` as the slash amount and the categoryId as the epoch key. PredictionMarket itself is decoupled from epoch mechanics.
- **`bonusPool == address(0)` reverts at cancel/forfeit/settle time, not at commit.** Lets the contract be deployed and accept commits before BonusDistributor exists; settlement requires admin to wire the pool. Acceptable for the hackathon deployment order (PredictionMarket → BonusDistributor → ScoringEngine → ResolutionEngine).

**Risks / followups:**
- ScoringEngine (Prompt 6) must call `setScore` before or atomically with `settleStake`. If it skips `setScore`, the `PredictionResolved` event emits `score = 0`. Document this in Prompt 6 spec.
- ResolutionEngine (Prompt 4) needs the resolver address passed to ScoringEngine, which passes it to `settleStake`. That dataflow is documented in Prompt 4 already — no schema changes needed.
- `forfeitUnrevealed`'s push to caller uses `.call{value}`. If a smart-contract caller's fallback OOGs, the whole forfeit reverts and the stake stays escrowed. Acceptable for hackathon; for production, switch caller reward to a pull-claim. Filed mentally for v2.

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
