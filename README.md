# Predictor Index — Product Requirements Document (v2.1)

> An on-chain AI agent forecasting protocol built on Mantle Network. Agents with ERC-8004 identities make verifiable predictions, accumulate reputation, and earn rewards. Their composite forecasts are sold to Mantle protocols as a subscription feed.

**Target hackathon:** The Turing Test Hackathon 2026 (Mantle × Bybit × Byreal × BGA)
**Submission tracks:** AI Alpha & Data (primary), Grand Champion (stretch)
**Build window:** 2 weeks
**Team size assumption:** 1–3 builders

**Changelog from v1:**
- Filled stake settlement math (§7.2.4)
- Filled calibration formula with Python reference (§7.4.2)
- Replaced softmax composite weighting with rank-based (§7.5.2)
- Added commit-reveal anti-front-running (§4.2, §7.2.5)
- Added resolution gas reward, refresh rate limit, registration fee specs
- Specified mETH APR window, agent metadata schema
- Cut StakingPool, third agent, third category, Hardhat — scope tightened
- Added explicit revenue model to elevator pitch (§1)
- Replaced "backdating" with shorter resolution windows (§13)

**Changelog v2 → v2.1 (post-review patches):**
- Stake settlement reordered: `resolver_reward` paid first, total now conserves (§7.2.4)
- BonusDistributor switched from push-iteration to pull-claim pattern (§7.2.4)
- Scorer registry single source of truth: ResolutionEngine owns `scorers` mapping; passes scorer addr to `ScoringEngine.applyScore` (§7.3, §7.4)
- `topAgents` mapping added to AgentRegistry storage + function list (§7.1)
- Composite confidence aggregation: per-agent calibration contribution floored at -0.5 to limit outlier drag (§7.5.1)
- CompositeFeed refresh trigger spec'd: external cron (§7.5.2)
- SEED_MODE auto-flip source spec'd: indexer poll on `resolvedCount` (§8.2, §8.3)
- Calibration term documented as CRPS-derived proxy (§3 glossary)
- Block-time consistency: 100 blocks ≈ 3.3 min on Mantle 2s blocks (§13)
- Few-shot examples for Claude reasoner spec'd as Day-9 deliverable (§8.3)

---

## 1. Why this exists (and how it makes money)

There is no neutral, verifiable, real-time benchmark for AI forecasting quality in crypto. Centralized leaderboards can't be trusted. Off-chain backtests are easy to manipulate. As more capital flows to AI-driven strategies, the lack of a trust layer becomes an acute bottleneck.

Predictor Index turns AI forecasting into a measurable, ranked, composable on-chain primitive. Agents stake reputation by predicting; predictions resolve automatically against on-chain truth; accuracy and calibration accumulate on each agent's persistent identity NFT; the system produces an ensemble forecast feed that Mantle protocols subscribe to.

**Three audiences and the revenue model:**
- **Agent developers** get a neutral place to prove their agents work. (Posting fees: ~$0.10/prediction.)
- **Mantle protocols** subscribe to the composite forecast feed for treasury, risk, and parameter decisions. **(Subscription: $500–$2,000/month per protocol — primary revenue.)**
- **Users** stake on agents whose track records they trust, sharing in agent rewards. (Stretch — not in hackathon scope.)

The protocol's value capture is the subscription layer. Everything else exists to make the feed worth paying for.

---

## 2. Success criteria for the hackathon

The build is "good enough to win a track prize" if all of the following are true at judging time:

- [ ] Smart contracts deployed and verified on Mantle (testnet acceptable; mainnet preferred)
- [ ] 2 reference agents running live, posting real predictions
- [ ] 2 prediction categories with working resolution
- [ ] Live leaderboard ranking agents by accuracy + calibration
- [ ] Composite forecast feed callable by external contracts
- [ ] At least 1 demo consumer contract reading the feed
- [ ] At least 50 resolved predictions visible on the leaderboard
- [ ] Public frontend at a non-localhost URL
- [ ] Demo video ≥2 minutes walking through the core use case
- [ ] Open-source GitHub repo with complete README
- [ ] Every AI decision committed on-chain (Turing Test hackathon defining feature)

Stretch (for Grand Champion shot):
- [ ] Mainnet deploy (not just Sepolia)
- [ ] One real Mantle protocol team has agreed to consume the feed post-hackathon (LOI is enough)

---

## 3. Core concepts and glossary

**Agent** — An autonomous AI system that submits predictions. Operated by a human (the "controller") via a private key but acts programmatically.

**Identity NFT (ERC-8004)** — Soulbound NFT minted per agent. Stores controller address, metadata URI, and accumulated reputation. Non-transferable.

**Category** — A class of prediction (e.g., "Aave-Mantle-TVL-24h"). Each category has a defined resolution mechanism, scoring function, and parameter schema.

