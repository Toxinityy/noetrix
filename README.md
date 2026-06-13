<div align="center">

<img src="frontend/public/logo-noetrix.png" alt="Noetrix" width="300" />

# Noetrix · Predictor Index

**Verifiable on-chain reputation for AI forecasters on Mantle.**

Every prediction _committed before the outcome_ → CRPS-graded against on-chain truth → distilled into a trustable alpha signal.

<br/>

[![Live App](https://img.shields.io/badge/▲_Live_App-noetrix.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://noetrix.vercel.app)
[![Mantle Sepolia](https://img.shields.io/badge/Mantle-Sepolia_·_5003-65B3AE?style=for-the-badge&logo=ethereum&logoColor=white)](https://sepolia.mantlescan.xyz)
[![Docs](https://img.shields.io/badge/Docs-GitBook-3884FF?style=for-the-badge&logo=gitbook&logoColor=white)](https://noetrix.gitbook.io/product-docs/)

![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity&logoColor=white)
![Foundry](https://img.shields.io/badge/Foundry-191_tests_passing-2EA043?style=flat-square)
![Contracts](https://img.shields.io/badge/Contracts-19_verified-65B3AE?style=flat-square&logo=ethereum&logoColor=white)
![ERC-8004](https://img.shields.io/badge/Identity-ERC--8004-F6851B?style=flat-square)
![Agents](https://img.shields.io/badge/Swarm-7_AI_agents_live-9B5DE5?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)

`The Turing Test Hackathon 2026` — Mantle × Bybit × Byreal × BGA<br/>
Track: **AI Alpha & Data** · also **AI × RWA** · **Best UX / Web2 Onboarding** · 🏆 **Grand Champion** nominated

<a href="#-the-thesis">Thesis</a> &nbsp;·&nbsp;
<a href="#-architecture">Architecture</a> &nbsp;·&nbsp;
<a href="#-run-it-in-60-seconds">Quickstart</a> &nbsp;·&nbsp;
<a href="#-deployed-contracts">Contracts</a> &nbsp;·&nbsp;
<a href="#-live-links">Links</a> &nbsp;·&nbsp;
<a href="#-submission">Submission</a>

</div>

---

## ⚡ The thesis

AI agents are starting to make financial recommendations — but protocols have **no neutral way to know which agents are actually reliable.** Track records are screenshots, reasoning is a black box, and confidence is unfalsifiable. Noetrix makes AI forecasting **provable**: agents get ERC-8004 reputation passports, commit predictions *before* outcomes are known, and have every forecast auto-scored on-chain.

Each agent is a soulbound **ERC-8004** NFT that accumulates per-category accuracy and calibration reputation. A **commit-reveal** scheme stops last-minute fitting; a closed-form **CRPS** scorer turns each forecast into a signed score; and the public scorecard shows which agents have been right before, in which category, with which confidence. For the LLM agent, the full reasoning trace is pinned to **IPFS** and hash-committed on-chain — so the track record is independently verifiable.

```text
register → commit → reveal → resolve → CRPS score → reputation → composite feed
```

> **The hackathon's thesis, made concrete: every AI decision, on-chain.**

**Mantle RWA is the first proof case.** Noetrix forecasts and resolves against **mETH** staking APR, **USDY** treasury APY, and **Aave-on-Mantle** TVL — then turns the top-scored agents into a rank-weighted **composite feed**. Two RWA consumers read that feed: a **YieldAllocator** for dynamic mETH/USDY allocation and a **RiskManager** for confidence-gated risk parameters. The scorecard earns trust first; the post-hackathon revenue target is a gated feed subscription once live resolvers and a longer track record are in place.

---

## 🧩 Architecture

```mermaid
flowchart TD
    subgraph offchain["Off-chain"]
      AGENTS["7 agents: arima-baseline · naive-baseline · deepseek-reasoner<br/>+ swarm-runner (mean-reversion · momentum · ewma-vol · sentiment)"]
      SDK["agent SDK + forecasters lib"]
      RESOLVERBOT["resolver bot"]
      REFRESH["refresher cron"]
      KEEPER["sentiment keeper (daily F&G)"]
      IDX["Ponder indexer + REST"]
      FE["Next.js frontend"]
    end

    subgraph chain["Mantle Network (L2)"]
      AR["AgentRegistry (ERC-8004 + topAgents)"]
      PM["PredictionMarket (commit-reveal escrow)"]
      RE["ResolutionEngine"]
      RES["Resolvers: MethApr / UsdyApy / AaveMantleTvl"]
      SE["ScoringEngine + RangeCrpsScorer"]
      BD["BonusDistributor (pull-claim epochs)"]
      CF["CompositeFeed + SubscriptionGate"]
      SENT["SentimentOracle (Fear & Greed)"]
      CONS["Consumers: DemoFeedConsumer ·<br/>YieldAllocator · RiskManager"]
      MSM["MarketStressMonitor (3-level alert)"]
    end

    AGENTS -->|commit/reveal via SDK| PM
    SDK --> AR
    KEEPER -->|post F&G| SENT
    SENT -->|fear & greed| AGENTS
    RESOLVERBOT -->|"resolve()"| RE
    PM --> RE --> RES
    RE --> SE --> AR
    SE --> BD
    AR -->|top-20| CF
    PM -->|latest revealed| CF
    REFRESH -->|refresh| CF
    CF --> CONS
    CF --> MSM
    SENT --> MSM
    chain --> IDX --> FE
```

> **15 production contracts + 4 mock instances = 19 deployed addresses.** Full spec in [`docs/PRD.md`](docs/PRD.md) · product docs on [GitBook](https://noetrix.gitbook.io/product-docs/).

---

## 🚀 Run it in 60 seconds

**Judges start here.**

**Zero setup** — the app is live at **[noetrix.vercel.app](https://noetrix.vercel.app)**, wired to the deployed Mantle Sepolia contracts. Nothing to install.

**Run locally** — no chain, no keys, no env. The frontend renders demo/snapshot data out of the box:

```bash
pnpm install
cd frontend && pnpm dev      # → http://localhost:3000
```

To point at live on-chain data instead, set the env described under **Quick start → Frontend** below.

---

## 🛠️ Quick start (full stack)

**Prereqs:** Node 22+, pnpm 10+, Foundry. From the repo root:

```bash
pnpm install          # installs all workspace packages
```

<details>
<summary><strong>📜 Contracts</strong> — Foundry build, test & deploy</summary>

```bash
cd contracts
forge build
forge test                                   # 191 tests

# deploy (needs a funded key):
forge script script/Deploy.s.sol:Deploy --rpc-url $MANTLE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY --broadcast --verify
forge script script/SeedRates.s.sol:SeedRates --rpc-url $MANTLE_SEPOLIA_RPC \
  --private-key $PRIVATE_KEY --broadcast        # seed the mock oracle
```
</details>

<details>
<summary><strong>🗂️ Indexer</strong> — Ponder event handlers + REST</summary>

Copy `indexer/.env.example` → `.env`, set the deployed addresses + RPC + start block:

```bash
cd indexer && pnpm dev          # REST at http://localhost:42069
```
</details>

<details>
<summary><strong>🖥️ Frontend</strong> — Next.js cinematic landing + terminal app</summary>

Copy `frontend/.env.example` → `.env.local` (set `NEXT_PUBLIC_INDEXER_URL` + addresses, or leave unset to run on mock data):

```bash
cd frontend && pnpm dev         # http://localhost:3000
pnpm --filter frontend test     # vitest unit suite
pnpm --filter frontend test:e2e # Playwright smoke (needs a dev server / chromium)
```
</details>

<details>
<summary><strong>🤖 Agents & bots</strong> — forecasters + pipeline keepers</summary>

Each package has its own `.env.example` (controller key, RPC, indexer URL, `OPENROUTER_API_KEY` for the reasoner). Register forecasters once, then run them; the resolver + refresher bots keep the pipeline turning (predictions don't score and the feed doesn't update without them):

```bash
# forecasters (register mints the ERC-8004 identity; needs a funded controller key)
cd agents/arima-baseline    && pnpm register && pnpm start
cd agents/naive-baseline    && pnpm register && pnpm start
cd agents/deepseek-reasoner && pnpm register && pnpm start
cd agents/swarm-runner      && pnpm register && pnpm start   # 4-strategy swarm

# pipeline bots (separate small hot wallets, not agent keys)
cd agents/resolver          && pnpm start      # scores matured predictions
cd agents/refresher         && pnpm start      # refreshes CompositeFeed; `--once` for cron platforms
```

> ⚠️ **Gotcha:** after any contract redeploy, delete `agents/resolver/resolver.state.json` (stale prediction cursor) and each agent's `agent.state.json`.
</details>

**🌐 Production hosting** — the live pipeline (indexer + 7 forecasters + resolver + refresher + a daily sentiment keeper) runs under **pm2** on a self-hosted server, with the indexer exposed through a **Cloudflare Tunnel** and Postgres on **Supabase**. Config lives in [`deploy/ecosystem.config.js`](deploy/ecosystem.config.js); full operator runbook in [`docs/SERVER_DEPLOY.md`](docs/SERVER_DEPLOY.md).

---

## 📜 Deployed contracts

> **Mantle Sepolia · chainId `5003`.** All 19 contracts are source-verified on the explorer (Etherscan V2). Addresses link straight to Mantlescan. Authoritative source: [`contracts/deployments/mantle-sepolia.json`](contracts/deployments/mantle-sepolia.json).

| Layer | Contract | Address |
|-------|----------|---------|
| 🧠 **Core** | AgentRegistry | [`0x5B1599C08d32fBeD095B37E1A17C1cc03dcc3396`](https://sepolia.mantlescan.xyz/address/0x5B1599C08d32fBeD095B37E1A17C1cc03dcc3396) |
| | PredictionMarket | [`0xaa92b0434F89a17F2275b655c6fA459C43813f22`](https://sepolia.mantlescan.xyz/address/0xaa92b0434F89a17F2275b655c6fA459C43813f22) |
| | ResolutionEngine | [`0xBB62C1948D35DCf60259c2003bbf3d9578DDB825`](https://sepolia.mantlescan.xyz/address/0xBB62C1948D35DCf60259c2003bbf3d9578DDB825) |
| | ScoringEngine | [`0x8993D6b4a3CEA896a77558A1AfD2896d3505F517`](https://sepolia.mantlescan.xyz/address/0x8993D6b4a3CEA896a77558A1AfD2896d3505F517) |
| | RangeCrpsScorer | [`0xDf39a2994CF82b3d6Fd2e27F904A5dE1c3C36487`](https://sepolia.mantlescan.xyz/address/0xDf39a2994CF82b3d6Fd2e27F904A5dE1c3C36487) |
| | BonusDistributor | [`0xD4Aa72f2628797a99b98dC06e0772b995691E9B0`](https://sepolia.mantlescan.xyz/address/0xD4Aa72f2628797a99b98dC06e0772b995691E9B0) |
| 📡 **Feed / consumer** | CompositeFeed | [`0x695aC1428FcFAb4406468A664FD7670b968aB689`](https://sepolia.mantlescan.xyz/address/0x695aC1428FcFAb4406468A664FD7670b968aB689) |
| | SubscriptionGate | [`0x21D39847d46299C358181e25741BFceee097705f`](https://sepolia.mantlescan.xyz/address/0x21D39847d46299C358181e25741BFceee097705f) |
| | DemoFeedConsumer | [`0x7434CA16d6d497F070B36dDB0D036ab91903A742`](https://sepolia.mantlescan.xyz/address/0x7434CA16d6d497F070B36dDB0D036ab91903A742) |
| 💎 **AI × RWA** | YieldAllocator | [`0xD68ABfAD2f7429A71ae98dEc0203c4F0032b447d`](https://sepolia.mantlescan.xyz/address/0xD68ABfAD2f7429A71ae98dEc0203c4F0032b447d) |
| | RiskManager | [`0xEfE0edF058f364D9BdF65eD206c58019CD1Cb21B`](https://sepolia.mantlescan.xyz/address/0xEfE0edF058f364D9BdF65eD206c58019CD1Cb21B) |
| 🌪️ **Swarm / stress** | SentimentOracle | [`0x43F573B43C6AD990FAFA388E1E34710c535b1e46`](https://sepolia.mantlescan.xyz/address/0x43F573B43C6AD990FAFA388E1E34710c535b1e46) |
| | MarketStressMonitor | [`0xF8a5122f0167c06BFAa57B6203eF962Ab7750eB6`](https://sepolia.mantlescan.xyz/address/0xF8a5122f0167c06BFAa57B6203eF962Ab7750eB6) |
| 🔮 **Resolvers & oracles** | MethAprResolver | [`0x5c42FcFA0fC9D7fc556993eC6072cE029808E39b`](https://sepolia.mantlescan.xyz/address/0x5c42FcFA0fC9D7fc556993eC6072cE029808E39b) |
| | AaveMantleTvlResolver | [`0x93849a12b49f967A2c1eB6CD0A8e978D4d036a91`](https://sepolia.mantlescan.xyz/address/0x93849a12b49f967A2c1eB6CD0A8e978D4d036a91) |
| | UsdyApyResolver | [`0xdeCB5d17C52eC8665705F460Bc35B6e4556580E2`](https://sepolia.mantlescan.xyz/address/0xdeCB5d17C52eC8665705F460Bc35B6e4556580E2) |
| | MockMethRateOracle | [`0x19E22B85addb8D98ac471481C170029C2Ea6Fc8C`](https://sepolia.mantlescan.xyz/address/0x19E22B85addb8D98ac471481C170029C2Ea6Fc8C) |
| | UsdyOracle | [`0x19142Db9bd14C5D592022548C72f5D23D88c6597`](https://sepolia.mantlescan.xyz/address/0x19142Db9bd14C5D592022548C72f5D23D88c6597) |
| | MockAavePool | [`0x5F429885aed023b38866BC7CBFf803fF51DCDe36`](https://sepolia.mantlescan.xyz/address/0x5F429885aed023b38866BC7CBFf803fF51DCDe36) |

---

## 🔗 Live links

| | |
|---|---|
| 🌐 **Frontend** | [noetrix.vercel.app](https://noetrix.vercel.app) |
| 📖 **Docs (GitBook)** | [noetrix.gitbook.io/product-docs](https://noetrix.gitbook.io/product-docs/) |
| 🛰️ **Indexer API** | [`noetrix-indexer.jeco.my.id`](https://noetrix-indexer.jeco.my.id/leaderboard?category=METH_APR_24H) — REST: `/leaderboard` · `/agent/:id` · `/predictions` · `/feed` |
| 🎬 **Demo video** | _TBD — see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)_ |

---

## 🏆 Submission

**Track: AI Alpha & Data** (primary) — a verifiable on-chain leaderboard of AI forecasters: every prediction committed before the outcome, CRPS-graded against on-chain truth, surfaced as smart-money-vs-crowd signals, anomaly alerts, and a calibration-weighted composite feed.

- 💎 **AI × RWA** (secondary) — a **YieldAllocator** (dynamic mETH/USDY allocation) and **RiskManager** (automated risk state) consume that feed.
- ✨ **Best UX / Smoothest Web2 Onboarding** — the wallet-free `/simulation` deposit simulator.
- 🏆 **Grand Champion** nominated for full-stack depth (15 production contracts + a 7-agent AI forecasting swarm + indexer + frontend) and native Mantle composition.

Full submission: [`docs/SUBMISSION.md`](docs/SUBMISSION.md) · Pre-flight: [`docs/PREFLIGHT.md`](docs/PREFLIGHT.md) · Go-live runbook: [`docs/DEPLOY.md`](docs/DEPLOY.md) · Server hosting: [`docs/SERVER_DEPLOY.md`](docs/SERVER_DEPLOY.md)

---

## 📂 Repo layout

```text
contracts/   Foundry — 15 production contracts + 4 mocks, deploy/smoke/e2e
indexer/     Ponder — event handlers + REST API
frontend/    Next.js 16 — cinematic landing + terminal-core app
agents/      sdk, forecasters, arima-baseline, naive-baseline, deepseek-reasoner,
             swarm-runner, refresher, resolver, market-data, backtest
deploy/      pm2 ecosystem config, sentiment keeper, Cloudflare Tunnel example
docs/        PRD, submission, demo script, pre-flight, deploy + server runbooks
```

---

## 👥 Team

| | | |
|---|---|---|
| **William Arthur** | [@Toxinityy](https://github.com/Toxinityy) | Software Engineer |
| **Vico Pratama** | [@guguboo](https://github.com/guguboo) | Fullstack AI Engineer |

---

<div align="center">

**MIT Licensed** · Built on **Mantle** ⟁ for The Turing Test Hackathon 2026

<sub>Every AI decision, on-chain.</sub>

</div>
