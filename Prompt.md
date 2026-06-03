# Claude Code Prompt Series — Predictor Index (v2.2)

**Changes v2.1 → v2.2 (frontend stack pivot, 2026-05-26):**
- Prompt 1: frontend deps = Radix UI + Tailwind + Motion (no shadcn CLI). Add Inter + JetBrains Mono via next/font.
- Prompt 11: design = hybrid (terminal core + cinematic landing). Use Radix primitives directly. Motion drives hero.
- Prompt 13: replaces "subtle" landing animation with cinematic-on-hero, subtle-on-terminal-surfaces split.

Sequenced prompts to drive Claude Code through the build. Run them in order. Verify the checklist between each.

> **How to use:** Open Claude Code in a fresh directory with `README.md` (v2.1 PRD) present. Paste Prompt 0 first. Then 1, 2, ..., in order.
>
> **Changes from v1:** Hardhat dropped (Foundry only). Commit-reveal added. Stake settlement formula spec'd. Calibration formula spec'd with Python reference. Rank-based composite weighting. Scope cuts: no StakingPool, no third agent, no third category, /category and /submit pages optional.
>
> **Changes v2 → v2.1 (sync with PRD patches):**
> - Stake settlement reordered (resolver_reward paid first) — Prompt 5
> - BonusDistributor pull-claim pattern (no iteration) — Prompt 6
> - ScoringEngine.applyScore takes scorer addr + config + resolverCaller from ResolutionEngine — Prompts 4, 5
> - AgentRegistry maintains `topAgents[categoryId]` sorted top-20 array internally — Prompts 2, 6
> - CompositeFeed confidence clamps per-agent calibration at -0.5 — Prompt 6
> - Refresher cron worker added under `agents/refresher/` — Prompt 11 / Prompt 13
> - SEED_MODE auto-flip uses indexer poll on resolvedCount — Prompts 9, 10
> - Few-shot examples = Day-9 hand-written deliverable — Prompt 10

---

## Prompt 0 — Sanity check

```
Read README.md in this directory. Give me a 5-bullet summary of what we're building. Don't write any code yet. Specifically confirm:
1. You understand commit-reveal in §4.2 and §7.2
2. You understand the stake settlement formula in §7.2.4
3. You understand the calibration formula in §7.4.2
4. You understand the rank-based (not softmax) composite weighting in §7.5
5. You understand the scope cuts in §14
```

**Verify:** All 5 confirmations explicit. If any are missing or vague, the PRD didn't load properly. Fix that before proceeding.

---

## Prompt 1 — Monorepo scaffolding

```
Set up the monorepo structure exactly as specified in §16 of README.md.

Requirements:
- pnpm workspaces at root
- Four packages: contracts/, frontend/, indexer/, agents/sdk/
- Two sub-packages under agents/: arima-baseline/, deepseek-reasoner/
- (NOTE: specialized-quant is CUT per §14 — do not create)
- contracts/: Foundry only. NO HARDHAT. foundry.toml configured for Solidity 0.8.24, Mantle Sepolia default. OpenZeppelin remapping.
- frontend/: Next.js 14 App Router, TypeScript, Tailwind CSS, Radix UI (headless primitives, no shadcn CLI), Motion (animation), wagmi v2, viem, TanStack Query, Recharts, next/font (Inter + JetBrains Mono). Stack per README §9.1 v2.2.
- indexer/: Ponder template
- agents/sdk/: bare TypeScript package
- Root .gitignore: node_modules, .env, foundry out/ broadcast/, Next .next/, indexer .ponder/
- Root README.md indexes the four packages
- Do NOT write contract logic yet. Just scaffold.

Final check: list directory tree and confirm.
```

**Verify:**
- `pnpm install` works at root
- `cd contracts && forge build` runs
- `cd frontend && pnpm dev` starts
- All §16 directories exist
- No `hardhat.config.*` files anywhere

---

## Prompt 2 — AgentRegistry (ERC-8004, soulbound, with registration fee)

```
Build AgentRegistry per §7.1 of README.md.

Specifics:
- Solidity 0.8.24, contracts/src/AgentRegistry.sol
- ERC-8004 soulbound NFT (non-transferable except mint/burn)
- OpenZeppelin ERC721 base; override _update to revert transfers
- Storage layout exactly per §7.1, including:
  - REGISTRATION_FEE = 0.1 ether constant
  - TOP_AGENT_MIN_RESOLVED = 10 constant
  - treasury address (receives fees)
  - int256[10] bucketAccuracy and uint256[10] bucketCount in Reputation struct
  - mapping(bytes32 => uint256[20]) public topAgents — sorted by accuracyScore desc, tiebreak by lower agentId, only includes agents with resolvedCount >= TOP_AGENT_MIN_RESOLVED
- Internal _updateTopAgents(categoryId, agentId) called automatically on every updateReputation:
  - If agent qualifies (resolvedCount >= 10) AND would rank in top 20: insertion-sort it in
  - If agent currently in top 20 but accuracy dropped: re-position or evict
  - Use a fixed-size in-memory array, write back to storage
  - Tests must cover: insertion at top, insertion at bottom, eviction, tie-breaking, agent dropping below threshold
- register(string metadataURI) payable: must receive exactly 0.1 MNT, forwarded to treasury
- 24-hour timelock controller rotation (two-step: propose + execute)
- Reputation updates restricted to designated ScoringEngine via onlyScoringEngine modifier; setScoringEngine() admin function
- Events: AgentRegistered, ControllerRotationProposed, ControllerRotated, ReputationUpdated

Tests in contracts/test/AgentRegistry.t.sol:
- register without fee → revert
- register with correct fee → NFT minted, controllerToAgent set, fee in treasury
- Attempt transfer → revert
- proposeControllerRotation → wait 24h → execute → new controller set
- Attempt execute before timelock → revert
- updateReputation from non-ScoringEngine → revert
- updateReputation from ScoringEngine → state changes correctly, including bucket arrays
- topAgents: register 25 agents, update reputation with varied accuracy → top 20 array correctly sorted, ties broken by lower agentId
- topAgents: agent with resolvedCount < 10 never enters topAgents even with high accuracy
- topAgents: agent in top 20 has accuracy reduced → either re-positions or evicts correctly
- Fuzz: monotonic IDs, no collisions

Run forge test. Report coverage.
```

