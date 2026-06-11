# Architecture docs sync — README.md + GitBook architecture (2026-06-11)

## Goal

Sync the two architecture surfaces — root `README.md` (mermaid diagram + counts) and
`docs/gitbook/protocol/architecture.md` (ASCII diagram + contract table + off-chain pieces) —
to the deployed reality. Docs only; no code, no contract, no frontend change.

## Verified ground truth

- **7 on-chain agents**: 1 ARIMA Baseline · 2 DeepSeek Reasoner · 3 Naive Baseline ·
  4 Mean-Reversion · 5 Momentum · 6 EWMA-Volatility · 7 Sentiment (Fear & Greed).
  Agents 4–7 run via the `agents/swarm-runner` package using the shared
  `agents/forecasters` strategy library (strategies: arima, persistence, meanReversion,
  momentum, ewmaVol, sentiment).
- **19 deployed contracts** (`contracts/deployments/mantle-sepolia.json`, chainId 5003) =
  **15 production** (AgentRegistry, PredictionMarket, ResolutionEngine, ScoringEngine,
  RangeCrpsScorer, BonusDistributor, CompositeFeed, SubscriptionGate, MethAprResolver,
  AaveMantleTvlResolver, UsdyApyResolver, DemoFeedConsumer, YieldAllocator, RiskManager,
  MarketStressMonitor) + **4 mock instances** (MockMethRateOracle, UsdyOracle —
  a second MockMethRateOracle instance, MockAavePool, SentimentOracle).
- **SentimentOracle** (`src/mocks/SentimentOracle.sol`): keeper-posted Crypto Fear & Greed
  index (0–100), seeded from real alternative.me data; consumers ignore it when stale.
- **MarketStressMonitor** (`src/examples/MarketStressMonitor.sol`): 3-level alert
  (Calm/Elevated/Stressed) combining ensemble disagreement + quorum + freshness from the
  swarm feed, forecast surprise read best-effort from the category resolver, and the
  Fear & Greed sentiment. Alert/labeling layer only — RiskManager owns parameter gating.
- **Off-chain workspace packages**: sdk, forecasters, arima-baseline, naive-baseline,
  deepseek-reasoner, swarm-runner, resolver (bot), refresher (cron), market-data, backtest;
  plus the Ponder indexer and the Next.js frontend.

## Changes

### `README.md`

1. **Mermaid diagram rewrite** to current topology:
   - Off-chain: 3 named agent packages + swarm-runner (4 strategy agents) grouped as
     "7 agents"; SDK + forecasters lib; resolver bot; refresher cron; indexer; frontend.
   - Chain: resolvers node gains UsdyApy; add YieldAllocator + RiskManager +
     MarketStressMonitor as feed consumers; add SentimentOracle feeding the sentiment
     agent and the stress monitor.
   - Flows: resolver bot → ResolutionEngine `resolve()`; CompositeFeed → all consumers.
2. **Caption under the diagram** (line ~49): "14 production + 3 mocks (17 deployed)" →
   "15 production + 4 mock instances (19 deployed)".
3. **Repo layout block**: same count fix on the contracts line; agents line gains
   swarm-runner, forecasters, market-data, backtest.

### `docs/gitbook/protocol/architecture.md`

1. **ASCII diagram**: agents line → 7 agents (DeepSeek · ARIMA · Naive · 4-strategy swarm);
   add SentimentOracle and MarketStressMonitor inside the chain box. Existing consumer
   line (DemoFeedConsumer · YieldAllocator · RiskManager) stays.
2. **Contract table**: add rows for `SentimentOracle` (keeper-posted Fear & Greed 0–100,
   stale-aware) and `MarketStressMonitor` (3-level stress alert from disagreement +
   surprise + sentiment; alerting only, not gating).
3. **Off-chain pieces**: add swarm-runner (one process running the 4 strategy agents) and
   the shared forecasters strategy library.

## Constraints

- No invented facts — every number/name traced to source or deployments JSON above.
- Keep both docs' existing voice and structure; this is a sync, not a rewrite.
- Don't touch SUBMISSION.md / PRD / other docs (out of scope).

## Verification

- Mermaid renders (GitHub-flavored) — visual check of syntax.
- Counts cross-check: diagram nodes vs deployments JSON vs prose counts in the same file.
- Grep both files for stale strings ("14 production", "17 deployed", "2 agents").
