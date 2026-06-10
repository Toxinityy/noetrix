# Predictor Index — DoraHacks submission

**Hackathon:** The Turing Test Hackathon 2026 (Mantle × Bybit × Byreal × BGA)
**Track:** AI Alpha & Data (primary) · AI x RWA · Best UX / Smoothest Web2 Onboarding · Grand Champion (nominated)

## One-liner

Verifiable on-chain reputation for AI forecasters on Mantle — every prediction committed before the outcome, CRPS-graded against on-chain truth, and turned into a trustable alpha signal protocols and traders can read.

## Description

**The problem.** AI agents are starting to make financial recommendations — yield predictors, risk models, trading bots — but protocols have no neutral way to know which agents are actually reliable. Track records are screenshots, reasoning is a black box, and confidence claims are unfalsifiable. Before protocols can trust agents with money, risk, or automation, agents need a public reputation passport.

**The solution.** Predictor Index is a portable reputation layer for AI agents. Agents register ERC-8004 identities, submit forecasts on Mantle ecosystem metrics through a commit-reveal scheme, and have every prediction auto-scored against verifiable outcomes using a closed-form CRPS scorer. Each agent accumulates per-category accuracy and calibration reputation. The public scorecard answers: has this agent been right before, in this category, with this confidence, under public scoring?

**ERC-8004 integration.** Every agent's identity is a soulbound ERC-8004 NFT. Reputation accrues to the token, not the controller wallet, so a controller key can be rotated (behind a 24h timelock) without losing history, and an agent identity can't be sold, transferred, or laundered through a fresh address. A 0.1 MNT registration fee deters spam and seeds the bonus pool. Because predictions are committed before the outcome is known and the full reasoning trace (for the DeepSeek agent) is pinned to IPFS and hash-committed on-chain, the track record is independently verifiable — this is the Turing Test hackathon's thesis made concrete: **every AI decision, on-chain.**

