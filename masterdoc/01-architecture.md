# 01 — Architecture

## High-level

```
FRONTEND (Next.js 16)  ──┐
INDEXER (Ponder)         ─┤
                          └─→ MANTLE NETWORK (L2)
                                AgentRegistry (ERC-8004 + topAgents)
                                  ↓
                                PredictionMarket (commit-reveal + escrow)
                                  ↓
                                ResolutionEngine ──► per-category resolvers
                                  ↓                  (MethApr, AaveMantleTvl)
                                ScoringEngine ──► RangeCrpsScorer
                                  ↓
                                BonusDistributor (pull-claim)
                                  ↓
                                CompositeFeed ──► SubscriptionGate
                                  ↓
                                DemoFeedConsumer (example)
                          ↑
AGENTS (off-chain Node)──┘
  arima-baseline
  claude-reasoner  (demo highlight)
  refresher        (cron: CompositeFeed.refresh)
```

## Contract graph

9 production contracts + 2 mocks per PRD §16:

| # | Contract | Path (planned) | Role |
|---|----------|---------------|------|
| 1 | AgentRegistry | `contracts/src/AgentRegistry.sol` | ERC-8004 soulbound NFT + per-category reputation + `topAgents` sorted array |
| 2 | PredictionMarket | `contracts/src/PredictionMarket.sol` | Commit-reveal, escrow, settlement entry |
| 3 | ResolutionEngine | `contracts/src/ResolutionEngine.sol` | Single source of truth for category → (resolver, scorer, config) |
| 4 | ScoringEngine | `contracts/src/ScoringEngine.sol` | CRPS application + reputation EMA + stake settlement |
| 5 | BonusDistributor | `contracts/src/BonusDistributor.sol` | Per-epoch pool, pull-claim, no iteration |
| 6 | CompositeFeed | `contracts/src/CompositeFeed.sol` | Rank-weighted ensemble across `topAgents` |
| 7 | SubscriptionGate | `contracts/src/SubscriptionGate.sol` | Architectural gate (open in v1) |
| 8 | MethAprResolver | `contracts/src/resolvers/MethAprResolver.sol` | mETH 24h APR resolver |
| 9 | AaveMantleTvlResolver | `contracts/src/resolvers/AaveMantleTvlResolver.sol` | Aave-on-Mantle TVL resolver |
| 10 | RangeCrpsScorer | `contracts/src/scorers/RangeCrpsScorer.sol` | Closed-form CRPS for uniform-over-bucket vs point-mass |
| 11 | DemoFeedConsumer | `contracts/src/examples/DemoFeedConsumer.sol` | Example subscriber |
| M1 | MockMethRateOracle | `contracts/src/mocks/MockMethRateOracle.sol` | Admin-settable historical rates |
| M2 | MockAaveTvlOracle | `contracts/src/mocks/MockAaveTvlOracle.sol` | Optional |

## Data flow per prediction

1. Agent computes forecast off-chain.
2. Agent calls `PredictionMarket.commit(agentId, categoryId, commitHash, resolutionBlock, contentHash)` + escrow stake.
3. After `REVEAL_DELAY_BLOCKS` (10), agent calls `reveal(predictionId, value, confidence, nonce)`. Reveal must be ≥10 and ≤100 blocks after commit, AND ≥200 blocks before `resolutionBlock`.
4. At `resolutionBlock`, anyone calls `ResolutionEngine.resolve(predictionId)`.
5. ResolutionEngine reads category's resolver, fetches truth, hands to ScoringEngine.
6. ScoringEngine: scores via scorer → updates AgentRegistry reputation EMA (which auto-updates `topAgents`) → splits stake (resolver 2% / agent return / pool slash) → notifies BonusDistributor.
7. BonusDistributor accumulates per-epoch pool. After epoch closes, anyone calls `finalizeEpoch` (gets 0.5%). Agents call `claimBonus` themselves (pull, no push).
8. Off-chain refresher cron calls `CompositeFeed.refresh(categoryId)` every ~5 min. Feed reads `topAgents` from registry, queries latest revealed prediction per agent, computes rank-weighted ensemble + outlier-resistant confidence.
9. `DemoFeedConsumer` (and real subscribers) call `CompositeFeed.read(categoryId)` for the current ensemble.

## Off-chain pipeline

- **agents/arima-baseline:** ARIMA(1,1,1) on historical data → bucketed range forecast → submitFullCycle.
- **agents/claude-reasoner:** Build market context → call Claude → parse JSON forecast → store full reasoning to IPFS → submitFullCycle. Demo highlight.
- **agents/refresher:** Cron worker, calls `CompositeFeed.refresh` per active category. Funded with separate hot wallet.
- **indexer/ (Ponder):** Subscribes to all contract events → indexes into Postgres → exposes REST endpoints consumed by frontend.

## Cross-references

- Invariants list: `CLAUDE.md` §3 at repo root.
- Scope cuts (don't reintroduce): `CLAUDE.md` §4.
- Block-time / unit conversions: `03-contracts.md` + PRD §13.
