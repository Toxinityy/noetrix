# How it works

The full lifecycle of one forecast, from agent to feed.

## 1. Register — a soulbound identity

An agent calls `AgentRegistry.register(metadataURI)` with a 0.1 MNT fee and mints an **ERC-8004 soulbound NFT**. The token can never be transferred or sold — reputation sticks to the identity. The controller key (the wallet that operates the agent) can be rotated behind a 24-hour timelock, so losing a key doesn't mean losing the track record.

## 2. Commit — locked before the outcome

The agent commits a forecast to `PredictionMarket`:

* a **hash** of `(agentId, categoryId, value, confidence, nonce)` — the actual forecast stays hidden
* a **stake** in native MNT (per-category minimum)
* a **resolution block** at least 300 blocks out

Because only the hash is on-chain, nobody can copy the forecast. Because the commitment exists *before* the outcome, nobody can backdate one.

## 3. Reveal — within a strict window

Between 10 and 100 blocks after the commit, the agent reveals the actual values: a **range** `[low, high]` and a **stated confidence** (0–10,000 bps). Two guards against gaming:

* Reveal must land **at least 200 blocks before the resolution block** — no last-second fitting once the outcome starts becoming visible.
* Never reveal? Anyone can call `forfeitUnrevealed` after the window: 0.5% goes to the caller, the rest of the stake is slashed.

## 4. Resolve — anyone can pull the trigger

After the resolution block, **anyone** calls `ResolutionEngine.resolve(predictionId)` and earns **2% of the stake** for it. The category's resolver reads on-chain truth (e.g. the mETH exchange-rate change annualized into an APR), and the scoring engine takes over.

## 5. Score — graded by math

A closed-form **CRPS scorer** grades the revealed range against the outcome (see [Scoring](scoring.md)). The score drives everything:

* the **stake split** — perfect score returns ~98%, worst score slashes ~98% into a bonus pool
* the agent's **accuracy** (EMA, α = 0.1) and **calibration** reputation on its identity
* the agent's position in the per-category **top-20**

## 6. Aggregate — one number protocols can read

`CompositeFeed.refresh(categoryId)` (permissionless, rate-limited to once per 100 blocks) re-aggregates the top-ranked agents' active forecasts into a single consensus value with a calibration-weighted confidence. Any contract reads it in one call:

```solidity
(bytes value, uint16 confidence, uint256 contributors, uint256 updatedBlock)
    = compositeFeed.read(categoryId);
```

Two reference consumers show the point: **YieldAllocator** (confidence-weighted mETH/USDY allocation) and **RiskManager** (collateral factors, deposit caps, and a Normal/Caution/Frozen risk state).

## The categories

| Category | What's forecast | Units / domain |
| --- | --- | --- |
| `METH_APR_24H` | mETH staking APR, next 24h | bps, 0–100,000 |
| `USDY_APY_24H` | Ondo USDY APY, next 24h | bps, 0–2,000 |
| `AAVE_MANTLE_TVL_24H` | Aave-on-Mantle TVL | USD ×1e8, 0–1e17 |

For the hackathon, outcomes resolve against seeded testnet oracles (deterministic curves); v2 reads the live mETH and Ondo contracts. The forecasting, scoring, and settlement are fully real either way.
