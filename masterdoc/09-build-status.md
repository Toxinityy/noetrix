# 09 — Build Status

Snapshot: **2026-05-26**. Update after each significant change.

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
- ✓ `forge build` runs (nothing to compile).
- ✗ No production contracts written. Next: **Prompt 2 — AgentRegistry**.

### frontend/
- ✓ `create-next-app` scaffold (Next.js 16.2.6, Tailwind v4, TS, App Router, ESLint, src dir, Turbopack, `@/*` alias).
- ✓ Deps installed: Radix UI (8 primitives), Motion v12, wagmi 3.6.15, viem 2.51, TanStack Query 5, Recharts 3.8, lucide-react, clsx + tailwind-merge + cva.
- ✓ Default landing page renders.
- ✗ No custom design tokens.
- ✗ No font configuration (Inter + JetBrains Mono via next/font pending).
- ✗ No app shell, no pages.
- ✗ No wagmi config (chain + connectors).
- ⚠ Next 16 has breaking changes (see `frontend/AGENTS.md`). Read `node_modules/next/dist/docs/` before writing app code.
- Next: **Prompt 11 — 3 must-have pages**.

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
| `forge build` | ✓ (nothing to compile) | 2026-05-26 |
| `pnpm install` (root) | ✓ | 2026-05-26 |
| `pnpm -C agents/sdk build` | ✓ | 2026-05-26 |
| No `hardhat.config.*` in own code | ✓ | 2026-05-26 |
| All §16 dirs present | ✓ | 2026-05-26 |
| `pnpm -C frontend dev` (smoke test) | ⏳ not yet attempted | — |
| `pnpm -C indexer dev` (smoke test) | ⏳ not yet attempted | — |

## Pre-flight checklist for Prompt 2 (next session)

- [ ] Confirm forge is on PATH (`forge --version`).
- [ ] Read PRD §7.1 (AgentRegistry full spec).
- [ ] Read `CLAUDE.md` §3 invariants 4 + 12 (topAgents + registration fee).
- [ ] Read `03-contracts.md` planned-contracts table.
- [ ] Write `src/AgentRegistry.sol` + `test/AgentRegistry.t.sol`.
- [ ] Run `forge test`; report coverage.
- [ ] Update `09-build-status.md` (this file) when AgentRegistry lands.
- [ ] Append session entry to `CLAUDE.md` §6.

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