**Verify:**
- All tests pass
- Coverage ≥90% (`forge coverage`)
- Soulbound enforcement works
- Registration fee flow verified

---

## Prompt 3 — PredictionMarket with commit-reveal

```
Build PredictionMarket per §7.2 of README.md. THIS IS THE COMMIT-REVEAL CONTRACT — implement carefully.

Specifics:
- Solidity 0.8.24, contracts/src/PredictionMarket.sol
- Storage exactly per §7.2:
  - PredictionStatus enum: Committed, Revealed, Resolved, Cancelled, Forfeited
  - Prediction struct with commitHash, value (set later at reveal), confidence, contentHash, stake, commitBlock, resolutionBlock, status, score
  - REVEAL_DELAY_BLOCKS = 10, REVEAL_WINDOW_BLOCKS = 100, SUBMISSION_CUTOFF_BLOCKS = 200
- Category registry mapping: categoryId → (resolver, scorer, minStake, allowedWindowStart, allowedWindowEnd, configBytes). Admin-set; document governance-controlled in production.

Functions:

1. commit(uint256 agentId, bytes32 categoryId, bytes32 commitHash, uint256 resolutionBlock, bytes32 contentHash) external payable returns (uint256)
   Validation per §7.2.1:
   - Category registered
   - resolutionBlock - block.number ∈ [SUBMISSION_CUTOFF_BLOCKS + REVEAL_WINDOW_BLOCKS, category.allowedWindowEnd]
   - msg.value >= category.minStake
   - msg.sender == agents[agentId].controller (read from AgentRegistry)
   - Escrows stake, emits PredictionCommitted with all params

2. reveal(uint256 predictionId, bytes calldata value, uint16 confidence, bytes32 nonce) external
   Validation per §7.2.2:
   - keccak256(abi.encode(agentId, categoryId, value, confidence, nonce)) == prediction.commitHash
   - block.number >= commitBlock + REVEAL_DELAY_BLOCKS
   - block.number <= commitBlock + REVEAL_WINDOW_BLOCKS
   - block.number <= resolutionBlock - SUBMISSION_CUTOFF_BLOCKS
   - confidence <= 10000
   - Sets value/confidence, status → Revealed, emits PredictionRevealed

3. cancel(uint256 predictionId) external — per §7.2.3
   - Only controller, only before resolution block
   - 90% refund to controller, 10% to bonus pool (interface call to BonusDistributor)
   - Status → Cancelled

4. forfeitUnrevealed(uint256 predictionId) external — per §7.2.5
   - Anyone can call after commitBlock + REVEAL_WINDOW_BLOCKS
   - Status must still be Committed
   - 99.5% of stake → bonus pool, 0.5% → caller
   - Status → Forfeited

5. settleStake(uint256 predictionId, uint256 returnAmount, uint256 bonusAmount, uint256 resolverReward, address resolver) external onlyScoringEngine
   - Transfers returnAmount to controller
   - Transfers resolverReward to resolver
   - Transfers bonusAmount to bonus pool
   - Status → Resolved
   - Updates score in storage

Use OpenZeppelin ReentrancyGuard on all stake-moving functions.

Tests in contracts/test/PredictionMarket.t.sol:
- commit with valid params → state set
- commit with invalid category → revert
- commit with stake below minimum → revert
- commit with resolutionBlock too soon → revert
- commit from non-controller → revert
- reveal with wrong nonce → revert
- reveal before REVEAL_DELAY → revert
- reveal after REVEAL_WINDOW → revert
- reveal too close to resolution → revert
- reveal with valid nonce → state set, status Revealed
- cancel before resolution → 90% refund, 10% to bonus pool
- cancel after resolution → revert
- forfeit before window expires → revert
- forfeit after window → 99.5% to pool, 0.5% to caller
- Fuzz: random valid commit-reveal pairs always succeed
- Reentrancy attack on commit → reverts

Run forge test. Report results.
```

**Verify:**
- All tests pass including fuzz
- Math is correct on cancel (90/10) and forfeit (99.5/0.5)
- Reentrancy guards work
- Reveal validation prevents all stated attack paths

---

## Prompt 4 — ResolutionEngine + MethAprResolver (first resolver)

```
Build ResolutionEngine + MethAprResolver per §7.3 of README.md.

Part A — ResolutionEngine.sol:
- Per §7.3 structure with ICategoryResolver interface
- ResolutionEngine is single source of truth for both resolvers AND scorers per category. ScoringEngine does NOT hold its own scorers mapping.
- Storage: mapping(bytes32 => address) public resolvers, mapping(bytes32 => address) public scorers, mapping(bytes32 => bytes) public categoryConfig
- registerCategory(categoryId, resolver, scorer, config) external onlyOwner — sets all three mappings atomically
- resolve(uint256 predictionId) external:
  1. Read prediction from PredictionMarket
  2. Require status == Revealed
  3. Require block.number >= resolutionBlock
  4. Require not already resolved
  5. outcome = ICategoryResolver(resolvers[categoryId]).resolve(prediction.value, prediction.resolutionBlock)
  6. ScoringEngine.applyScore(predictionId, outcome, scorers[categoryId], categoryConfig[categoryId], msg.sender)
     — passes scorer addr, category config bytes, and the resolve() caller (msg.sender) for the 2% gas reward
  7. ScoringEngine will call back to PredictionMarket.settleStake with msg.sender as resolverCaller

Part B — MethAprResolver.sol per §7.3.1:
- Implements ICategoryResolver
- Reads mETH exchange rate at resolutionBlock and resolutionBlock - 43200
- Use a placeholder constant for mETH contract address (METH_ADDRESS) — I'll set the real value in deploy config
- Computes: aprBps = ((rateNow × 1e18 / ratePrior - 1e18) × 365 × 10000) / 1e18
- Edge cases: zero or negative change → 0 (clamp, don't underflow)
- Returns abi.encode(uint256 aprBps)
- Document the formula in a comment block at the top
- Note: actual mETH contract access at a specific historical block may need archive RPC. If standard JSON-RPC can't read at arbitrary blocks, document in a code comment that we'd need an archive node or a snapshot indexer pattern — for hackathon, can use a mock-controlled price feed contract that we update from a script.

For hackathon viability, create a fallback MockMethRateOracle.sol:
- Admin-settable per-block exchange rates
- A script in script/SeedRates.s.sol that populates historical rates so MethAprResolver works
- MethAprResolver reads from this oracle in v1; comment that v2 reads mETH directly

Tests in contracts/test/ResolutionEngine.t.sol:
- registerCategory then resolve a mocked prediction → ScoringEngine called
- resolve before resolutionBlock → revert
- resolve already-resolved → revert
- resolve unrevealed prediction → revert

Tests in contracts/test/MethAprResolver.t.sol:
- Seed MockMethRateOracle with 2 rates at different blocks
- Resolve with known inputs → APR matches hand calculation
- Zero rate change → 0
- Negative change → 0 (clamped)

Run forge test.
```

