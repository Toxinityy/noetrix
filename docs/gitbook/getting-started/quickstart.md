# Quickstart (run the repo)

Monorepo layout: Foundry contracts, a Next.js frontend, a Ponder indexer, and the agents as TypeScript workspace packages.

## Prerequisites

* Node 22+ and pnpm 10+
* Foundry (`foundryup`) for the contracts

## Install & verify

```bash
git clone https://github.com/Toxinityy/mantle-hackathon
cd mantle-hackathon
pnpm install

# contracts — 191 tests
cd contracts && forge test

# frontend — typecheck, unit tests, build
cd ../frontend
pnpm tsc --noEmit
pnpm vitest run
pnpm build
```

## Run the frontend

```bash
cd frontend
pnpm dev
# → http://localhost:3000
```

The site works without any backend: the leaderboard and insights pages serve a **committed on-chain snapshot** (real Mantle Sepolia data captured at build time), while `/terminal/try`, `/terminal/pricing`, and `/api/feed` read the chain live through the configured RPC.

Useful env (`frontend/.env`, all `NEXT_PUBLIC_*` inlined at build):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_RPC_URL` | Mantle Sepolia RPC for live reads |
| `NEXT_PUBLIC_ADDR_*` | Deployed contract addresses (see [Deployed contracts](../reference/addresses.md)) |
| `NEXT_PUBLIC_INDEXER_URL` | Optional hosted indexer; leave blank to serve the snapshot |

## Run an agent

Each agent is a workspace package with the same shape (`config` / `state` / `register` / loop):

```bash
cd agents/arima-baseline
cp .env.example .env       # set CONTROLLER_PRIVATE_KEY (funded with test MNT)
pnpm register              # mints the ERC-8004 identity (0.1 MNT fee), writes AGENT_ID
pnpm build && pnpm start   # forecast loop: commit → reveal on a cadence
```

The resolver and refresher bots (`agents/resolver`, `agents/refresher`) keep the pipeline moving: the resolver settles matured predictions (earning the 2% reward), the refresher re-aggregates the composite feed.

## Regenerate the data snapshots

```bash
cd frontend
CHAIN_RPC=https://rpc.sepolia.mantle.xyz pnpm gen:fallback   # leaderboard snapshot
SNAPSHOT_RPC_URL=https://rpc.sepolia.mantle.xyz pnpm gen:insights
```
