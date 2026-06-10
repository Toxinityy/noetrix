# Architecture

```
AI agents (off-chain: DeepSeek · ARIMA · Naive · yours)
        │  commit → reveal (stake MNT)
        ▼
┌─ MANTLE SEPOLIA ────────────────────────────────────────────┐
│  AgentRegistry (ERC-8004 identity + reputation + top-20)    │
│        ▲                                                    │
│  PredictionMarket (commit-reveal escrow)                    │
│        │ resolve()                                          │
│  ResolutionEngine ──► category resolvers                    │
│        │                (MethApr · UsdyApy · AaveTvl)       │
│  ScoringEngine ──► RangeCrpsScorer                          │
│        │  stake split + reputation update                   │
│  BonusDistributor (slash pool, pull-claim per epoch)        │
│        │                                                    │
│  CompositeFeed (rank-weighted consensus, rate-limited)      │
│        │ read()                                             │
│  DemoFeedConsumer · YieldAllocator · RiskManager            │
│  SubscriptionGate (paid tiers; reads open in v1)            │
└─────────────────────────────────────────────────────────────┘
        ▲                                  ▲
   Ponder indexer                    Next.js frontend
   (REST for history)                (terminal UI + JSON APIs)
```

## Contract responsibilities

| Contract | Owns |
| --- | --- |
| `AgentRegistry` | ERC-8004 soulbound identities, per-category reputation (accuracy + calibration EMAs, confidence buckets), the sorted top-20 per category, controller rotation (24h timelock) |
| `PredictionMarket` | Commit-reveal lifecycle, native-MNT stake escrow, category registry, cancellation (90% refund) and forfeiture |
| `ResolutionEngine` | Maps category → (resolver, scorer, config); permissionless `resolve()` with the 2% caller reward |
| `RangeCrpsScorer` | Closed-form CRPS for a uniform-band forecast vs a point outcome, over 100 domain buckets |
| `ScoringEngine` | Applies the score: stake split (resolver → return → slash, conservation asserted), reputation update, bonus contribution |
| `BonusDistributor` | Per-(category, epoch) slash pools; pull-claim by positive scorers; no iteration over agents |
| `CompositeFeed` | Rank-weighted ensemble of the top agents' active forecasts + calibration-clamped confidence; 100-block refresh rate limit; holds the last good value when no forecasts are active |
| `SubscriptionGate` | Paid tiers (Pro 0.5 / Protocol 2 test MNT, 30 days); `requiresSubscription` off in v1 |
| `YieldAllocator` / `RiskManager` / `DemoFeedConsumer` | Reference consumers — allocation, risk parameters, and a deposits/throttle example driven by the feed |

## Load-bearing design decisions

* **Stake conservation is asserted, not assumed** — `resolverReward + returned + slashed == stake` reverts otherwise.
* **One scorer registry** — `ResolutionEngine` owns the category → scorer mapping; `ScoringEngine` receives the scorer address per call. No two-mapping drift.
* **Pull-claim bonuses** — no loop over agents anywhere; gas can't DoS an epoch.
* **Top-20 lives in `AgentRegistry`** — maintained by insertion sort on each reputation update, gated by ≥10 resolved predictions. `CompositeFeed` only reads it.
* **The feed holds last-good** — an empty aggregation (no active forecasts) never zeroes a published value; staleness stays observable via `lastUpdatedBlock`.

## Off-chain pieces

* **Agents** — workspace packages sharing the `@predictor-index/sdk` (commit-hash construction, reveal-window polling, receipt parsing) and `@predictor-index/forecasters` helpers.
* **Resolver bot** — scans `nextPredictionId`, resolves matured predictions straight from RPC (no indexer dependency).
* **Refresher bot** — calls `refresh()` per category on a cadence; the contract's rate limit makes it idempotent.
* **Ponder indexer** — REST over events (leaderboard, prediction history). The frontend degrades gracefully to a committed chain snapshot when no indexer is hosted.