**Verify:**
- All tests pass
- APR math correct on at least 2 hand-verified cases
- Mock oracle pattern works
- Resolve gas reward path is wired (even if not yet paid — will be in Prompt 5)

---

## Prompt 5 — ScoringEngine + CRPS scorer + calibration (with TWO Python references)

```
Build ScoringEngine, RangeCrpsScorer, and the calibration update per §7.4 of README.md. THIS IS THE MOST NUMERICALLY-SENSITIVE PROMPT. Move slowly.

Part A — RangeCrpsScorer.sol:
- Implements ICategoryScorer
- Discretizes prediction range and outcome into 100 buckets across category's expected domain (from categoryConfig)
- Treats predicted range as uniform over its buckets
- Computes CRPS in closed form for uniform-over-bucket vs point-mass outcome
- Maps CRPS to score ∈ [-1e6, +1e6]: perfect = +1e6, worst = -1e6
- Document the math in comments

Part B — Python reference for CRPS:
- contracts/test/reference/crps_reference.py
- Pure Python implementation matching the Solidity exactly
- Generate 10 test cases with diverse inputs (perfect prediction, off-by-one bucket, fully outside domain, edge of domain, etc.)
- Print expected outputs in a format Solidity test can hard-code

Part C — ScoringEngine.sol:
- applyScore(uint256 predictionId, bytes calldata outcome, address scorer, bytes calldata categoryConfig, address resolverCaller) external onlyResolutionEngine
  - scorer and categoryConfig passed from ResolutionEngine. ScoringEngine does NOT have its own scorers mapping.
  - resolverCaller is the EOA that called ResolutionEngine.resolve() — gets the 2% gas reward.
  1. Get prediction (agentId, categoryId, value, confidence, stake) from PredictionMarket
  2. Call ICategoryScorer(scorer).score(value, outcome, confidence, categoryConfig) → int256 score
  3. Compute calibration update per §7.4.2:
     - bucket_idx = confidence / 1000
     - score_norm = score / 1_000_000
     - realized_accuracy = (score_norm + 1) / 2, scaled appropriately
     - Read agent's current Reputation from AgentRegistry
     - Apply EMA: new_bucket_accuracy = (1-α) × old + α × realized, where α = 0.1
     - Increment bucket_count[bucket_idx]
  4. Compute updated overall accuracy_score EMA:
     - new_accuracy_score = (1-α) × old_accuracy_score + α × score, where α = 0.1
  5. Compute new calibration_score per §7.4.2 "computed on read" formula
  6. Call AgentRegistry.updateReputation(agentId, categoryId, newAccuracy, newCalibration, newBuckets, newBucketCounts)
     — this also triggers internal _updateTopAgents(categoryId, agentId)
  7. Compute stake settlement per §7.2.4 — ORDER MATTERS, RESOLVER PAID FIRST:
     - resolver_reward   = stake × 0.02
     - remaining         = stake - resolver_reward
     - score_normalized  = score / 1e6 (fixed point)
     - return_rate       = 0.5 + 0.5 × score_normalized (fixed point, clamped [0, 1e6] before mult)
     - returned_to_agent = remaining × return_rate
     - slashed_to_pool   = remaining - returned_to_agent
     - INVARIANT: resolver_reward + returned_to_agent + slashed_to_pool == stake. Add an assert.
  8. BonusDistributor.notifySlash(categoryId, slashed_to_pool)
  9. BonusDistributor.recordContribution(categoryId, agentId, max(0, score_norm)² × stake)
  10. PredictionMarket.settleStake(predictionId, returned_to_agent, 0 /* bonus unused, paid via pull */, resolver_reward, resolverCaller)
  11. Emit PredictionScored event with all components for indexer

All fixed-point math: use 1e18 as base where needed for precision; final scores at 1e6 scale per spec.

Part D — Python reference for calibration:
- contracts/test/reference/calibration_reference.py
- Implements §7.4.2 formula exactly
- 10 test cases: cold start (0 resolutions), 1 resolution, 10 resolutions (transition), 100 resolutions, perfectly calibrated agent, miscalibrated overconfident, miscalibrated underconfident
- Print expected outputs for Solidity test

Tests in contracts/test/RangeCrpsScorer.t.sol:
- 10 CRPS cases vs Python reference, ≤0.1% relative error
- Boundary: prediction fully outside domain → bounded negative, no underflow
- Boundary: outcome at domain edge

Tests in contracts/test/Calibration.t.sol:
- 10 calibration cases vs Python reference
- Cold start returns 0
- After 10 resolutions, calibration becomes non-zero

Tests in contracts/test/ScoringEngine.t.sol (integration):
- Mocked AgentRegistry + PredictionMarket
- Apply score with known prediction + outcome → all storage updates correct
- Stake settlement amounts match formula exactly

Run all forge tests. If any Python case differs by >0.1%, DEBUG THIS BEFORE MOVING ON.
```

**Verify (this is the critical step):**
- 10 CRPS cases pass within tolerance
- 10 calibration cases pass within tolerance
- Stake settlement math: hand-check at least 3 cases (perfect score, neutral score, worst score)
- Accuracy EMA actually decays (not stuck)
- Bucket arrays update correctly

If anything's off here, the leaderboard is wrong and the demo collapses. **Do not proceed until this is solid.**

---

## Prompt 6 — BonusDistributor + CompositeFeed (rank-based) + AaveMantleTvlResolver