**Prediction** — A submission from an agent: category, value or range, confidence (0–10000 bps), stake, resolution block, content hash. Uses **commit-reveal** to prevent front-running (see §4.2).

**Resolution** — The deterministic process that scores a prediction after its resolution block.

**Scoring rule** — Function that converts (prediction, outcome) → score. v1 uses discretized CRPS for range predictions.

**Accuracy score** — Per-category, recency-weighted EMA of an agent's prediction scores. Range [-1e6, +1e6].

**Calibration score** — Per-category measure of how well stated confidence matches realized accuracy. **CRPS-derived proxy** (not strict Brier-decomposition): realized accuracy is computed by normalizing each prediction's CRPS score into [0, 1] and binned by stated confidence; mean squared deviation between stated confidence midpoints and realized accuracy buckets is reported negated. Range [-1e6, 0]. (Always non-positive: 0 = perfectly calibrated.) See §7.4.2 for the exact update rule.

**Composite feed** — Ensemble forecast per category, computed from top-20 agents by accuracy with rank-based weighting.

**Bonus pool** — Per-category, per-epoch (1000-block) reward pool. Funded from slashes on poor predictions, cancellation slashes, and a portion of submission fees. Distributed to top-scoring agents at epoch end.

**Stake** — Native MNT posted by the agent at prediction time. Returned partially-to-fully based on score, with bonus on top for strong scores. See §7.2.4.

---

## 4. User flows

### 4.1 Agent registration

1. Developer prepares an agent metadata JSON (schema in §8.1.1), uploads to IPFS.
2. Developer calls `AgentRegistry.register{value: 0.1 ether}(metadataURI)` from the controller wallet. (0.1 MNT registration fee — sybil deterrent, funds initial bonus pool.)
3. Contract mints a soulbound ERC-8004 identity NFT to the controller.
4. Agent NFT shows zero reputation, ready to submit predictions.

### 4.2 Submitting a prediction (commit-reveal)

**Phase 1 — Commit:**
1. Agent reads on-chain state and forms a forecast off-chain.
2. Agent computes `commitHash = keccak256(abi.encode(agentId, categoryId, value, confidence, nonce))`.
3. Agent calls `PredictionMarket.commit{value: stake}(agentId, categoryId, commitHash, resolutionBlock, contentHash)`.
4. Contract escrows stake, emits `PredictionCommitted`.

**Phase 2 — Reveal:**
1. Between commit-block + 10 and commit-block + 100, agent calls `PredictionMarket.reveal(commitId, value, confidence, nonce)`.
2. Contract verifies hash matches commit, stores prediction details, emits `PredictionRevealed`.
3. Failure to reveal within window: stake fully slashed to bonus pool.

**Submission cutoff:** Commits are rejected if `resolutionBlock - currentBlock < 200`. This prevents last-moment-fitting near resolution.

This protects against front-running while keeping the on-chain record auditable post-reveal.

### 4.3 Resolution

1. After resolution block, anyone can call `ResolutionEngine.resolve(predictionId)`.
2. Engine reads the appropriate resolver for the category.
3. Resolver returns the canonical outcome value.
4. Scoring engine computes score + calibration delta.
5. Agent's reputation updates on `AgentRegistry`.
6. Stake settled per §7.2.4. **2% of original stake** awarded to whoever called `resolve()` (gas reward).
7. Events emitted; leaderboard refreshes via indexer.

### 4.4 Consuming the composite feed

1. Mantle protocol calls `CompositeFeed.read(categoryId)`.
2. Returns: ensemble forecast value, confidence band, contributing agent count, freshness timestamp.
3. If the feed hasn't been refreshed within the last 100 blocks, protocol (or anyone) calls `CompositeFeed.refresh(categoryId)` first.
4. Subscription tier enforced via `SubscriptionGate` — for hackathon v1, all reads are free; gate is implemented but open.

---

## 5. Categories at launch

Two categories ship at launch. Third is post-hackathon.

### 5.1 `AAVE_MANTLE_TVL_24H` (range prediction)
- **What it predicts:** Aave-on-Mantle total supplied USD at block `resolutionBlock` (24h ahead).
- **Resolution:** Sum across reserves of `aToken.totalSupply() × oracle.getPrice(underlying)`.
- **Domain:** $0 to $5B, discretized into 100 buckets log-scaled.
- **Scoring:** Discretized CRPS.
- **Min stake:** 0.1 MNT. **Allowed resolution window:** 100–500,000 blocks ahead.
- **Contingency:** If Aave-on-Mantle is unreachable at hackathon time, swap to `INIT_CAPITAL_TVL_24H`.

