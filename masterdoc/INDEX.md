# Predictor Index — Masterdoc

Living documentation of the repo. Snapshot date: **2026-05-26**. Update entries as packages evolve.

This directory documents the **current state of the codebase**. For the product spec, see `README.md` (PRD v2.2) at repo root. For the build sequence, see `Prompt.md` (v2.2). For project invariants + session history, see `CLAUDE.md` at repo root.

## Contents

| # | File | Topic |
|---|------|-------|
| 00 | [overview.md](./00-overview.md) | What this repo is + how to start a session |
| 01 | [architecture.md](./01-architecture.md) | System architecture, contract graph, data flow |
| 02 | [monorepo.md](./02-monorepo.md) | pnpm workspace layout, package tree |
| 03 | [contracts.md](./03-contracts.md) | Foundry setup, planned contracts, conventions |
| 04 | [frontend.md](./04-frontend.md) | Next.js stack, design system, page plan |
| 05 | [indexer.md](./05-indexer.md) | Ponder schema + endpoint plan |
| 06 | [agents.md](./06-agents.md) | SDK + ARIMA + DeepSeek reasoner + refresher |
| 07 | [conventions.md](./07-conventions.md) | Code style, naming, testing, fixed-point math |
| 08 | [environment.md](./08-environment.md) | Tooling versions, env vars, RPC, secrets |
| 09 | [build-status.md](./09-build-status.md) | Per-package current state vs PRD scope |

## How to use

- **New session:** read `INDEX.md` → `00-overview.md` → `09-build-status.md` (in that order) for fastest orientation.
- **Touching contracts:** read `03-contracts.md` + `07-conventions.md` before writing Solidity.
- **Touching frontend:** read `04-frontend.md` + `07-conventions.md` before writing TSX. Also read `frontend/AGENTS.md` (Next 16 has breaking changes).
- **Touching indexer:** read `05-indexer.md`.
- **Touching agents:** read `06-agents.md`.
- **Updating docs:** when scaffolding moves forward, update the affected file + bump the snapshot date in `INDEX.md` and `09-build-status.md`.

## Doc vs spec separation

- `README.md` (PRD) and `Prompt.md` (build sequence) at repo root = **product intent** (what should exist).
- `masterdoc/` (this directory) = **codebase reality** (what does exist + how it's wired).
- `CLAUDE.md` at repo root = **session continuity** (decisions, scope cuts, history). Don't duplicate here; link instead.