```
Three contracts. Per §7.2.4 (BonusDistributor) and §7.5 (CompositeFeed) and §7.3.2 (AaveMantleTvlResolver).

Part A — BonusDistributor.sol (PULL-CLAIM pattern, no iteration):
- Tracks per-category, per-epoch (1000 blocks, ~33 min on Mantle 2s blocks) bonus pool, total share, and per-agent shares
- Storage:
  - mapping(bytes32 => mapping(uint256 => uint256)) pool                  // categoryId => epoch => total pool
  - mapping(bytes32 => mapping(uint256 => uint256)) totalShare            // categoryId => epoch => sum of weights
  - mapping(bytes32 => mapping(uint256 => mapping(uint256 => uint256))) agentShare  // categoryId => epoch => agentId => weight
  - mapping(bytes32 => mapping(uint256 => bool)) finalized                // categoryId => epoch => finalized?
  - mapping(bytes32 => mapping(uint256 => uint256)) finalPool             // categoryId => epoch => pool after rollover + finalizer reward
  - mapping(bytes32 => mapping(uint256 => mapping(uint256 => bool))) claimed
  - uint256 constant EPOCH_BLOCKS = 1000
  - uint256 constant ROLLOVER_BPS = 500  // 5%
  - uint256 constant FINALIZER_BPS = 50  // 0.5%

- Functions:
  - notifySlash(bytes32 categoryId, uint256 amount) external onlyAuthorized
    - currentEpoch = block.number / EPOCH_BLOCKS
    - pool[categoryId][currentEpoch] += amount
  - recordContribution(bytes32 categoryId, uint256 agentId, uint256 weight) external onlyScoringEngine
    - currentEpoch = block.number / EPOCH_BLOCKS
    - agentShare[categoryId][currentEpoch][agentId] += weight
    - totalShare[categoryId][currentEpoch] += weight
  - finalizeEpoch(bytes32 categoryId, uint256 epoch) external
    - require !finalized[categoryId][epoch]
    - require block.number >= (epoch + 1) × EPOCH_BLOCKS
    - rawPool = pool[categoryId][epoch]
    - rollover = rawPool × ROLLOVER_BPS / 10000
    - finalizerReward = rawPool × FINALIZER_BPS / 10000
    - finalPool[categoryId][epoch] = rawPool - rollover - finalizerReward
    - pool[categoryId][epoch + 1] += rollover
    - finalized[categoryId][epoch] = true
    - transfer(msg.sender, finalizerReward)
    - emit EpochFinalized(...)
  - claimBonus(bytes32 categoryId, uint256 epoch, uint256 agentId) external
    - require finalized[categoryId][epoch]
    - require !claimed[categoryId][epoch][agentId]
    - require msg.sender == AgentRegistry.controllerOf(agentId)
    - share = agentShare[categoryId][epoch][agentId]
    - total = totalShare[categoryId][epoch]
    - if total == 0 || share == 0: revert "no share"
    - amount = finalPool[categoryId][epoch] × share / total
    - claimed[categoryId][epoch][agentId] = true
    - transfer(controller, amount)
    - emit BonusClaimed(...)
- Authorized contracts: PredictionMarket (slash on cancel/forfeit), ScoringEngine (slash on resolution).
- NO iteration anywhere. NO push distribution. Agents claim themselves.

Part B — CompositeFeed.sol per §7.5:
- Storage per §7.5
- REFRESH_RATE_LIMIT_BLOCKS = 100
- read(categoryId): returns CompositeForecast. Routes through SubscriptionGate (open in v1)
- refresh(categoryId) per §7.5.1:
  1. Revert if block.number - lastUpdatedBlock < 100
  2. topIds = AgentRegistry.getTopAgents(categoryId) — already sorted, gated by resolvedCount >= 10. This was built in Prompt 2; do NOT re-implement here.
  3. For each agent in topIds (skip zero slots): query PredictionMarket for their most recent Revealed (not Resolved) prediction in this category. Skip if none.
  4. Re-rank contributors 1..N (after skips). Weight for rank r: (N + 1 - r) / (N × (N+1) / 2). Weights sum to 1.
     - For the §7.5.1 spec values: if all 20 contribute, weight(r=1) = 20/210, weight(r=20) = 1/210. If only 12 contribute, weight(r=1) = 12/78.
  5. Ensemble value = Σ (weight × decoded_point_estimate)
  6. Confidence — OUTLIER-RESISTANT:
     - weightedStated = Σ (weight × agent.stated_confidence)
     - For each contributor: clipped_cal = max(agent.calibrationScore / 1e6, -0.5)  // ∈ [-0.5, 0]
     - multiplier = 1 + mean(clipped_cal across contributors)                       // ∈ [0.5, 1.0]
     - final_confidence = clamp(weightedStated × multiplier, 0, 10000)
  7. Write to storage, emit CompositeFeedRefreshed(categoryId, value, confidence, contributorCount, block.number)

NOTE: topAgents sorted list was built into AgentRegistry in Prompt 2. This prompt only reads it.

Part C — AaveMantleTvlResolver.sol per §7.3.2:
- Implements ICategoryResolver
- Iterates Aave-on-Mantle reserves (use placeholder ADDRESS constants for AAVE_POOL, AAVE_ORACLE)
- For each reserve: aToken.totalSupply() × oracle.getPrice(underlying)
- Sums to USD TVL with 8 decimals
- Returns abi.encode(uint256 tvlUsd8Decimals)
- Same archive-block-read consideration as MethAprResolver — create MockAaveTvlOracle if needed for hackathon. Document in comments.

Tests in contracts/test/BonusDistributor.t.sol:
- notifySlash and recordContribution from authorized callers → state set
- finalizeEpoch before epoch end → revert
- finalizeEpoch after epoch end → finalPool computed, rollover sent to next epoch, finalizer paid 0.5%
- finalizeEpoch twice for same (categoryId, epoch) → revert
- claimBonus before finalize → revert
- claimBonus from non-controller → revert
- claimBonus correct amount: amount = finalPool × agentShare / totalShare, within 1 wei rounding
- claimBonus twice for same agent → revert
- Conservation: Σ all claimable amounts ≤ finalPool (no overdistribution); rounding dust stays in contract

Tests in contracts/test/CompositeFeed.t.sol:
- 5 mock agents with varied accuracy → ensemble matches hand-computed weighted average
- Rate limit: second refresh within 100 blocks reverts
- Confidence multiplier: well-calibrated agents → high confidence; poorly-calibrated → low

Tests in contracts/test/AaveMantleTvlResolver.t.sol:
- Mock 3 reserves with known supplies and prices → USD TVL matches hand calculation

Run forge test.
```

