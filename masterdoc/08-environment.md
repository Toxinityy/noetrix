# 08 — Environment

## Tooling versions (verified 2026-05-26)

| Tool | Version | Source |
|------|---------|--------|
| Node | 22.20.0 | system |
| pnpm | 10.33.3 | global |
| forge | 1.7.1 (commit 4072e48) | `foundryup` |
| cast | 1.7.1 | bundled with forge |
| anvil | 1.7.1 | bundled with forge |
| chisel | 1.7.1 | bundled with forge |
| git | 2.46.0.windows.1 | system |

## Foundry on PATH

Foundry binaries live at `C:\Users\William A\.foundry\bin\`. Persistent user PATH already includes this (added 2026-05-26). **PowerShell sessions opened BEFORE the PATH update don't see it** — start a new shell or prepend `$env:PATH = "$env:PATH;$env:USERPROFILE\.foundry\bin"`.

## Networks

| Network | RPC | Block time | Explorer |
|---------|-----|-----------|----------|
| Mantle Sepolia | `https://rpc.sepolia.mantle.xyz` | 2s | `https://sepolia.mantlescan.xyz` |
| Mantle Mainnet | `https://rpc.mantle.xyz` | 2s | `https://mantlescan.xyz` |

⚠ **Block time assumption is `2s` everywhere** in the codebase (epoch math, reveal windows, refresh cron). If Mantle changes block time, audit every block-window constant.

Block-window cheat sheet (2s blocks):
- 10 blocks = 20s
- 100 blocks = 3.3 min
- 200 blocks = 6.7 min (submission cutoff before resolution)
- 350 blocks = 11.7 min (SEED_MODE resolution window)
- 1000 blocks = 33.3 min (epoch)
- 43200 blocks = 24 hours

## Env vars

### Root `.env.example`

```
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_MAINNET_RPC=https://rpc.mantle.xyz
PRIVATE_KEY=
REFRESHER_PRIVATE_KEY=
INDEXER_URL=http://localhost:42069
NEXT_PUBLIC_INDEXER_URL=http://localhost:42069
NEXT_PUBLIC_RPC_URL=https://rpc.sepolia.mantle.xyz
ANTHROPIC_API_KEY=
WEB3_STORAGE_TOKEN=
MANTLESCAN_API_KEY=
```

### `contracts/.env.example`

```
MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
MANTLE_MAINNET_RPC=https://rpc.mantle.xyz
PRIVATE_KEY=
MANTLESCAN_API_KEY=
```

### Frontend (Vercel)

Public:
- `NEXT_PUBLIC_INDEXER_URL`
- `NEXT_PUBLIC_RPC_URL`
- Contract addresses (one var per contract, prefixed `NEXT_PUBLIC_`)

### Indexer (Railway)

- `MANTLE_SEPOLIA_RPC`
- `DATABASE_URL` (Railway Postgres)
- Contract addresses

### Agents (Railway or GitHub Actions)

Per agent package:
- `PRIVATE_KEY` (controller key — register agent then save `AGENT_ID`)
- `AGENT_ID`
- `RPC_URL`
- `INDEXER_URL`
- `WEB3_STORAGE_TOKEN`
- `ANTHROPIC_API_KEY` (claude-reasoner only)
- `CRYPTOPANIC_API_KEY` (claude-reasoner only, optional)

### Refresher

- `REFRESHER_PRIVATE_KEY` (separate hot wallet, NOT an agent controller)
- `RPC_URL`
- Active category IDs

## Secret handling

- `.env` files are **gitignored**.
- **Never commit real keys.** `.env.example` only documents schema.
- For Foundry deploy scripts: prefer `--account` keystore over `--private-key $PRIVATE_KEY` for the human deployer; private-key-from-env is acceptable for agent + refresher hot wallets.
- Rotate `REFRESHER_PRIVATE_KEY` if it touches more than ~0.1 MNT — it's a hot wallet.

## IDE / editor

- VS Code recommended. Solidity extension: `JuanBlanco.solidity` or `NomicFoundation.hardhat-solidity` (the latter despite the name works with Foundry projects).
- TypeScript: built-in VS Code support sufficient.
- ESLint: respected per-package (`pnpm -C frontend lint`, `pnpm -C indexer lint`).

## Disk + memory

- `node_modules/` across workspace: ~1.2 GB.
- `pnpm-lock.yaml`: ~500 KB.
- `contracts/lib/openzeppelin-contracts/`: ~50 MB.
- Foundry test runs: keep `forge clean` handy if `out/` grows.

## CI / deployment platforms (planned)

- **Frontend:** Vercel.
- **Indexer:** Railway (with hosted Postgres).
- **Agents + refresher:** Railway OR GitHub Actions cron.
- **Contracts:** deployed via `forge script --broadcast --verify`; addresses tracked in `contracts/deployments/mantle-sepolia.json`.