### 5.2 `METH_APR_24H` (range prediction)
- **What it predicts:** Annualized mETH staking yield at block `resolutionBlock` (24h ahead), in basis points.
- **Resolution window:** Look at mETH exchange rate at `resolutionBlock` and at `resolutionBlock - 43200` (24h back at 2s blocks). APR = `(rateNow / ratePrior - 1) × 365`. Returned as basis points.
- **Domain:** 0–1000 bps, discretized into 100 buckets.
- **Scoring:** Discretized CRPS.
- **Min stake:** 0.1 MNT. **Allowed resolution window:** 100–500,000 blocks ahead.

### 5.3 `MNT_PRICE_7D` (deferred to post-hackathon)
Skipped in hackathon scope. Would require multi-oracle integration; not worth the time.

---

## 6. Architecture

```
FRONTEND (Next.js)
  Leaderboard | Agent pages | Demo consumer
       │
       ├── wagmi/viem (contracts)
       └── REST API (indexer)
              │
       INDEXER (Ponder)
              │
       MANTLE NETWORK (L2)
              │
       AgentRegistry (ERC-8004)
              │
       PredictionMarket (commit-reveal + escrow)
              │
       ResolutionEngine + per-category resolvers
              │
       ScoringEngine + RangeCrpsScorer
              │
       CompositeFeed + SubscriptionGate
              │
       DemoFeedConsumer (example)
              ▲
              │
       AGENT FLEET (off-chain)
         ARIMA baseline
         Claude reasoner (highlight)
```

---

## 7. Smart contract specifications

All contracts in Solidity 0.8.24. **Foundry only — no Hardhat.** OpenZeppelin for primitives. Deploy to Mantle Sepolia first; mainnet if time permits.

### 7.1 `AgentRegistry.sol`

ERC-8004 conformant, soulbound.

```solidity
struct AgentProfile {
    address controller;
    string metadataURI;       // IPFS pointer to JSON per §8.1.1
    uint256 registeredAt;
    uint256 totalPredictions;
    uint256 totalResolved;
}

struct Reputation {
    int256 accuracyScore;     // Scaled by 1e6; range [-1e6, +1e6]
    int256 calibrationScore;  // Scaled by 1e6; range [-1e6, 0]
    uint256 resolvedCount;
    uint256 lastUpdatedBlock;
    int256[10] bucketAccuracy;
    uint256[10] bucketCount;
}

mapping(uint256 => AgentProfile) public agents;
mapping(uint256 => mapping(bytes32 => Reputation)) public reputation;
mapping(address => uint256) public controllerToAgent;

// Top-20 agents per category, sorted by accuracyScore desc.
// Maintained on every updateReputation via insertion sort.
// Used by CompositeFeed.refresh() to cap on-chain enumeration cost.
mapping(bytes32 => uint256[20]) public topAgents;

uint256 public constant REGISTRATION_FEE = 0.1 ether;
uint256 public constant TOP_AGENT_MIN_RESOLVED = 10;  // gating for topAgents inclusion
address public treasury;
```

**Key functions:**
- `register(string calldata metadataURI) external payable returns (uint256 agentId)` — requires `msg.value == REGISTRATION_FEE`
- `proposeControllerRotation(uint256 agentId, address newController) external` — starts 24h timelock
- `executeControllerRotation(uint256 agentId) external` — completes after timelock
- `updateReputation(...) external onlyScoringEngine` — also re-runs `_updateTopAgents(categoryId, agentId)` internally
- `getReputation(uint256 agentId, bytes32 categoryId) external view returns (Reputation memory)`
- `getTopAgents(bytes32 categoryId) external view returns (uint256[20] memory)` — read for CompositeFeed
- `_updateTopAgents(bytes32 categoryId, uint256 agentId) internal` — insertion-sort by `accuracyScore`; tiebreak by lower `agentId`; only includes agents with `resolvedCount >= TOP_AGENT_MIN_RESOLVED`

**Soulbound:** Override `_update` to revert on transfers (allow mint/burn only).

### 7.2 `PredictionMarket.sol`

```solidity
enum PredictionStatus { Committed, Revealed, Resolved, Cancelled, Forfeited }

struct Prediction {
    uint256 agentId;
    bytes32 categoryId;
    bytes32 commitHash;
    bytes value;              // Set at reveal
    uint16 confidence;        // 0-10000 bps; set at reveal
    bytes32 contentHash;      // IPFS pointer to extended metadata
    uint256 stake;
    uint256 commitBlock;
    uint256 resolutionBlock;
    PredictionStatus status;
    int256 score;
}

mapping(uint256 => Prediction) public predictions;
uint256 public nextPredictionId;
uint256 public constant REVEAL_DELAY_BLOCKS = 10;
uint256 public constant REVEAL_WINDOW_BLOCKS = 100;
uint256 public constant SUBMISSION_CUTOFF_BLOCKS = 200;
```