**Verify:**
- Ensemble value math correct (compute by hand for at least one case)
- Rate limit works
- Top-20 sorted list updates correctly on reputation changes (this is the trickiest piece — write extra tests if needed)
- BonusDistributor distribution sums to ≤ pool (no overdistribution)

---

## Prompt 7 — Deployment + end-to-end smoke test

```
Deploy everything to Mantle Sepolia and run a smoke test.

Part A — contracts/script/Deploy.s.sol:
Deploy in order, wiring up cross-references:
1. AgentRegistry (set treasury to deployer)
2. PredictionMarket
3. BonusDistributor
4. ScoringEngine (set AgentRegistry, PredictionMarket, BonusDistributor addresses)
5. RangeCrpsScorer
6. ResolutionEngine (set ScoringEngine)
7. MockMethRateOracle (and MockAaveTvlOracle if used)
8. MethAprResolver (with MockMethRateOracle address)
9. AaveMantleTvlResolver (with MockAaveTvlOracle address)
10. CompositeFeed (set AgentRegistry, PredictionMarket addresses)
11. SubscriptionGate
12. DemoFeedConsumer (set CompositeFeed)

Wire up:
- AgentRegistry.setScoringEngine(ScoringEngine)
- PredictionMarket.setScoringEngine(ScoringEngine)
- PredictionMarket.setBonusDistributor(BonusDistributor)
- BonusDistributor.setAuthorized(PredictionMarket, true), setAuthorized(ScoringEngine, true)
- ScoringEngine.setBonusDistributor(BonusDistributor)
- ScoringEngine.setResolutionEngine(ResolutionEngine)  // onlyResolutionEngine modifier source
- ScoringEngine.setAgentRegistry(AgentRegistry)
- ScoringEngine.setPredictionMarket(PredictionMarket)
- ResolutionEngine.setPredictionMarket(PredictionMarket)
- ResolutionEngine.setScoringEngine(ScoringEngine)
- ResolutionEngine.registerCategory(METH_APR_24H, MethAprResolver, RangeCrpsScorer, configBytes)  // sets resolver + scorer + config atomically
- ResolutionEngine.registerCategory(AAVE_MANTLE_TVL_24H, AaveMantleTvlResolver, RangeCrpsScorer, configBytes)
- PredictionMarket.setCategoryConfig(METH_APR_24H, minStake=0.1 ether, windowStart=300, windowEnd=500000)
- PredictionMarket.setCategoryConfig(AAVE_MANTLE_TVL_24H, minStake=0.1 ether, windowStart=300, windowEnd=500000)
- CompositeFeed.setAgentRegistry(AgentRegistry), setPredictionMarket(PredictionMarket), setSubscriptionGate(SubscriptionGate)

Output addresses to deployments/mantle-sepolia.json.

Part B — Configuration:
- contracts/config/mantle-sepolia.toml with placeholder real-protocol addresses (mETH, Aave Pool, oracles)
- .env.example with PRIVATE_KEY, MANTLE_SEPOLIA_RPC

Part C — Deploy and verify:
- Run deploy script
- Verify all 12 contracts on Mantle Sepolia explorer
- Update deployments/mantle-sepolia.json with verification URLs

Part D — Smoke test script script/SmokeTest.s.sol:
1. Register a test agent (pay 0.1 MNT)
2. Seed MockMethRateOracle with rates at block N-43200 and N
3. Submit a commit with resolutionBlock = currentBlock + 350
   NOTE on timing math: reveal window is [commitBlock+10, commitBlock+100] AND [, resolutionBlock-200].
   With resolutionBlock = commit+350, second bound is commit+150, so effective reveal window is [commit+10, commit+100]. Safe.
4. Advance to commitBlock + 15
5. Submit reveal
6. Advance to resolutionBlock
7. Call ResolutionEngine.resolve(predictionId)
8. Check: prediction status == Resolved, agent reputation updated, stake settled per §7.2.4:
   - msg.sender (resolver) received stake × 0.02
   - agent.controller received remaining × return_rate
   - BonusDistributor pool[METH_APR_24H][currentEpoch] increased by slashed_to_pool
   - Conservation: total transferred from PredictionMarket == stake (within rounding)
9. Print all state changes

Run the smoke test. If anything fails, fix before moving to Prompt 8.
```

**Verify:**
- All 12 contracts deployed and verified
- Smoke test runs end-to-end with no reverts
- Agent's reputation actually moved after resolution
- Resolver caller received 2% reward

**Do not proceed to Prompt 8 until this round-trip works perfectly.**

---

## Prompt 8 — Ponder indexer

```
Build the Ponder indexer per §10 of README.md.

Specifics:
- indexer/ponder.config.ts: Mantle Sepolia network, contract addresses from deployments/mantle-sepolia.json
- Schema (Ponder tables):
  - agents: id, controller, metadataURI, registeredAt, totalPredictions, totalResolved
  - reputations: agentId, categoryId, accuracyScore, calibrationScore, resolvedCount, lastUpdatedBlock
  - predictions: id, agentId, categoryId, commitHash, value (nullable), confidence (nullable), contentHash, stake, commitBlock, resolutionBlock, status, score (nullable)
  - feedSnapshots: categoryId, value, confidence, contributingAgents, snapshotBlock
  - bonusDistributions: categoryId, epochNumber, totalPool, agentBonuses (JSON)
- Event handlers for all events from PRD §10
- REST endpoints per §10:
  - GET /leaderboard?category=...&limit=...
  - GET /agent/:id
  - GET /agent/:id/predictions?offset=&limit=
  - GET /category/:id
  - GET /feed/:category/history

Deploy:
- Host on Railway (cheap, reliable)
- Set environment variables, get it running
- Public URL

Test:
- curl /leaderboard?category=METH_APR_24H&limit=10 → returns data (may be empty initially)
- After running smoke test, /agent/1 should return the test agent
- Latency under 500ms for leaderboard queries

Report the deployed indexer URL.
```

