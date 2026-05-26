# 03 — Contracts

## Stack

- **Foundry** (forge 1.7.1). NO Hardhat.
- **Solidity 0.8.24**, EVM `cancun`.
- **OpenZeppelin Contracts v5.6.1** (vendored via `forge install`).
- Optimizer on, 200 runs, no `via_ir`.
- Tests in Solidity (`forge test`), with Python reference implementations for CRPS + calibration cross-checked via FFI/text comparison.

## Files in place (snapshot 2026-05-26)

```
contracts/
├── foundry.toml          ← see below
├── remappings.txt        @openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
│                         forge-std/=lib/forge-std/src/
├── package.json          { build: "forge build", test: "forge test", coverage: "forge coverage" }
├── .env.example          MANTLE_SEPOLIA_RPC / MANTLE_MAINNET_RPC / PRIVATE_KEY / MANTLESCAN_API_KEY
├── lib/forge-std/        vendored
├── lib/openzeppelin-contracts/   v5.6.1 vendored
├── src/                  empty (only subdirs + .gitkeep)
├── script/               empty
└── test/                 empty
```

## foundry.toml

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
test = "test"
script = "script"
solc_version = "0.8.24"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
via_ir = false
fs_permissions = [{ access = "read", path = "./" }]
ffi = true                       # required for Python reference tests

[profile.ci]
verbosity = 4
fuzz = { runs = 1000 }

[fmt]
line_length = 120
tab_width = 4
bracket_spacing = true

[rpc_endpoints]
mantle_sepolia = "${MANTLE_SEPOLIA_RPC}"
mantle_mainnet = "${MANTLE_MAINNET_RPC}"

[etherscan]
mantle_sepolia = { key = "${MANTLESCAN_API_KEY}", url = "https://api-sepolia.mantlescan.xyz/api" }
mantle_mainnet = { key = "${MANTLESCAN_API_KEY}", url = "https://api.mantlescan.xyz/api" }
```

## Planned contracts

See `01-architecture.md` for the full list. Build order = `Prompt.md` Prompts 2–6:

| Prompt | Contracts | Note |
|--------|-----------|------|
| 2 | AgentRegistry | ERC-8004 soulbound; `topAgents[categoryId]` sorted top-20; insertion-sort on every `updateReputation`. |
| 3 | PredictionMarket | Commit-reveal. `REVEAL_DELAY_BLOCKS=10`, `REVEAL_WINDOW_BLOCKS=100`, `SUBMISSION_CUTOFF_BLOCKS=200`. |
| 4 | ResolutionEngine + MethAprResolver + MockMethRateOracle + ICategoryResolver | ResolutionEngine is single source of truth for category → (resolver, scorer, config). |
| 5 | ScoringEngine + RangeCrpsScorer + Python references | Most numerically-sensitive prompt — Python references are the truth, Solidity must match within 0.1% relative error. |
| 6 | BonusDistributor + CompositeFeed + AaveMantleTvlResolver | BonusDistributor is pull-claim, never push. CompositeFeed reads pre-sorted `topAgents`. |

## Critical invariants (from `CLAUDE.md` §3)

1. **Stake conservation:** `resolver_reward + returned_to_agent + slashed_to_pool == stake`. Resolver paid FIRST. Add an `assert` in `ScoringEngine`.
2. **Scorer registry single source:** ResolutionEngine owns the `scorers` mapping; ScoringEngine receives scorer addr as `applyScore` param.
3. **BonusDistributor is PULL-claim.** Anyone calls `finalizeEpoch` (gets 0.5%), agents call `claimBonus` themselves. No loop over agents anywhere.
4. **`topAgents[categoryId]` lives in AgentRegistry.** Sorted by `accuracyScore desc`, tie-break by lower `agentId`, gated by `resolvedCount >= 10`. Maintained inside `_updateTopAgents` called from every `updateReputation`.
5. **Commit-reveal cutoff:** reveal window `[commit+10, min(commit+100, resolutionBlock-200)]`.
6. **Mantle block time = 2 seconds.** 100 blocks ≈ 3.3 min, 43200 blocks ≈ 24h, 1000 blocks ≈ epoch (33 min).
7. **0.1 MNT registration fee** → treasury.
8. **Composite confidence clamps per-agent calibration at `-0.5`** before averaging. Multiplier ∈ `[0.5, 1.0]`.

## Fixed-point conventions

- Scores: `int256` in range `[-1e6, +1e6]`.
- Stake math: integer wei; precision via 1e18 base where needed.
- EMA α = 0.1: `new = ((10 - 1) * old + 1 * sample) / 10` (avoid float division).
- Calibration: `bucketAccuracy[10]` `int256` per agent per category, `bucketCount[10]` `uint256`.

## Tests

- Per-contract unit tests in `contracts/test/*.t.sol`.
- Reference Python in `contracts/test/reference/` (CRPS, calibration). Test compares Solidity output to printed Python output.
- Coverage target: ≥90% (`forge coverage`).
- Fuzz runs: 256 default, 1000 in `ci` profile.

## Anti-patterns (from `CLAUDE.md` §8)

- ❌ Don't trust `read.me` (legacy v1).
- ❌ Don't reintroduce push-distribution to BonusDistributor.
- ❌ Don't write `softmax(accuracy × calibration)` — has a sign-flip bug.
- ❌ Don't compute `realized_accuracy = score / 1e6` raw — score is signed; use `(score_norm + 1) / 2`.
- ❌ Don't add top-N enumeration outside `AgentRegistry._updateTopAgents`.
- ❌ Don't backdate predictions. Use SEED_MODE short windows.
