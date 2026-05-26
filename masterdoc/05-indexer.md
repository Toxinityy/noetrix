# 05 — Indexer

## Stack

- **Ponder 0.16.6** — typed EVM indexer; auto-syncs events to Postgres; exposes a `hono` HTTP server for REST endpoints.
- **viem 2.21** — RPC client (Ponder dep).
- **TypeScript 5**.
- Default dev port: **42069**.
- Default DB: pglite (in-process) for dev; Railway-hosted Postgres for production.

## Files in place (snapshot 2026-05-26)

```
indexer/
├── package.json           ponder, hono, viem
├── tsconfig.json
├── ponder.config.ts       (template — needs network + contract addresses)
├── ponder.schema.ts       (template — needs schema definitions)
├── src/                   (event handler files go here per Ponder convention)
└── .gitignore             (created by create-ponder)
```

## Planned schema (PRD §10 + Prompt 8)

```ts
// agents
id: number              // agentId from AgentRegistry
controller: address
metadataURI: string
registeredAt: bigint    // block number
totalPredictions: number
totalResolved: number

// reputations (one row per (agentId, categoryId))
agentId: number
categoryId: bytes32
accuracyScore: bigint
calibrationScore: bigint
resolvedCount: number
lastUpdatedBlock: bigint

// predictions
id: number              // predictionId from PredictionMarket
agentId: number
categoryId: bytes32
commitHash: bytes32
value: bytes | null     // null until reveal
confidence: number | null
contentHash: bytes32    // IPFS reference for reasoning trace
stake: bigint
commitBlock: bigint
resolutionBlock: bigint
status: "Committed" | "Revealed" | "Resolved" | "Cancelled" | "Forfeited"
score: bigint | null

// feedSnapshots
categoryId: bytes32
value: bigint
confidence: number
contributingAgents: number
snapshotBlock: bigint

// bonusDistributions
categoryId: bytes32
epochNumber: number
totalPool: bigint
agentBonuses: jsonb     // { agentId: amount }
```

## Event handlers (planned)

From contracts:

- `AgentRegistry`: `AgentRegistered`, `ControllerRotated`, `ControllerRotationProposed`, `ReputationUpdated`
- `PredictionMarket`: `PredictionCommitted`, `PredictionRevealed`, `PredictionCancelled`, `PredictionForfeited`
- `ScoringEngine`: `PredictionScored`
- `CompositeFeed`: `CompositeFeedRefreshed`
- `BonusDistributor`: `EpochFinalized`, `BonusClaimed`

## REST endpoints (planned)

| Method | Path | Returns |
|--------|------|---------|
| GET | `/leaderboard?category=METH_APR_24H&limit=10` | Top agents sorted by accuracy |
| GET | `/agent/:id` | Agent metadata + reputations array |
| GET | `/agent/:id/predictions?offset=&limit=` | Paginated prediction history |
| GET | `/category/:id` | Category config + recent predictions |
| GET | `/feed/:category/history` | CompositeFeed snapshot history |

Latency target: **<500ms** for leaderboard query.

## Hosting

- **Railway** (cheap, reliable, supports Postgres).
- Public URL goes in frontend `NEXT_PUBLIC_INDEXER_URL`.
- Env vars: `MANTLE_SEPOLIA_RPC`, `DATABASE_URL`, contract addresses.

## Current state (2026-05-26)

- ✓ Ponder empty template scaffolded.
- ✓ deps installed.
- ✗ `ponder.config.ts` not wired to deployed contracts (no deployments yet).
- ✗ `ponder.schema.ts` empty.
- ✗ No event handlers.
- ✗ No REST endpoints.
- ✗ Not deployed.

Indexer work begins at **Prompt 8** (after Prompt 7 deploys to Mantle Sepolia).

## SEED_MODE auto-flip dependency

Agents poll the indexer for `resolvedCount >= 50` (or 48h elapsed) to flip from SEED_MODE → normal mode. The endpoint they hit is `GET /agent/:id/predictions?status=Resolved`. If indexer is down, agents stay in SEED_MODE — acceptable degradation.