**Verify:**
- Indexer syncs from deployed contracts (no errors in logs)
- All endpoints return well-formed JSON
- Status updates from Committed → Revealed → Resolved are reflected within 1-2 blocks

---

## Prompt 9 — Agent SDK + ARIMA agent

```
Build agent SDK and ARIMA baseline per §8.1 and §8.2.

Part A — agents/sdk/:
- Export Agent base class with:
  - constructor(agentId, controllerPrivateKey, rpcUrl, contractAddresses)
  - commit(categoryId, value, confidence, resolutionBlock, contentHash): handles abi encoding, nonce generation, contract call
  - reveal(predictionId): handles automatic timing (wait REVEAL_DELAY_BLOCKS, reveal before window closes)
  - submitFullCycle(categoryId, value, confidence, resolutionBlock, contentHash): commit + scheduled reveal
- Internal: viem client, automatic gas estimation, retry on transient failure (max 3 attempts), nonce caching for batch submissions
- Export TypeScript types matching category schemas
- Export getCategoryConfig() helper

Part B — agents/arima-baseline/:
- TypeScript Node app
- On schedule (every 6 hours), for each category:
  1. Fetch historical data:
     - For METH_APR_24H: pull last 30 days of APR observations from indexer (resolved predictions in this category)
     - For AAVE_MANTLE_TVL_24H: same pattern
     - If <10 historical points, use synthetic data for first run (clearly logged)
  2. Fit ARIMA(1,1,1) using `arima` npm package or call out to a Python sidecar via child_process if needed
  3. Predict mean + 95% CI for resolution block ~24h ahead
  4. ABI-encode the range as bytes (lower bucket, upper bucket per category schema)
  5. Confidence: fixed at 5000 bps
  6. contentHash: hash of the input data + model spec (for transparency); upload to IPFS, get hash
  7. Call sdk.submitFullCycle()

Part C — SEED_MODE per §8.2:
- Initial state stored in agent.state.json: { mode: "seed", seedStartTimestamp: <unix> }
- In seed mode:
  - resolutionBlock = currentBlock + 350 (~12 min on Mantle 2s blocks; safely > 200+100 cutoff)
  - post every 30 minutes per category
- Auto-flip check on every schedule tick (before deciding to commit):
  - GET <indexer_url>/agent/<agentId>/predictions?status=Resolved → count
  - If count >= 50 OR (now - seedStartTimestamp) > 48 * 3600:
    - flip to mode: "normal" in agent.state.json
- In normal mode:
  - resolutionBlock = currentBlock + 43200 (~24h)
  - post every 6 hours per category

Part D — Registration:
- agents/arima-baseline/scripts/register.ts:
  - Build metadata JSON per §8.1.1
  - Upload to IPFS via web3.storage
  - Call AgentRegistry.register(uri) with 0.1 MNT
  - Save agentId to local .env

Deploy as GitHub Actions cron OR Railway-hosted service. Run register.ts once locally, then deploy the schedule.
```

**Verify:**
- ARIMA agent registers cleanly (agentId saved)
- First commit + reveal cycle completes successfully
- Indexer shows the agent with at least 1 prediction
- SEED_MODE produces predictions every 30 min with short resolution windows

---

## Prompt 10 — DeepSeek reasoner agent (THE DEMO HIGHLIGHT)

```
Build the DeepSeek reasoner per §8.3 of docs/PRD.md. This is the project's demo highlight. Invest in quality.

Part A — agents/deepseek-reasoner/:
- TypeScript Node app
- Calls OpenRouter (OpenAI-compatible Chat Completions) via fetch — no LLM SDK dependency
- On schedule, for each category:
  1. Build context:
     - Fetch last 7 days of category outcomes from indexer
     - Fetch last 24h of crypto news from cryptopanic.com free API (filter to relevant tokens)
     - Format as a structured Markdown context block
  2. Build prompt (use deepseek/deepseek-chat-v3.1 via OpenRouter):
     - System: "You are a forecasting agent for Mantle ecosystem metrics. Your reputation depends on calibrated forecasts. Overconfidence will harm your calibration score; underconfidence will harm your accuracy ranking. Produce honest, well-reasoned predictions."
     - User: includes the context + category spec + resolution rules + few-shot examples (2-3 well-reasoned past predictions)
     - Request structured JSON: { predicted_value: { lower: number, upper: number }, confidence: number 0-10000, reasoning: string }
  3. Parse response, validate JSON shape
  4. Upload full prompt + response + parsed forecast to IPFS via web3.storage; this is the contentHash
  5. ABI-encode the range as bytes per category schema
  6. Call sdk.submitFullCycle()
  7. Log everything locally + structured logs to a file for debugging

Part B — Prompt design quality:
- Few-shot examples live in agents/deepseek-reasoner/fewshot/*.json — HAND-WRITE these on Day 9 BEFORE deploying. Cold-start outputs without good examples are bland. 2-3 examples each show: observed data → hypothesis → forecast range → confidence with justification. These get concatenated into the user prompt.
- System prompt explicitly tells the model that the calibration score will be visible publicly — incentivizes honest confidence
- Include a clear note about resolution rules so the model knows exactly what's being predicted

Part C — Same SEED_MODE behavior as ARIMA agent for first 24h (see Prompt 9 Part C — indexer poll on resolvedCount).

Part D — Registration script with rich metadata:
- name: "DeepSeek Reasoner"
- description includes a paragraph about the agent's methodology
- model: "deepseek/deepseek-chat-v3.1"
- homepage: link to the agent's source

Deploy. Run register, then start the schedule.

Quality check after first run:
- Read 3 reasoning traces. Are they coherent?
- Are confidences varying across predictions, or stuck at one value?
- Does the IPFS-stored reasoning render readably?
```

**Verify:**
- Reasoning traces are well-written (judge them as a critical human reader)
- Confidence varies (not stuck at 5000 or 10000)
- IPFS hash is retrievable
- This becomes the visual highlight on the frontend — make sure the data is good

---

## Prompt 11 — Frontend (3 must-have pages)

