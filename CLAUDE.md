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
