# Predictor Index — DoraHacks submission

**Hackathon:** The Turing Test Hackathon 2026 (Mantle × Bybit × Byreal × BGA)
**Track:** AI x RWA (primary) · Best UX / Smoothest Web2 Onboarding · Grand Champion (nominated)

## One-liner

Portable reputation for AI agents on Mantle — proven through scored RWA forecasts that power yield allocation and risk controls.

## Description

**The problem.** AI agents are starting to make financial recommendations — yield predictors, risk models, trading bots — but protocols have no neutral way to know which agents are actually reliable. Track records are screenshots, reasoning is a black box, and confidence claims are unfalsifiable. Before protocols can trust agents with money, risk, or automation, agents need a public reputation passport.

**The solution.** Predictor Index is a portable reputation layer for AI agents. Agents register ERC-8004 identities, submit forecasts on Mantle ecosystem metrics through a commit-reveal scheme, and have every prediction auto-scored against verifiable outcomes using a closed-form CRPS scorer. Each agent accumulates per-category accuracy and calibration reputation. The public scorecard answers: has this agent been right before, in this category, with this confidence, under public scoring?

**ERC-8004 integration.** Every agent's identity is a soulbound ERC-8004 NFT. Reputation accrues to the token, not the controller wallet, so a controller key can be rotated (behind a 24h timelock) without losing history, and an agent identity can't be sold, transferred, or laundered through a fresh address. A 0.1 MNT registration fee deters spam and seeds the bonus pool. Because predictions are committed before the outcome is known and the full reasoning trace (for the DeepSeek agent) is pinned to IPFS and hash-committed on-chain, the track record is independently verifiable — this is the Turing Test hackathon's thesis made concrete: **every AI decision, on-chain.**

**RWA composition (mETH + USDY).** Mantle RWA is the first proof case. Predictor Index forecasts and resolves against **mETH** staking APR and **USDY** (Ondo's tokenized US-Treasury stablecoin) APY — plus Aave-on-Mantle TVL — using on-chain resolvers, staking/settling in native MNT. The top-scored agents combine into a rank-weighted **composite feed** that two reference consumers use: a **YieldAllocator** computes confidence-weighted allocation across mETH and USDY (the "dynamic yield strategy"), and a **RiskManager** derives collateral factors, deposit caps, and a Normal/Caution/Frozen risk state from forecast confidence + freshness (the "automated risk management"). Both are advisory/read-only — a real vault or lending market embeds them — a deliberate scope choice (no custody) for the hackathon.

**Revenue model.** The first product is the public scorecard: a tamper-resistant history of which agents were right. The paid product is the feed built from those reputations. Post-hackathon revenue target: RWA and DeFi protocols subscribe to the gated composite feed once live resolvers and a longer track record are in place. The subscription gate is built and architecturally proven; it's left open in v1 so hackathon judges can read freely. Secondary value: data licensing and premium analytics tiers.

## Track justification — AI x RWA

The track asks for *"dynamic yield strategies and automated risk management for assets including USDY and mETH, built on Mantle's RWA infrastructure."* Predictor Index hits every clause: it forecasts **mETH** and **USDY** yield (both named in the track), the **YieldAllocator** is the dynamic yield strategy, and the **RiskManager** is the automated risk management — all driven by AI forecasts that are verifiable on-chain rather than a black box. The novel angle: the yield/risk logic is powered by a *competitive, reputation-weighted AI forecast feed*, not a single oracle.

## Second award — Best UX / Smoothest Web2 Onboarding

The `/rwa` page is a deliberately Web2-friendly surface: **no wallet, no login, no MetaMask** — ever. A traditional user types a deposit amount and instantly sees projected annual yield, the AI's auto-balanced allocation, and a plain-language safety check, computed client-side from the live feed. Crypto jargon is translated throughout (bps → %, "composite feed" → "AI consensus forecast", risk enum → "Looking healthy / Cautious / Paused"). It's grounded in an accessible-by-design system (WCAG contrast, SVG-not-emoji icons, reduced-motion, keyboard, 375px) and is the conversion bridge from curious Web2 users to the on-chain product.

The Grand Champion nomination is justified by full-stack depth (11 production contracts + 2 reference AI agents + indexer + frontend) and genuine Mantle composition.

## What was built (concrete)

- **Smart contracts (Foundry, Solidity 0.8.24, 157/157 tests):** AgentRegistry (ERC-8004 soulbound + per-category top-20), PredictionMarket (commit-reveal escrow), ResolutionEngine, ScoringEngine + RangeCrpsScorer (closed-form CRPS with a Python reference matching the Solidity bit-for-bit), MethAprResolver + AaveMantleTvlResolver + UsdyApyResolver, CompositeFeed (rank-weighted, calibration-multiplier), BonusDistributor (pull-claim epochs), SubscriptionGate, DemoFeedConsumer (business-logic views), and the AI × RWA consumers **YieldAllocator** (confidence-weighted dynamic allocation across mETH + USDY) + **RiskManager** (automated risk state from forecast confidence + freshness), + mocks. Full deploy + smoke + end-to-end pipeline scripts/tests.
- **Reference agents (TypeScript):** a shared SDK (commit/reveal/submit, nonce batching, retry, IPFS), an **ARIMA(1,1,1)** statistical baseline (pure-TS), and a **DeepSeek reasoner** (demo highlight) that builds context from on-chain data + news, prompts DeepSeek with a calibration-aware system prompt + hand-written few-shot examples, and pins the full prompt/response/forecast as the on-chain content hash. Plus a permissionless refresher cron.
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
