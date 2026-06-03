# 07 — Conventions

## Naming

| Layer | Convention |
|-------|-----------|
| Solidity contracts | `PascalCase`, descriptive (`PredictionMarket`, not `Market`) |
| Solidity functions | `camelCase` (`commit`, `submitFullCycle`) |
| Solidity events | `PascalCase` past-tense or noun (`PredictionCommitted`, `EpochFinalized`) |
| Solidity constants | `SCREAMING_SNAKE_CASE` (`REVEAL_DELAY_BLOCKS`, `EPOCH_BLOCKS`) |
| Category IDs | `bytes32` keccak256 of human name, e.g. `keccak256("METH_APR_24H")` |
| TS files | `kebab-case.ts` for utilities; `PascalCase.tsx` for React components |
| TS exports | `camelCase` functions, `PascalCase` types/classes |
| Folders | `kebab-case` (`arima-baseline`, `deepseek-reasoner`) |

## Solidity style

- Solidity 0.8.24, EVM cancun.
- All stake-moving functions: `nonReentrant` (OpenZeppelin `ReentrancyGuard`).
- All admin-restricted functions: `onlyOwner` / `onlyScoringEngine` / `onlyResolutionEngine` modifiers.
- Storage layout: keep struct field ordering explicit; group small types for slot packing where it matters.
- Events: include all relevant params for indexer (avoid `bytes32`-only opaque events).
- Errors: prefer custom errors (`error InsufficientStake();`) over `revert("string")`.
- Comments: explain math + invariants. No comments restating what code does.

## Solidity tests

- File: `contracts/test/<Contract>.t.sol`.
- Naming: `test_Verb_StateOrCondition()` for asserts; `testFuzz_Verb()` for fuzzers; `testRevert_Verb_OnCondition()` for revert paths.
- Setup: `setUp()` deploys mocks + the SUT.
- Use `vm.expectRevert(<selector>)` not `vm.expectRevert("string")` when contracts use custom errors.
- Use `vm.expectEmit(true, true, false, true)` and `emit Event(...)` for event assertions.
- Coverage target: ≥90% per contract (`forge coverage`).
- Fuzz runs: 256 default; 1000 in CI profile.

## Fixed-point math

- **Scores:** `int256` in `[-1e6, +1e6]`. Perfect prediction = `+1e6`; worst = `-1e6`.
- **Stake math:** integer wei.
- **EMA α = 0.1:** compute as `new = (9 * old + sample) / 10` (no float).
- **Score normalization:** `score_norm = score / 1e6` (signed). `realized_accuracy = (score_norm + 1) / 2` ∈ `[0, 1]`.
- **Calibration:** `bucketAccuracy[10]` indexed by `confidence / 1000` (0-9 bucket of 1000-bp bucket each). `bucketCount[10]` tracks per-bucket sample size.
- **Stake settlement:** see PRD §7.2.4. Resolver paid FIRST. Invariant must `assert`.

## Python reference (CRPS, calibration)

- Files: `contracts/test/reference/crps_reference.py`, `contracts/test/reference/calibration_reference.py`.
- Pure Python, NumPy optional but discouraged (keep simple).
- Print expected outputs in a format Solidity tests can hard-code OR read via `vm.readFile` / `vm.ffi`.
- Tolerance: ≤0.1% relative error.
- 10 test cases each, covering: perfect, off-by-one bucket, fully outside domain, edge of domain, sign-flip boundary.

## TypeScript style

- Strict mode on. `noImplicitAny`, `strictNullChecks`.
- ES modules (`"type": "module"` in package.json).
- File-per-feature, not file-per-class.
- Prefer named exports; avoid default exports except for Next.js pages/components where the framework requires it.
- Async: top-level `await` allowed in ESM scripts. Avoid `.then()` chains; use `await` consistently.

## React / Next.js (frontend)

- Next 16 App Router. Read `node_modules/next/dist/docs/` first — Next 16 has breaking changes.
- Server Components by default; `'use client'` only when interactivity needed.
- Server-only secrets (e.g. `OPENROUTER_API_KEY`) must NEVER be imported into client components.
- Data fetch: TanStack Query for indexer reads (30s `staleTime`); wagmi hooks for on-chain reads/writes.
- Forms: `react-hook-form` if needed (not yet a dep — add if Prompt 11 needs).
- Routing: file-system based, App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).

## Git

- Branch: `master` (single-branch hackathon flow).
- Commits: clear, present-tense ("add AgentRegistry", not "added AgentRegistry").
- User commits — do not auto-commit. Stage only when asked.

## Env / secrets

- `.env` files are **gitignored**.
- `.env.example` per package documents required vars.
- Never commit private keys, API tokens, or RPC URLs containing API keys.
- For Foundry scripts: use `--account` keystore or `--private-key $PRIVATE_KEY`.

## Documentation

- `README.md` (root) = PRD, source of product truth.
- `Prompt.md` (root) = build sequence.
- `CLAUDE.md` (root) = session masterdoc.
- `masterdoc/*.md` = codebase reality.
- Update affected `masterdoc/` file when state changes; bump snapshot date.

## Things never to do

- ❌ Add Hardhat config (Foundry only).
- ❌ Use shadcn CLI (Radix UI directly).
- ❌ Use emoji as structural icons.
- ❌ Reintroduce push-distribution to BonusDistributor.
- ❌ Add scope cuts back without explicit user approval (see CLAUDE.md §4).
- ❌ Backdate predictions.
- ❌ Skip Python reference cross-check on CRPS or calibration.
- ❌ Skip `prefers-reduced-motion` fallbacks for cinematic animations.