```
Build the 3 must-have frontend pages per §9.2 of README.md.

Part A — / (leaderboard):
- Composite feed snapshot card at top per active category (current ensemble value, confidence band, agent count, freshness)
- Tabs for per-category leaderboards + a global tab
- Sortable table: rank, agent name, accuracy score, calibration score, resolved count
- For "calibrating" agents (resolvedCount < 10): show badge instead of calibration number
- "How it works" collapsible panel
- Data via indexer REST API; TanStack Query 30-second refresh
- Loading state: skeleton table
- Empty state: "No agents yet — be the first to register"

Part B — /agent/[id]:
- Identity card: agentId, NFT visual (styled card), controller address (truncated, link to explorer), metadataURI link
- Reputation radar chart (Recharts): accuracy + calibration per category
- Prediction history table (paginated 20/page):
  - Columns: id, category, status, value (if revealed), confidence, score (if resolved), resolutionBlock, link to explorer
  - For the DeepSeek reasoner: rows are expandable — clicking opens reasoning trace from IPFS in a panel
- Equity curve (line chart): cumulative score over time, optionally per category
- "Stake on this agent" button, disabled with tooltip "Coming in v2"

Part C — /demo-consumer:
- Embedded iframe-style panel showing DemoFeedConsumer's last read of each composite feed
- Live refresh every 30 seconds
- Explanatory text: "This is an example contract reading the Predictor Index composite feed. Protocols can read this feed to make treasury, risk, and parameter decisions based on the ensemble of AI agent forecasts."
- Link to the consumer contract on explorer
- Manual "Refresh feed now" button per category, wired via wagmi to CompositeFeed.refresh(categoryId) — fallback if cron is down during demo

Part D — Refresher cron worker (agents/refresher/):
- Standalone TypeScript Node app, ALSO deploy this to Railway/Vercel cron
- On schedule (every 5 minutes ≈ 150 blocks): for each active category, call CompositeFeed.refresh(categoryId)
- Funded with a small hot wallet (refresher key, not same as agent keys)
- Idempotent: rate limit at 100 blocks means second call within window just reverts and is caught
- Spec'd in PRD §7.5.3

Design — hybrid per README §9.3:

Terminal core (leaderboard table, agent detail tables, demo consumer panel):
- Data-dense, monospace numbers (tabular figures), sparse color
- Single accent: Mantle teal (#33EAB3 or similar)
- Dark background, near-monochrome
- Recharts theming to match (low-contrast gridlines, mono labels)
- Motion: subtle — value flips, sparkline draws, row enter on data update only. No bouncy.

Cinematic landing (hero section above leaderboard on /):
- Awwwards-tier: oversized kinetic type for "Predictor Index", scroll-driven composite-feed pulse, DeepSeek reasoning-trace reveal as demo hook
- Motion-driven: hero entrance, stagger reveals, shared-element transition to leaderboard below
- Same teal accent only; respects prefers-reduced-motion (cinematic → static fallback)

Cross-cutting:
- Single font pair: Inter (UI) + JetBrains Mono (numbers/addresses/hashes) via next/font
- Use Radix primitives directly (no shadcn CLI) — Dialog, Dropdown, Tabs, Tooltip, Popover
- A11y: focus rings, 4.5:1 contrast, keyboard nav for all interactive elements
- Test at 375px width — if anything breaks, fix it now

Deploy to Vercel.
- Env vars: NEXT_PUBLIC_INDEXER_URL, NEXT_PUBLIC_RPC_URL, contract addresses
- Report public URL

Final check: walk through each page on desktop AND 375px. Note any visual bugs in a TODO list.
```

**Verify:**
- All 3 pages load with no console errors
- Leaderboard sorts correctly
- Agent detail expandable reasoning works (this is the demo moment — verify it visually)
- Demo consumer page shows live data
- Mobile (375px) doesn't break

---

## Prompt 12 — DemoFeedConsumer + end-to-end integration test

```
Two things: deploy the demo consumer contract, then run a complete end-to-end test.

Part A — contracts/src/examples/DemoFeedConsumer.sol:
- Reads CompositeFeed for METH_APR_24H and AAVE_MANTLE_TVL_24H
- Has a simple business logic: e.g., "If METH APR > 400 bps, set ALLOW_DEPOSITS = true"
- View functions:
  - getCurrentMethApr() returns (uint256, uint16) — value, confidence
  - getCurrentAaveTvl() returns (uint256, uint16)
  - shouldAllowDeposits() returns (bool)
  - shouldThrottleRisk() returns (bool) — e.g., true if Aave-Mantle TVL forecast < $500M
- Documented as an example pattern protocols would use

Deploy to Mantle Sepolia. Update frontend to read from this contract.

Part B — End-to-end integration test:
Run the full pipeline in 1 hour:
1. Both agents run (force one cycle of each manually)
2. Predictions commit, then reveal
3. Some predictions resolve via short windows
4. ScoringEngine processes resolutions, updates reputations
5. CompositeFeed.refresh() called manually or via cron
6. DemoFeedConsumer reads the feed
7. Frontend reflects all of this

Verify the entire flow visually on the deployed frontend. Take screenshots of:
- Leaderboard with at least 2 agents and at least 5 resolved predictions
- Agent detail page with a DeepSeek reasoning trace visible
- Demo consumer reading the feed and showing a true/false decision

If anything's broken in the pipeline, fix it now — Day 13 polish is too late.
```

**Verify (this is the final pre-polish gate):**
- 50+ resolved predictions accumulated (run agents in SEED_MODE for ~24h)
- Frontend shows everything correctly
- Demo consumer reads non-stale data

---

## Prompt 13 — Polish, demo video, submission prep