**Key functions:**
- `commit(uint256 agentId, bytes32 categoryId, bytes32 commitHash, uint256 resolutionBlock, bytes32 contentHash) external payable returns (uint256 predictionId)`
- `reveal(uint256 predictionId, bytes calldata value, uint16 confidence, bytes32 nonce) external`
- `cancel(uint256 predictionId) external` — 90% refund, 10% slashed to bonus pool
- `forfeitUnrevealed(uint256 predictionId) external` — anyone can call after reveal window; 100% to bonus pool, caller gets 0.5%
- `settleStake(uint256 predictionId, uint256 returnAmount, uint256 bonusAmount, uint256 resolverReward) external onlyScoringEngine`

#### 7.2.1 Validation in `commit()`

- Category registered with config.
- `resolutionBlock - block.number ∈ [SUBMISSION_CUTOFF_BLOCKS + REVEAL_WINDOW_BLOCKS, MAX_WINDOW]`. Guarantees reveal can complete with cutoff buffer.
- `msg.value >= category.minStake`.
- Caller must be `agents[agentId].controller`.

#### 7.2.2 Validation in `reveal()`

- `keccak256(abi.encode(agentId, categoryId, value, confidence, nonce)) == commitHash`
- `block.number >= commitBlock + REVEAL_DELAY_BLOCKS`
- `block.number <= commitBlock + REVEAL_WINDOW_BLOCKS`
- `block.number <= resolutionBlock - SUBMISSION_CUTOFF_BLOCKS`
- Value bytes valid for category schema.

#### 7.2.3 Cancellation

- Callable by agent's controller, any time before resolution block.
- **Refund: 90% of stake.** 10% slashed to bonus pool.
- Status → `Cancelled`.

#### 7.2.4 Stake settlement formula

Inputs: `originalStake`, `score` ∈ [-1e6, +1e6]

**Order matters** — resolver paid first so conservation `resolver_reward + returned_to_agent + slashed_to_pool == stake` always holds:

```
resolver_reward   = stake × 0.02                    # paid first, fixed 2%
remaining         = stake - resolver_reward         # = 0.98 × stake
score_normalized  = score / 1_000_000               # ∈ [-1.0, +1.0]
return_rate       = 0.5 + 0.5 × score_normalized    # ∈ [0.0, 1.0]
returned_to_agent = remaining × return_rate
slashed_to_pool   = remaining - returned_to_agent   # ∈ [0, remaining]
```

`slashed_to_pool` → `BonusDistributor` for that category's current epoch.

**Bonus pool distribution — PULL pattern (`BonusDistributor`):**

To avoid unbounded iteration during distribution, the contract uses claim-pull rather than push-iteration:

```
# On every ScoringEngine.applyScore() call:
agent_share[categoryId][epoch][agentId] += max(0, score_normalized)² × stake
total_share[categoryId][epoch]          += max(0, score_normalized)² × stake
pool[categoryId][epoch]                 += slashed_to_pool         # via notifySlash()

# Anyone calls once per (categoryId, epoch) after epoch ends:
finalizeEpoch(categoryId, epoch):
  require block.number > epoch_end_block
  rollover           = pool[categoryId][epoch] × 0.05
  finalPool          = pool[categoryId][epoch] - rollover
  finalTotalShare    = total_share[categoryId][epoch]
  pool[categoryId][epoch+1] += rollover
  finalized[categoryId][epoch] = true
  emit EpochFinalized(...)

# Each contributing agent calls independently:
claimBonus(categoryId, epoch):
  require finalized[categoryId][epoch]
  require !claimed[categoryId][epoch][agentId]
  amount = finalPool × agent_share[categoryId][epoch][agentId] / finalTotalShare
  claimed[...] = true
  transfer(controller, amount)
```

Epoch length: **1000 blocks (~33 minutes on Mantle, 2s block time).** `finalizeEpoch` callable by anyone; pays caller 0.5% of `finalPool` as gas reward (deducted from finalPool before claim math).

#### 7.2.5 Reveal-failure forfeiture

If `block.number > commitBlock + REVEAL_WINDOW_BLOCKS` and status still `Committed`: anyone calls `forfeitUnrevealed(predictionId)`. **100% of stake** → bonus pool. Caller gets 0.5% gas reward.

### 7.3 `ResolutionEngine.sol`

**ResolutionEngine is the single source of truth for both resolvers and scorers per category.** ScoringEngine does NOT hold its own scorer mapping — it receives the scorer address as a parameter from ResolutionEngine on each `applyScore` call. This keeps category registration atomic (one call wires both) and removes a duplicated mapping.

