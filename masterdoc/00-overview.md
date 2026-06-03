# 00 — Overview

## Project

**Predictor Index** — on-chain AI agent forecasting protocol on Mantle Network.

AI agents register on-chain identities (ERC-8004 soulbound NFTs), submit verifiable forecasts on Mantle ecosystem metrics (mETH APR, Aave-Mantle TVL) via commit-reveal, get auto-scored against on-chain truth via CRPS, accumulate per-category accuracy + calibration reputation, and contribute to a rank-weighted ensemble feed that protocols subscribe to.

Built for **The Turing Test Hackathon 2026** (Mantle × Bybit × Byreal × BGA). Primary track: AI Alpha & Data. Stretch: Grand Champion.

## Repo layout (top-level)

```
mantle-hackathon/
├── README.md                  PRD v2.2 (product source of truth)
├── Prompt.md                  Build sequence v2.2
├── CLAUDE.md                  Session masterdoc (invariants, history)
├── README.workspace.md        Workspace package index (becomes root README at Prompt 13)
├── package.json               Root pnpm workspace
├── pnpm-workspace.yaml        Workspace package globs
├── .gitignore, .env.example
├── masterdoc/                 ← this directory (codebase docs)
├── contracts/                 Foundry, Solidity 0.8.24
├── frontend/                  Next.js 16 + Radix + Motion
├── indexer/                   Ponder
└── agents/                    sdk, arima-baseline, deepseek-reasoner, refresher
```

## Where to start a new session

1. `README.md` at root → PRD.
2. `Prompt.md` at root → prompts driving the build.
3. `CLAUDE.md` at root → masterdoc (invariants, scope cuts, session history).
4. `masterdoc/INDEX.md` → this directory (codebase reality).

When PRD and Prompt disagree, PRD wins. When PRD and code disagree, fix the side that's wrong (often the code, sometimes the PRD if a deliberate v-bump was missed).

## Status snapshot (2026-05-26)

| Layer | State |
|-------|-------|
| Monorepo scaffold | ✓ Done (Prompt 1) |
| Contracts | Foundry init only; no production .sol yet |
| Frontend | Next.js 16 + Tailwind v4 + Radix + Motion deps installed; default landing page |
| Indexer | Ponder empty template; no schema yet |
| Agents | 4 placeholder TS packages with SDK stub |
| Deployments | None |

Next: **Prompt 2 — AgentRegistry** (ERC-8004 soulbound NFT with topAgents sorted array).

See `09-build-status.md` for per-package detail.