```
Final hackathon prep. No new features. Polish only.

Part A — Frontend polish pass:
- Every page on desktop AND 375px mobile
- Loading states: skeletons not spinners
- Empty states for every data-fetching component
- Error states (e.g., indexer down → "Showing cached data" banner + serve from static JSON fallback)
- Cinematic landing animation on / hero (Motion — hero kinetic-type entrance, scroll-driven composite-feed pulse, DeepSeek reasoning-trace reveal). Terminal-core surfaces below remain subtle (value flips, sparkline draws only). Respect prefers-reduced-motion.
- Typography consistency, spacing audit
- Make the DeepSeek reasoning display the visual peak of the agent detail page (large readable text, code-block-style for the JSON, clear "reasoning →" header)

Part B — Generate static fallback for indexer:
- Pre-fetch the leaderboard JSON, save to public/fallback-leaderboard.json
- Frontend uses this if indexer is unreachable
- Reduces demo risk

Part C — Optional /category/[id], /submit, /about pages — if time permits, ship them. Otherwise skip.

Part D — Root README.md (separate from PRD; this is the GitHub README):
- Project overview (2-3 paragraphs)
- Mermaid architecture diagram (use the ASCII art from PRD §6 as basis)
- Quick start: how to run indexer, frontend, agents locally
- Deployed addresses table with explorer links
- Live URLs (frontend, indexer API)
- Demo video link (placeholder until recorded)
- Submission tracks rationale (1 paragraph)
- Team info

Part E — Demo video script:
docs/DEMO_SCRIPT.md per §11.1 of PRD:
- 0:00–0:30 problem
- 0:30–1:30 walkthrough
- 1:30–2:00 pitch
- Include shot list, what's on screen at each beat, key phrases to say

Part F — DoraHacks submission:
docs/SUBMISSION.md:
- One-liner (use the PRD's)
- Project description (3-4 paragraphs covering: problem, solution, ERC-8004 integration, Mantle ecosystem composition, revenue model)
- Track justification
- What was built (concrete list)
- What's next (post-hackathon roadmap from PRD §15)

Part G — Pre-flight checklist — go through every item in §2 of PRD and §17. Report which are ✓ and which are blockers.
```

**Verify (the absolute final checklist):**
- [ ] All contracts deployed and verified
- [ ] 2+ agents running
- [ ] 2 categories active
- [ ] 50+ resolved predictions on leaderboard
- [ ] Composite feed updating
- [ ] Demo consumer reading feed
- [ ] Frontend on public URL, no console errors, mobile works
- [ ] Indexer on public URL, <500ms latency
- [ ] Demo video recorded
- [ ] GitHub repo public, README complete
- [ ] DoraHacks submission drafted

---

## Prompt 14 — Submission + mainnet stretch

```
Final steps before submitting.

Part A — Mainnet stretch (only if Day 13 went smoothly):
- Deploy entire contract suite to Mantle mainnet
- Update frontend env vars to point to mainnet
- Run smoke test on mainnet
- Register both reference agents on mainnet (fresh agentIds)
- Update README with mainnet addresses

If anything feels risky, STAY ON SEPOLIA. Sepolia deploy is fully acceptable for the hackathon.

Part B — Record demo video:
- Use OBS or Loom
- Follow docs/DEMO_SCRIPT.md
- Aim for exactly 2:00, hard cap 2:30
- Upload to YouTube unlisted, or to Loom with public link
- Add link to README

Part C — Submit on DoraHacks:
- Project description from docs/SUBMISSION.md
- GitHub repo URL
- Live frontend URL
- Demo video URL
- Deployed addresses
- Track: AI Alpha & Data
- Nominate for Grand Champion

Part D — Twitter/X teaser (for Community Voting bonus prize):
- Compose 1 thread (4-6 tweets):
  - Tweet 1: hook + problem
  - Tweet 2: solution (with screenshot of agent reasoning trace — the most viral visual)
  - Tweet 3: how it works (with leaderboard screenshot)
  - Tweet 4: live URL + CTA
  - Optional Tweet 5: thank you to Mantle/Bybit/Byreal
- Tag @Mantle_Official, @Bybit_Official, @byreal_io, @DoraHacks
- Post within submission window

Report submission status and confirmation links.
```

---

## Troubleshooting prompts

### "CRPS or calibration math diverges from Python reference"

```
The Solidity [RangeCrpsScorer / Calibration update] differs from Python reference on case [N] by [X]%.

Debug systematically:
1. Print intermediate values in both implementations for the failing case
2. Identify first divergence point
3. Likely culprits in order:
   - Fixed-point rounding (Solidity uses integer division; Python uses float)
   - Off-by-one in bucket indexing
   - Sign handling on negative scores
   - EMA initialization (first vs subsequent updates)
4. Fix in Solidity (Python is reference of truth)
5. Re-run all 10 cases
```

### "Indexer lagging behind chain"

```
Indexer REST API is >5 min behind chain state. Investigate:
1. Check Ponder logs for errors
2. Check RPC endpoint isn't rate-limiting (try a different provider: Ankr, BlockPI, Mantle's official)
3. Check if any event handler throws silently
4. Confirm host has sufficient resources
Fix root cause.
```

### "Agent fails to submit predictions"

```
Agent [name] fails on [commit | reveal] with [error]:
1. Check agent logs for exact error
2. Common causes:
   - Insufficient native MNT for gas + stake
   - Wrong category ID encoding
   - resolutionBlock outside allowed window
   - Reveal timing: too early (before REVEAL_DELAY) or too late (after REVEAL_WINDOW)
   - Nonce mismatch in reveal
3. Reproduce locally
4. Fix
```

### "Frontend slow"

```
Leaderboard >3s load:
1. Lighthouse audit
2. curl indexer endpoint directly — measure latency
3. If indexer fast: frontend rendering issue (large client-side data, missing memoization, unoptimized images)
4. If indexer slow: add caching (Redis or SWR with longer stale times)
Apply fixes, re-measure.
```

### "Top-20 sorted list in AgentRegistry is wrong"

```
The top-20 agents per category in AgentRegistry is producing wrong rankings.
This is the trickiest piece of code in the system.

Debug:
1. Print the topAgents array after each updateReputation
2. Verify insertion-sort logic: where does the new agent slot in?
3. Edge cases:
   - Agent already in top-20, accuracy changes
   - Agent not in top-20, new accuracy exceeds current min
   - Tie-breaking (use agentId as tiebreaker for determinism)
4. Write 5 more targeted unit tests
```

---

## Meta-instruction for every prompt

Prepend to each prompt during execution:

```
Before writing any code, re-read the relevant section(s) of README.md (the PRD) and confirm out loud you understand the spec. Then implement. Then run tests. Don't skip the test step. If tests fail, debug before declaring done.
```

This prevents Claude Code's most common failure: implementing from imagination instead of from spec.

---

**End of prompt series v2.**