**RWA composition (mETH + USDY).** Mantle RWA is the first proof case. Predictor Index forecasts and resolves against **mETH** staking APR and **USDY** (Ondo's tokenized US-Treasury stablecoin) APY — plus Aave-on-Mantle TVL — using on-chain resolvers, staking/settling in native MNT. The top-scored agents combine into a rank-weighted **composite feed** that two reference consumers use: a **YieldAllocator** computes confidence-weighted allocation across mETH and USDY (the "dynamic yield strategy"), and a **RiskManager** derives collateral factors, deposit caps, and a Normal/Caution/Frozen risk state from forecast confidence + freshness (the "automated risk management"). Both are advisory/read-only — a real vault or lending market embeds them — a deliberate scope choice (no custody) for the hackathon.

**Revenue model (two-sided).** Two distinct sides, two flows — nobody does both. **Agent operators** (supply) stake MNT per forecast as skin-in-the-game and earn it back plus rewards when accurate; they never subscribe. **Consumers** (demand) — traders and protocols — subscribe for the *output*: the calibration-weighted alpha signal + anomaly alerts, not raw reads (v1 reads stay open, so a subscription proves the on-chain payment rail rather than gating free data). The stake makes the data credible; the subscription monetizes the credibility. On Mantle's L2 gas, operating cost is ~$220/mo, so break-even is roughly one paying integration. Path: free trials → accumulated track record → flip the gate.

## Vision — the credit bureau for AI agents

The 3-metric Mantle yield feed is the *first proof case*, not the ceiling. The durable wedge is a **portable, un-fakeable reputation passport for autonomous AI agents**: a soulbound ERC-8004 identity that accumulates a track record no one can backdate or cherry-pick (forecasts are committed before outcomes and graded on-chain). As the agent economy grows, every protocol that lets an AI agent touch money, risk, or parameters will first ask *"which agents can I trust?"* — and that score has to live somewhere neutral and verifiable. Noetrix is that scoreboard. The moat is the accumulated history itself (a forker starts at zero) plus the soulbound reputation locked to the protocol — a credit-bureau-style, winner-take-most data primitive, with Mantle as its home.

## Track justification — AI Alpha & Data (primary)

The track rewards **smart-money tracking, anomaly detection, and on-chain data products**. Predictor Index delivers all three, and grounds them in something most "alpha" tools can't: a *provable* track record.

- **The data product** is a verifiable on-chain leaderboard of AI forecasters. Every prediction is committed before the outcome is known and CRPS-graded against on-chain truth, so "which agent is actually right, in which category, at which confidence" is a tamper-resistant fact, not a screenshot.
- **Smart-money signals.** `/insights` turns the scored agents into accuracy-weighted *smart-money-vs-crowd* divergence, agent-disagreement spread, and a plain-English findings feed — the alpha, legible to a non-crypto trader.
- **Anomaly detection + alerts.** An anomaly feed surfaces when the qualified-agent consensus breaks from the crowd, with a Telegram/Discord alert preview — the productized data feed a trader subscribes to.
- **The signal.** The rank-weighted, calibration-weighted **composite feed** is the consensus alpha — valuable *because* the public scorecard proves the agents behind it have been right before.

The novel angle for the track: the alpha is **competitive and reputation-weighted**, and the reputation is **earned on-chain and impossible to fake** — verifiable AI data, not a black box.

## Secondary track — AI x RWA

Mantle RWA is the first proof case for the feed. Predictor Index forecasts and resolves against **mETH** staking APR and **USDY** (Ondo's tokenized US-Treasury stablecoin) APY — both named in the AI x RWA track — and two reference consumers turn the composite feed into applications: a **YieldAllocator** (confidence-weighted mETH/USDY allocation — the dynamic yield strategy) and a **RiskManager** (collateral factors, deposit caps, and a Normal/Caution/Frozen state from forecast confidence + freshness — the automated risk management). Both are advisory/read-only — a real vault or lending market embeds them — a deliberate no-custody scope choice for the hackathon.

## Second award — Best UX / Smoothest Web2 Onboarding

The `/simulation` page is a deliberately Web2-friendly surface: **no wallet, no login, no MetaMask** — ever. A traditional user types a deposit amount and instantly sees projected annual yield, the AI's auto-balanced allocation, and a plain-language safety check, computed client-side from the live feed. Crypto jargon is translated throughout (bps → %, "composite feed" → "AI consensus forecast", risk enum → "Looking healthy / Cautious / Paused"). It's grounded in an accessible-by-design system (WCAG contrast, SVG-not-emoji icons, reduced-motion, keyboard, 375px) and is the conversion bridge from curious Web2 users to the on-chain product.

The Grand Champion nomination is justified by full-stack depth (14 production contracts + 3 reference AI agents + indexer + frontend) and genuine Mantle composition.

## What was built (concrete)

- **Smart contracts (Foundry, Solidity 0.8.24, 191/191 tests):** AgentRegistry (ERC-8004 soulbound + per-category top-20), PredictionMarket (commit-reveal escrow), ResolutionEngine, ScoringEngine + RangeCrpsScorer (closed-form CRPS with a Python reference matching the Solidity bit-for-bit), MethAprResolver + AaveMantleTvlResolver + UsdyApyResolver, CompositeFeed (rank-weighted, calibration-multiplier), BonusDistributor (pull-claim epochs), SubscriptionGate, DemoFeedConsumer (business-logic views), and the AI × RWA consumers **YieldAllocator** (confidence-weighted dynamic allocation across mETH + USDY) + **RiskManager** (automated risk state from forecast confidence + freshness), + mocks. Full deploy + smoke + end-to-end pipeline scripts/tests.
- **Reference agents (TypeScript):** a shared SDK (commit/reveal/submit, nonce batching, retry, IPFS), an **ARIMA(1,1,1)** statistical baseline (pure-TS), a **naive persistence** control baseline (the textbook benchmark control, so the leaderboard reads naive < arima < reasoner), and a **DeepSeek reasoner** (demo highlight) that builds context from on-chain data + news, prompts DeepSeek with a calibration-aware system prompt + hand-written few-shot examples, and pins the full prompt/response/forecast as the on-chain content hash. Plus a permissionless refresher cron.
- **Indexer (Ponder):** event handlers + REST API (leaderboard, agent, predictions, feed history).
- **Frontend (Next.js 16, Radix + Tailwind + Motion):** cinematic landing + terminal-core app — leaderboard, agent detail with the **DeepSeek reasoning trace as the visual peak**, composite feed, and a live demo-consumer with on-chain decision cards. wagmi wallet connect, TanStack Query live data with a static cached fallback + "showing cached data" banner.

## What's next (post-hackathon roadmap)

- **M1–M3:** onboard 10 external agents; add MNT_PRICE_7D; **first paying protocol consumer.**
- **M4–M6:** Python SDK; StakingPool (public staking on agents); LayerZero cross-chain feed reads.
- **M7–M12:** binary event categories; reputation-weighted governance; first white-label.
- **Year 2:** data licensing; premium tiers; multi-model judge mechanism; migrate the on-chain top-agents sort to an indexer-driven feed for scale.

## Links

| | |
|---|---|
| GitHub | https://github.com/Toxinityy/mantle-hackathon |
| Live frontend | _TBD — Vercel deploy pending_ |
| Demo video | _TBD — record from `docs/DEMO_SCRIPT.md`_ |
| Deployed addresses | 17 contracts live — full table in [`README.md`](../README.md#deployed-addresses-mantle-sepolia-chainid-5003); source: `contracts/deployments/mantle-sepolia.json`. Headline: CompositeFeed `0xc962011f…`, YieldAllocator `0x3dde2344…`, RiskManager `0x2bFC2561…`, DemoFeedConsumer `0x85F0cb23…` |
| Network | Mantle Sepolia (testnet), chainId 5003 |

## Team

- **William Arthur** — [github.com/Toxinityy](https://github.com/Toxinityy) — Software Engineer
- **Vico Pratama** — [github.com/guguboo](https://github.com/guguboo) — Fullstack AI Engineer
