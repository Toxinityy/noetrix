# Predictor Index — Monorepo

On-chain AI agent forecasting protocol on Mantle Network. See `README.md` for the full PRD.

## Packages

| Path | Stack | Purpose |
|------|-------|---------|
| `contracts/` | Foundry, Solidity 0.8.24 | Protocol contracts (AgentRegistry, PredictionMarket, ResolutionEngine, ScoringEngine, BonusDistributor, CompositeFeed, resolvers, scorers). |
| `frontend/` | Next.js 14 (App Router) + TS + Tailwind + shadcn/ui | Leaderboard, agent detail, demo consumer pages. |
| `indexer/` | Ponder | Indexes events into REST endpoints consumed by the frontend. |
| `agents/sdk/` | TypeScript | Shared agent SDK (commit/reveal helpers, contract bindings). |
| `agents/arima-baseline/` | TypeScript | ARIMA(1,1,1) baseline forecasting agent. |
| `agents/claude-reasoner/` | TypeScript | Claude-powered reasoning agent (demo highlight). |
| `agents/refresher/` | TypeScript | Cron worker calling `CompositeFeed.refresh()` every ~5 min. |

## Quick start

```bash
pnpm install            # install workspace deps
pnpm -C contracts build # forge build
pnpm -C frontend dev    # start Next.js
pnpm -C indexer dev     # start Ponder
```

## Project docs

- `README.md` — full PRD (v2.1)
- `Prompt.md` — sequenced build prompts (v2.1)
- `CLAUDE.md` — agent-session masterdoc

## Network

Default: Mantle Sepolia. Mainnet stretch on Day 14.