```solidity
interface ICategoryResolver {
    function resolve(bytes calldata predictionValue, uint256 resolutionBlock)
        external view returns (bytes memory outcome);
}

mapping(bytes32 => address) public resolvers;       // categoryId => resolver
mapping(bytes32 => address) public scorers;          // categoryId => scorer (passed to ScoringEngine)
mapping(bytes32 => bytes)   public categoryConfig;   // arbitrary per-category bytes
```

**Key functions:**
- `registerCategory(bytes32 categoryId, address resolver, address scorer, bytes calldata config) external onlyOwner`
- `resolve(uint256 predictionId) external` — caller paid 2% of stake as gas reward. Flow:
  1. Read prediction from PredictionMarket (require status == Revealed, `block.number >= resolutionBlock`, not already resolved).
  2. `outcome = ICategoryResolver(resolvers[categoryId]).resolve(prediction.value, prediction.resolutionBlock)`
  3. `ScoringEngine.applyScore(predictionId, outcome, scorers[categoryId], categoryConfig[categoryId], msg.sender)` — passes scorer addr, config, and the resolve() caller (for the gas reward).

#### 7.3.1 `MethAprResolver.sol`

- Reads mETH exchange rate at `resolutionBlock` and at `resolutionBlock - 43200`.
- `aprBps = ((rateNow × 1e18 / ratePrior - 1e18) × 365 × 10000) / 1e18`
- Returns `abi.encode(uint256 aprBps)`.
- Edge: zero or negative rate change → 0 (clamp).

#### 7.3.2 `AaveMantleTvlResolver.sol`

- Iterates Aave-on-Mantle reserves.
- Per reserve: `aToken.totalSupply() × oracle.getPrice(underlying)`.
- Sums to USD TVL with 8 decimals.
- Contingency: swap implementation to INIT Capital if Aave-Mantle unavailable.

### 7.4 `ScoringEngine.sol`

```solidity
interface ICategoryScorer {
    function score(
        bytes calldata prediction,
        bytes calldata outcome,
        uint16 confidence,
        bytes calldata categoryConfig
    ) external pure returns (int256 score);
}
```

**Key functions:**
- `applyScore(uint256 predictionId, bytes calldata outcome, address scorer, bytes calldata categoryConfig, address resolverCaller) external onlyResolutionEngine`
  - `scorer` is passed by ResolutionEngine; ScoringEngine does NOT maintain its own scorers mapping.
  - `resolverCaller` is the EOA/contract that called `ResolutionEngine.resolve()` — paid the 2% gas reward via `PredictionMarket.settleStake()`.

  Steps:
  1. Read prediction (agentId, categoryId, confidence, stake) from PredictionMarket.
  2. `score = ICategoryScorer(scorer).score(value, outcome, confidence, categoryConfig)`
  3. Update accuracy EMA in AgentRegistry.
  4. Update calibration bucket state per §7.4.2.
  5. Compute settlement amounts per §7.2.4 (resolver_reward first, then split remaining).
  6. Push share to `BonusDistributor` via `recordContribution` and `notifySlash` (per §7.2.4 pull pattern).
  7. `PredictionMarket.settleStake(predictionId, returned_to_agent, 0, resolver_reward, resolverCaller)` — bonusAmount arg is 0 because bonuses now flow via pull-claim, not push-at-resolve.
  8. Emit `PredictionScored`.

#### 7.4.1 `RangeCrpsScorer.sol`

- Discretizes range and outcome into 100 buckets per category config.
- Treats predicted range as uniform over its buckets.
- Computes CRPS in closed form.
- Maps to [-1e6, +1e6].
- **Must match Python reference** in `contracts/test/reference/crps_reference.py`. 10 cases hard-coded; ≤0.1% relative error required.

#### 7.4.2 Calibration formula

Each agent has 10 confidence buckets per category (0–999 bps, 1000–1999, ..., 9000–9999 bps).

On each resolution:

```
bucket_idx = confidence / 1000
score_norm = score / 1_000_000              # ∈ [-1, +1]
realized_accuracy = (score_norm + 1) / 2    # ∈ [0, 1]

α = 0.1   # EMA weight
bucket_accuracy[bucket_idx] = (1-α) × bucket_accuracy[bucket_idx] + α × realized_accuracy
bucket_count[bucket_idx]   += 1
```

**Calibration score computed on read:**

```
total_count = Σ bucket_count[i] for i in 0..9
if total_count < 10: return 0   # cold start; UI shows "calibrating" badge

For i in 0..9:
  bucket_midpoint   = (i × 1000 + 500) / 10000   # ∈ [0, 1]
  bucket_weight     = bucket_count[i] / total_count
  squared_error[i]  = (bucket_midpoint - bucket_accuracy[i])²

calibration_score_raw = -Σ squared_error[i] × bucket_weight[i]
calibration_score = calibration_score_raw × 1_000_000 × 4
                    # ×4 because max squared diff is 0.25
calibration_score = max(-1e6, calibration_score)
```

**Python reference required** in `contracts/test/reference/calibration_reference.py`. Same 10-case pattern as CRPS.

### 7.5 `CompositeFeed.sol`

```solidity
struct CompositeForecast {
    bytes value;
    uint16 confidence;
    uint256 contributingAgents;
    uint256 lastUpdatedBlock;
}

mapping(bytes32 => CompositeForecast) public feeds;
uint256 public constant REFRESH_RATE_LIMIT_BLOCKS = 100;
```

**Key functions:**
- `read(bytes32 categoryId) external view returns (CompositeForecast memory)` — gated by `SubscriptionGate` (open in v1)
- `refresh(bytes32 categoryId) external` — rate-limited to once per 100 blocks per category

#### 7.5.1 Refresh logic

1. Read top 20 agents from `AgentRegistry.topAgents[categoryId]` (already sorted by accuracy; only includes agents with `resolvedCount ≥ TOP_AGENT_MIN_RESOLVED = 10`).
2. For each, find their most recent **active** (status = Revealed, not yet resolved) prediction in this category. Skip if none.
3. Compute rank-based weights: agent at rank `r` (1-indexed) gets `(21 - r) / 210`. Re-normalize over the agents that contributed (skipped agents excluded). Weights sum to 1.
4. Ensemble value = Σ (weight × agent's point estimate).
5. Aggregated confidence (outlier-resistant):
   - `weightedStatedConfidence = Σ (weight × agent.stated_confidence)`
   - For each contributing agent: `clipped_cal = max(agent.calibrationScore / 1e6, -0.5)` ∈ [-0.5, 0]. Caps the drag any single badly-calibrated agent can apply.
   - `multiplier = 1 + mean(clipped_cal across contributors)` ∈ [0.5, 1.0]
   - `final = clamp(weightedStatedConfidence × multiplier, 0, 10000)`
6. Write to storage; emit `CompositeFeedRefreshed(categoryId, value, confidence, contributorCount, block.number)`.

#### 7.5.2 Why rank-based, not softmax

Accuracy and calibration scores can be negative. Naive softmax on signed values is broken (negative × negative = positive weight on bad agents). Rank-based weighting sidesteps this; calibration enters as a confidence multiplier instead of a value weight. Simpler in fixed-point Solidity, more interpretable in UI.

#### 7.5.3 Refresh trigger (operational)

`refresh()` is permissionless and rate-limited (once per 100 blocks per category) but no one is intrinsically incentivized to call it — leaving the feed stale would tank the demo. Triggering is handled out-of-band:

1. **Primary:** Vercel cron (or GitHub Actions cron) hits a Next.js route handler that calls `refresh()` via a hot signer key. Cadence: every 5 minutes (≈150 blocks, safely above rate limit).
2. **Fallback:** `/demo-consumer` frontend page exposes a "Refresh feed" button wired to user wallet; lets judges trigger live during demo.
3. **Post-hackathon:** Move to a Chainlink Automation upkeep or a small reward to refresh-caller funded from subscription revenue.

Operational config (cron key, RPC endpoint) lives in `frontend/.env` and `agents/refresher/`. Document in deploy notes.

### 7.6 `SubscriptionGate.sol`

```solidity
mapping(address => uint256) public subscriptionExpiry;
mapping(bytes32 => bool) public requiresSubscription;
```

Hackathon v1: all categories have `requiresSubscription = false`. Contract demonstrates the architecture for the pitch; production v2 enables it.

---

## 8. Off-chain agent specifications

### 8.1 Agent SDK (TypeScript)

Located at `agents/sdk/`. Exports:

- `class Agent` — base with `commit()`, `reveal()`, `submitFullCycle()` helpers
- `getCategoryConfig(categoryId)` — reads on-chain
- TypeScript types per category schema
- Automatic commit-reveal orchestration: handles wait between commit and reveal, retries on failure

#### 8.1.1 Agent metadata schema (JSON, on IPFS)

```json
{
  "name": "Claude Reasoner",
  "description": "LLM-driven agent that reasons about Mantle on-chain state and crypto news to produce forecasts with explicit reasoning traces.",
  "model": "claude-opus-4-7",
  "operator": "Predictor Index reference team",
  "categories": ["0x...", "0x..."],
  "homepage": "https://github.com/...",
  "version": "0.1.0",
  "license": "MIT"
}
```

Uploaded to IPFS via Pinata or web3.storage. Hash committed at registration.

### 8.2 Reference agent 1 — ARIMA baseline

- TypeScript Node app.
- Schedule: every 6 hours, per category.
- Logic: fit ARIMA(1,1,1) on historical category outcomes; predict mean + 95% CI for resolution block.
- Confidence: fixed at 5000 bps (50%).
- **First 24h SEED_MODE: short resolution windows (~100 blocks ≈ 3.3 min on 2s blocks)** to seed the leaderboard with resolved predictions before demo. Cadence in seed mode: every 30 minutes per category.
- **Auto-flip out of SEED_MODE:** on each schedule tick, agent polls indexer endpoint `GET /agent/:id/predictions?status=Resolved` and counts. If `count ≥ 50` OR `seedStartTimestamp + 48h < now`, flip to normal mode: `resolutionBlock = currentBlock + 43200`, cadence every 6h. Flip persisted to local `agent.state.json`.

### 8.3 Reference agent 2 — Claude reasoner (DEMO HIGHLIGHT)

- TypeScript Node app.
- Schedule: every 6 hours, per category.
- Logic:
  1. Build prompt: last 7 days of category data + last 24h crypto news (cryptopanic RSS).
  2. Send to Claude (claude-opus-4-7 or claude-sonnet-4-5).
  3. Parse JSON: `predicted_value`, `confidence`, `reasoning`.
  4. Upload prompt + response to IPFS; commit hash as `contentHash`.
  5. Submit via SDK.
- Confidence: AI-stated.
- Same SEED_MODE behavior as ARIMA (§8.2): 30-min cadence, ~100-block windows, auto-flip on indexer count or 48h elapsed.

**Few-shot examples — Day 9 deliverable.** Before the agent goes live, hand-write 2–3 example forecasts in `agents/claude-reasoner/fewshot/*.json`. Each shows: observed data block → hypothesis → forecast range → confidence with justification. These are concatenated into the user prompt. Without them, early predictions are bland and the reasoning trace doesn't sell the demo.

### 8.4 Specialized quant agent — **CUT for hackathon**

Defer post-hackathon. ARIMA + Claude is sufficient.

---

## 9. Frontend specifications

### 9.1 Tech stack

- Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui
- wagmi v2 + viem
- TanStack Query
- Recharts

### 9.2 Pages (hackathon scope)

**Must ship by Day 13:**

**`/` — Leaderboard**
- Sortable: accuracy / calibration / resolved count.
- Per-category tabs.
- Composite feed snapshot card.
- "How it works" collapsible.

**`/agent/[id]` — Agent detail**
- Identity NFT card.
- Reputation radar by category.
- Prediction history (paginated).
- Equity curve.
- **For Claude reasoner: expandable rows with full reasoning from IPFS.** This is the visual highlight — invest here.
- "Stake on this agent" disabled with v2 tooltip.

**`/demo-consumer` — Live feed consumption**
- Shows `DemoFeedConsumer` reading composite feed in real time.
- "What is this?" panel for protocols.

**Ship if Day 13 polish allows:**
- `/category/[id]`, `/submit`, `/about`.

### 9.3 Design

- Bloomberg-terminal aesthetic: data-dense, monospace numbers, sparse color.
- Mantle teal as single accent on near-monochrome base.
- **QA at 375px width.** Judges screenshot on mobile.

---

## 10. Indexer

Ponder. Indexes:
- `AgentRegistered`, `ControllerRotated`, `ReputationUpdated`
- `PredictionCommitted`, `PredictionRevealed`, `PredictionCancelled`, `PredictionForfeited`, `PredictionScored`
- `CompositeFeedRefreshed`, `BonusDistributed`

REST API:
- `GET /leaderboard?category=...&limit=...`
- `GET /agent/:id`
- `GET /agent/:id/predictions?offset=&limit=`
- `GET /category/:id`
- `GET /feed/:category/history`

Host: Railway or Fly.io free tier.

---

## 11. Demo plan

### 11.1 Two-minute video

- 0:00–0:30 — Problem: AI forecasting agents are everywhere, none verifiable.
- 0:30–1:30 — Walkthrough: leaderboard → agent detail → reasoning trace → composite feed → demo consumer.
- 1:30–2:00 — Pitch: every decision on-chain via ERC-8004, agents earn reputation, protocols subscribe.

### 11.2 Live demo (AI Awakening)

- Leaderboard with live equity curves.
- Trigger manual resolution → reputation updates visibly.
- Open Claude's latest reasoning trace.
- Show demo consumer reading the feed.
- Close: open registration, open subscription, Mantle is the canonical home.

---

## 12. 2-week build sequence

### Week 1

**Days 1–2:** Monorepo (Foundry only). AgentRegistry deployed to Mantle Sepolia. Tests passing.

**Days 3–4:** PredictionMarket commit-reveal. Stake escrow + cancellation. MethAprResolver. End-to-end commit/reveal/manual-resolve.

**Days 5–6:** ScoringEngine + RangeCrpsScorer + Python reference + 10 test cases. Calibration formula + Python reference. BonusDistributor. AaveMantleTvlResolver.

**Day 7:** CompositeFeed with rank-based weighting. Ponder indexer deployed.

### Week 2

**Days 8–9:** Agent SDK with auto-commit-reveal. ARIMA running. Claude reasoner running. Short-window seeding in first 24h.

**Days 10–11:** Frontend 3 must-have pages. Heavy investment in agent detail reasoning display.

**Day 12:** DemoFeedConsumer deployed. End-to-end integration test.

**Day 13:** Polish. Mobile QA at 375px. Optional /category, /submit, /about pages. Record demo video.

**Day 14:** Buffer. Mainnet deploy if confident. DoraHacks submission.

---

## 13. Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| CRPS or calibration math bug | High | Python references + 10 cases each, fuzz test |
| Oracle stale during resolution | Medium | On-chain reads only; oracle category deferred |
| No resolved predictions by demo day | High | **Short ~100-block (~3.3 min on Mantle 2s blocks) resolution windows in first 24h SEED_MODE.** Auto-flip to 43200-block (24h) windows after 50 resolved or 48h. |
| Gas costs uneconomical | Low | Mantle cheap; 0.1 MNT min stake comfortable |
| ERC-8004 spec changes | Low | Implement against current draft; flag in README |
| Sybil attacks | Medium | 0.1 MNT registration fee + 0.1 MNT min stake |
| Indexer downtime during demo | High | Pre-cache leaderboard JSON as static fallback |
| Aave-Mantle unavailable | Medium | Swap to INIT_CAPITAL_TVL_24H, same interface |
| Claude API rate limit during demo | Medium | Cache last reasoning trace as static asset |
| Front-running near resolution | High | **Commit-reveal + 200-block submission cutoff** |
| Reveal-failure griefing | Low | Forfeit-after-window, anyone can trigger |

---

## 14. Out of scope for hackathon

- StakingPool (was stretch; cut)
- MNT_PRICE_7D
- specialized-quant agent
- Cross-chain feed reads
- ZK-private predictions
- Python SDK
- Binary event categories
- Slashing on bad reasoning (separate project)
- Multi-language frontend
- Mobile-native app

---

## 15. Post-hackathon roadmap (for pitch deck)

**M1–M3:** 10 external agents. Add MNT_PRICE_7D. **First paying protocol consumer.**

**M4–M6:** Python SDK. StakingPool live. LayerZero cross-chain reads.

**M7–M12:** Binary event categories. Reputation-weighted governance. First white-label.

**Year 2:** Data licensing. Premium tiers. Multi-model judge mechanism. **Move on-chain topAgents sorted list to indexer-driven feed** (current insertion-sort costs O(20) writes per reputation update — fine for hackathon scale, painful at 1000+ agents).

---

## 16. Repo structure

```
predictor-index/
├── contracts/
│   ├── src/
│   │   ├── AgentRegistry.sol
│   │   ├── PredictionMarket.sol
│   │   ├── ResolutionEngine.sol
│   │   ├── ScoringEngine.sol
│   │   ├── CompositeFeed.sol
│   │   ├── SubscriptionGate.sol
│   │   ├── BonusDistributor.sol
│   │   ├── resolvers/
│   │   │   ├── AaveMantleTvlResolver.sol
│   │   │   └── MethAprResolver.sol
│   │   ├── scorers/
│   │   │   └── RangeCrpsScorer.sol
│   │   └── examples/
│   │       └── DemoFeedConsumer.sol
│   ├── test/
│   │   ├── reference/
│   │   │   ├── crps_reference.py
│   │   │   └── calibration_reference.py
│   │   └── *.t.sol
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── agent/[id]/page.tsx
│   │   └── demo-consumer/page.tsx
│   └── package.json
├── indexer/
│   ├── ponder.config.ts
│   └── src/index.ts
├── agents/
│   ├── sdk/
│   ├── arima-baseline/
│   ├── claude-reasoner/
│   │   └── fewshot/                       # hand-written examples (Day 9 deliverable)
│   └── refresher/                         # cron worker that calls CompositeFeed.refresh()
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SCORING.md
│   └── DEMO_SCRIPT.md
├── README.md
└── pnpm-workspace.yaml
```

---

## 17. Submission checklist (DoraHacks)

- [ ] One-liner: "On-chain AI forecasting benchmark for Mantle, with agents ranked by verifiable accuracy and protocols subscribing to the ensemble feed."
- [ ] Full description
- [ ] GitHub repo (public)
- [ ] Live frontend URL
- [ ] Demo video ≥2 min
- [ ] Deployed addresses on Mantle (explorer-verified)
- [ ] Track: AI Alpha & Data
- [ ] Grand Champion nomination
- [ ] Team info

---

**End of PRD v2.**