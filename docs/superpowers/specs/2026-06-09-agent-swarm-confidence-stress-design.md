# Design — Diverse Agent Swarm, Real-Data Backtest, On-Chain Swarm Confidence & Market-Stress Warning

> **Status:** approved design (brainstorming complete) — 2026-06-09
> **Branch:** `worktree-agent-swarm-onchain`
> **Scope:** Predictor Index (Mantle). Refine the forecasting agents into a genuinely diverse 7-agent swarm, feed them **real market data** (DefiLlama + Fear&Greed), **backtest** the models + swarm on that data, and add an **on-chain swarm-agreement-based confidence** plus a **market-stress warning**. Per-agent *model* refinement is deferred to Phase 2.
> **Grounding:** verified by a 12-agent grounding+adversarial workflow (run `wf_0dac8ab7-f2e`). Exact contract signatures, constants, and the DefiLlama endpoints below were confirmed against the codebase / by fetching. Four spec-changing fixes from the adversarial review are folded in (quorum, per-category scale, MIN-combine, honest stress reframe).

---

## 0. Goals & non-goals

**Goals**
1. **Real data** — one unified source (DefiLlama) for mETH APR, Aave-Mantle TVL, USDY APY; plus the Crypto **Fear & Greed** index. Feeds the backtest, seeds the on-chain oracles, and feeds live agents.
2. **Diverse swarm** — 7 reference agents spanning *opposite priors* and *different data*, so disagreement carries real signal.
3. **Backtest** — replay real history through the swarm with **bit-faithful** (integer) CRPS/calibration/swarm math, honest train/test methodology, and a diversity proof (inter-agent error correlation).
4. **On-chain swarm confidence** — `CompositeFeed` confidence becomes *honest by construction*: a split or low-quorum swarm reports low confidence.
5. **Market-stress warning** — a thin `MarketStressMonitor` emits `StressWarning` from three **independent** inputs: ensemble disagreement, forecast-surprise (model-independent), and Fear & Greed (external).
6. **Open protocol** — keep it permissionless; document the threat model and harden the new code against adversarial/user agents.

**Non-goals (this work)**
- Deeper per-agent model/prompt refinement (Phase 2).
- Enforcing the subscription gate (stays open in v1).
- Hosting the indexer/bots off-laptop (operational, Phase 2).
- A market-stress *oracle that predicts shocks* — we explicitly do **not** claim that (see §4 honesty).

---

## 1. Architecture

```
agents/market-data (NEW)
  DefiLlama yields (mETH apyBase), protocol/chain TVL (Aave-Mantle), yields (USDY), Fear&Greed (alternative.me)
  → normalize to on-chain units · derive mETH exchange-rate series · realized-vol metrics · disk cache (24h)
        │
        ├─► agents/backtest (NEW): expanding-window replay → BigInt CRPS/calibration → swarm aggregation
        │        → train/test split · diversity (error-correlation) · swarm-vs-single · stress-vs-vol · report + backtest-snapshot.json
        │
        ├─► contracts/script/SeedFromReal.s.sol (NEW): seed oracles with REAL day-grid values (+ Fear&Greed)
        │
        └─► live agents (P1b): real recent data instead of synthetic seed

agents/forecasters (NEW, shared lib — single source of truth)
  strategies: persistence · arima111 · meanReversion · momentum(Holt) · ewmaVol · sentimentTilt
  swarm math: rankWeights · dispersion(isqrt) · agreementMultiplier · combineConfidence(MIN)
  scoring port: BigInt CRPS + calibration (parity-tested vs forge vectors) · confidenceFromWidth
        │
        ├─► live runners: arima-baseline, naive-baseline (refactored to import lib), + new thin runners for the 4 new strategies
        └─► agents/backtest imports everything

CONTRACTS
  CompositeFeed.sol (EXTEND): dispersion+width → quorum-aware agreement mult → MIN(cal,agree) → honest confidence
        · per-category DISAGREE_SCALE (owner-set) · append disagreementBps to struct · robust skip + domain clamp + rank-weight cap
  MarketStressMonitor.sol (NEW, thin): reads feed(disagreement,confidence,n,freshness) + resolver(forecast-surprise, best-effort)
        + SentimentOracle(Fear&Greed) → stressLevel{Calm,Elevated,Stressed} + StressWarning event
  SentimentOracle.sol (NEW, mock): Fear&Greed 0–100 by block, keeper-set, seeded with real history
  RiskManager / YieldAllocator (UNCHANGED): consume the now-honest confidence for parameters

FRONTEND (light): /insights surfaces swarm-agreement % + stress + F&G; AlertPreview shows real StressWarning;
  /simulation slider → real swarm/stress logic; backtest-snapshot.json drives a new backtest view
```

**Module isolation.** Each new unit has one job and a clean interface: `market-data` (fetch+normalize+cache), `forecasters` (pure strategy + swarm + scoring math), `backtest` (replay+metrics), `MarketStressMonitor` (read+classify+emit), `SentimentOracle` (store F&G). The **swarm math and the CRPS/calibration port live exactly once** (in `forecasters`), mirrored bit-for-bit in Solidity and parity-tested.

---

## 2. The swarm math (canonical definition — integer fixed-point, one source of truth)

Defined once in `agents/forecasters/src/swarm.ts` (BigInt) and mirrored in `CompositeFeed.sol`. **All operations are scaled-integer; no float anywhere** (float `sqrt` would break parity — see §7).

Constants (reuse existing where they exist):
- `WEIGHT_SCALE = 1e18`, `CAL_SCALE = 1e6`, `MAX_CONFIDENCE_BPS = 10_000` (existing).
- `AGREE_FLOOR = 400_000` (0.4 in CAL_SCALE) — agreement multiplier never drops below 0.4.
- `MIN_SWARM = 3` (owner-settable) — quorum.
- `SINGLE_SOURCE_CEILING_BPS = 5_000` — confidence cap when `n < MIN_SWARM`.
- `DISAGREE_SCALE[categoryId]` — **per-category** absolute spread (metric units) mapping to full disagreement (d = 1.0). Owner-set; defaults recommended by the backtest (≈ 90th percentile of historical real disagreement per category). **Not** derived from the domain max (the 1e17 TVL domain is ~10× oversized vs real values, which would compress all TVL disagreement — adversarial finding #4).

Per contributing agent *i* (after the reputation gate **and** per-contributor validation in §6):
- band `[lo_i, hi_i]` **clamped to `[domainMin, domainMax]`**; midpoint `m_i = (lo_i + hi_i)/2`; width `w_i = hi_i − lo_i`.
- rank weight `wScaled_i = ((n − j) * WEIGHT_SCALE) / denom`, `denom = n(n+1)/2`, `j` = 0-indexed rank (existing formula, multiply-before-divide). **Extracted into one shared helper** used by both the ensemble value and the dispersion (so weights can't drift).

Computation:
1. **Ensemble value** (unchanged): `M = ensemble = Σ (wScaled_i * m_i) / WEIGHT_SCALE`.
2. **Midpoint dispersion**: `V = Σ wScaled_i * (m_i − M)² / WEIGHT_SCALE`; `D = isqrt(V)` (Babylonian floor integer sqrt; ported from OZ `Math.sqrt`). *(Overflow verified safe: worst case ~178 bits for the TVL domain.)*
3. **Mean band width**: `Wbar = Σ wScaled_i * w_i / WEIGHT_SCALE`.
4. **Raw disagreement** (defends width-blindness + wide-band gaming): `dRaw = D + Wbar/2`. *(Scatter of where agents point, plus how uncertain each is.)*
5. **Normalized disagreement**: `d = min(CAL_SCALE, dRaw * CAL_SCALE / DISAGREE_SCALE[c])` ∈ [0, CAL_SCALE].
6. **Agreement multiplier**: `g = max(AGREE_FLOOR, CAL_SCALE − d)` ∈ [AGREE_FLOOR, CAL_SCALE].
7. **Calibration multiplier** `calMult` ∈ [CAL_SCALE/2, CAL_SCALE] (existing derivation, unchanged).
8. **Combine penalties with MIN, not product** (adversarial #3 — multiplicative stacking double-penalizes *and* masks): `mult = min(calMult, g)`.
9. **Final confidence**: `finalConf = (weightedStated * mult) / (WEIGHT_SCALE * CAL_SCALE)`, then `clamp(0, MAX_CONFIDENCE_BPS)`.
10. **Quorum cap** (adversarial #1 — at `n=1` dispersion is 0 → a lone agent would otherwise report full "consensus"): if `n < MIN_SWARM`, `finalConf = min(finalConf, SINGLE_SOURCE_CEILING_BPS)`.
11. **Store** `disagreementBps = d * MAX_CONFIDENCE_BPS / CAL_SCALE` (append to struct, §5).

`n = 0` keeps the existing **hold-last-good** behavior (CompositeFeed.sol:99-110), unchanged.

**Why this is "improved confidence":** today the feed can report high confidence while ARIMA says 2500 and another agent says 5000. Now a scattered swarm (high `D`), an uncertain swarm (high `Wbar`), or a too-small swarm (`n < MIN_SWARM`) all reduce `finalConf` — honest by construction, not by an agent claiming it.

---

## 3. The diverse 7-agent swarm

Diversity must come from **opposite priors** and **different data**, or "disagreement" is just correlated noise (adversarial #2). Each strategy is a **pure function** in `agents/forecasters` returning `{mean, lower, upper, confidenceBps}`.

| # | Agent | Strategy (pure fn) | Diversity role |
|---|-------|--------------------|----------------|
| 1 | **Naive** *(exists → refactor to lib)* | persistence: `mean=last`, band = `max(8%·|last|, 1.96·σ_recent)` | control |
| 2 | **ARIMA** *(exists → refactor to lib)* | `arima111(series, h)` (d=1, CSS-estimated φ,θ; MA(∞) interval) | trend + autocorrelation |
| 3 | **DeepSeek reasoner** *(exists)* | LLM via OpenRouter, news-aware | different *class* (reasoning) |
| 4 | **Mean-reversion** *(new)* | AR(1) toward a long-run moving mean: `mean = last + κ(SMA_k − last)` | bets shocks **revert** — opposite to persistence |
| 5 | **Momentum / trend** *(new)* | Holt linear trend (or OLS slope over last k) extrapolated h steps | bets trends **continue** — opposite to mean-reversion |
| 6 | **EWMA-volatility** *(new)* | `mean = EWMA(level)`, band sized by `EWMA(|Δ|)` (`λ≈0.94`) | specializes in the **uncertainty/width** dimension |
| 7 | **Sentiment (Fear & Greed)** *(new)* | tilt: `mean = base + β·tilt(fg)`, band widened by fear; `fg` from the F&G index | **independent data** → uncorrelated disagreement |

**Confidence from band width (all statistical agents, replaces fixed 5000):** mirror the reasoner's existing rule (`forecast.ts:94`): `confidenceBps = clamp(round(MAX·(1 − widthFraction)), floor, MAX)`, `widthFraction = (upper−lower)/(domainMax−domainMin)`. Used identically in the live agents **and** the backtest.

**Shared-lib architecture.** `agents/forecasters` holds: the 6 statistical strategy fns (the reasoner stays in its own package but its parse/output contract is reused), the swarm math (§2), the BigInt CRPS + calibration port (§7), `confidenceFromWidth`, and `isqrt`. `arima-baseline` and `naive-baseline` are **refactored into thin runners** importing the lib (kills logic drift). The 4 new strategies get one **generic runner** parameterized by strategy + category (env-config), or small packages mirroring the existing pattern — chosen at plan time; the lib is the contract either way.

**Sentiment honesty caveat (baked into the spec & UI):** Fear & Greed predicts **Aave TVL** well (fear → outflows), **mETH APR** weakly, **USDY APY** essentially not at all (it's a T-bill rate set by Ondo). So the sentiment agent's calibration will correctly be worst on USDY — an honest leaderboard. F&G as a *stress input* (§4) remains valid on every category.

**Diversity proof.** The backtest reports a **pairwise error-correlation matrix** across the 7 agents. Low off-diagonal correlation = genuine diversity = the disagreement signal is meaningful (and a strong judge-facing artifact).

---

## 4. Market-stress warning (honest, 3-source, model-independent component)

`MarketStressMonitor.sol` (new, thin, read-mostly) classifies per-category stress into `{Calm, Elevated, Stressed}` and emits `StressWarning(categoryId, level, reasonBitmap)` on transitions. It is an **alert/labeling layer**, not a parameter-gating path — `RiskManager` keeps owning collateral/cap gating off confidence; the Monitor owns human-facing warnings off signals `RiskManager` ignores. (No harmful double-count: different consumers, different actions. Disagreement informs confidence *and* the alert, but never two thresholds gating the same action.)

**Three independent inputs:**
1. **Ensemble disagreement** `d` — read from `feed.disagreementBps` (internal model uncertainty).
2. **Forecast-surprise** (model-INDEPENDENT, on-chain, trustless) — the Monitor calls the category's resolver via `ResolutionEngine` to get the **current realized metric** and compares to the feed ensemble: `surprise = |resolverTruth(now) − ensemble| · SCALE / domainWidth`. The resolver reads the oracle, **not** the agents — so this catches the *shared-blind-spot / regime-change* case (all models agree on a stale value the market just left) that disagreement structurally cannot (adversarial #2, #9). **Best-effort:** wrapped in try/skip — if the resolver can't price the current block, the surprise term is omitted, never reverting.
3. **Fear & Greed** — read from `SentimentOracle.latest()` (0–100). Extreme fear (`≤ FEAR_EXTREME`) ⇒ stress; this is the **external, model-independent** market-sentiment component that makes it genuinely *market* stress.

**Classification (rule-based, with explicit reasons):**
- **Stressed** if: feed stale (`> MAX_STALE_BLOCKS`, reuse RiskManager's `50_000`) **OR** `d ≥ D_HIGH` **OR** `surprise ≥ SURPRISE_HIGH` **OR** `fg ≤ FEAR_EXTREME`.
- **Elevated** if: `n < MIN_SWARM` **OR** `d ≥ D_MED` **OR** `surprise ≥ SURPRISE_MED` **OR** `fg ≤ FEAR_MED` **OR** `fg ≥ GREED_EXTREME`.
- else **Calm**.
- `reasonBitmap` flags which trigger(s) fired (stale / disagree / surprise / fear / greed / low-quorum) so the alert says *why*.

All thresholds are owner-settable; `MAX_STALE_BLOCKS` is **imported/shared** with RiskManager (never re-declared — avoids drift, map:risk RISK note). All divisions guarded (YieldAllocator pattern).

**Honest positioning (explicit, judge-facing):** this is an **ensemble-consensus + freshness + realized-surprise + market-sentiment** signal. We do **not** claim the swarm predicts shocks — disagreement *lags* shocks because the models are persistence/AR on the same series. The backtest (§5) **measures** whether the combined signal tracks realized volatility and **reports the result honestly, including a null** if the (thin) real data has too few shocks to validate. This protects the project's verifiable-honesty thesis.

**`SentimentOracle.sol`** (new mock, mirrors `MockMethRateOracle` pattern): stores `fearGreed` (0–100) keyed by block, keeper-settable (`setFearGreed(block, value)` / `setFearGreedBatch`), `latest()` view. Seeded with real alternative.me history; updated live by the refresher/keeper.

---

## 5. Real market data (`agents/market-data`) — verified endpoints

All endpoints verified by fetch in the grounding run. **Free tier, no auth.** Cache `/chart` responses 24h (daily granularity).

**mETH APR** — DefiLlama yields, pool UUID **`b9f2f00a-ba96-4589-a171-dde979a23d87`** (confirmed live):
`GET https://yields.llama.fi/chart/b9f2f00a-ba96-4589-a171-dde979a23d87` → `{status, data:[{timestamp, tvlUsd, apy, apyBase, apyReward, apyBase7d, ...}]}`. Daily, from 2023-12-18 (~18mo). This is **ETH-L1 staking APR**, reported as %, **not** the 24h exchange-rate slope `MethAprResolver` computes. **Consistency fix (feasibility #4):** derive a mETH/ETH **exchange-rate series** from the daily apy (`rate_t = rate_{t−1}·(1 + apyBase_t/365/100)`) so the resolver's slope formula reproduces the daily apy; feed agents the same daily apy. Seed + resolve + agent-input all consistent.

**Aave-Mantle TVL** — `GET https://api.llama.fi/protocol/aave-v3` → `chainTvls.Mantle.tvl[]` of `{date, totalLiquidityUSD}` (deposit side; **>10MB response — stream/jq or cache server-side**). **Only ~4 months of history** (Aave launched on Mantle 2026-02). Longer **labeled proxy** for the illustrative backtest: chain-level `GET https://api.llama.fi/v2/historicalChainTvl/Mantle` → `{date, tvl}` (from 2023-07, note the **field name differs**: `tvl` vs `totalLiquidityUSD`), or `GET https://api.llama.fi/protocol/init-capital` `chainTvls.Mantle.tvl[]` (from 2024-01). The TVL backtest is **scoped to the real ~4mo** for Aave with the proxy shown separately and clearly labeled.

**USDY APY** — UUID must be resolved at runtime: `GET https://yields.llama.fi/pools` then filter `project==='ondo-yield-assets' && symbol==='USDY' && chain==='Mantle'` (>10MB — stream; cache the resolved UUID). Then `/chart/{uuid}`. **Monthly-stepped** (flat ~28 days, then a step) → treat as a step function; use a **14–21d** volatility window (7d is ~0).

**Fear & Greed** — `GET https://api.alternative.me/fng/?limit=0&format=json` → `{data:[{value, value_classification, timestamp}]}`. Daily, 0–100, history to 2018. Free, no auth.

**Normalization:** apy% → bps (`round(pct·100)` for the [0,2000]/[0,100000] bps domains... mind that the mETH domain is [0,100000] bps where the deploy synthetic targets ~3000 — keep the backtest domain bounds consistent with the deployed category config); TVL USD → 8-dec (`round(usd·1e8)`); F&G as 0–100 integer. **Realized volatility:** rolling stdev of daily first-differences (bps series) and of daily log-returns (TVL); winsorize TVL returns at ±3σ (price-driven jumps aren't yield noise). Windows: 7–14d for mETH, 14–21d for USDY/TVL.

**Caching & reproducibility:** all fetches cached to `agents/market-data/data/*.json` with the fetch date; the backtest reads the cache so runs are reproducible.

---

## 6. Open-protocol threat model & hardening

The protocol is **permissionless by design**: anyone registers an agent (soulbound NFT + 0.1 MNT) and submits any `{band, confidence}`. The 7 rosters are just reference bots — **user agents are NOT constrained to them**; they run any strategy/parameters off-chain. We ship the reference strategies as **forkable templates + SDK quickstart** so users can deploy tuned variants (the "tunable parameters" path) without being forced into the roster. This open-benchmark property is a strength.

**Layer 1 — economic/reputation (already self-protecting):** a bad agent gets bad CRPS → low accuracy → never clears the top-20 gate (`resolvedCount ≥ 10` + rank) → **never touches the feed or stress signal**; it only bleeds its own stake. Fee + stake + slashing deter spam.

**Layer 2 — new swarm/stress code (must be hardened — testable requirements):**

| Vector | Hardening (spec requirement) |
|--------|------------------------------|
| Malformed `value` bytes (wrong length / garbage) to revert `refresh` and freeze the feed | per-contributor **try/skip**: validate `value.length` and decode in a way that skips a bad contributor; **never revert the whole `refresh`/Monitor** |
| Out-of-domain / overflow values skewing dispersion or overflowing `(lo+hi)/2` | **clamp every contributor band to `[domainMin, domainMax]`** before aggregating; all arithmetic guarded (verified 256-bit headroom) |
| Wide-band free-rider (full-domain band, "never wrong", climbs reputation, fakes agreement) | `confidenceFromWidth` (wide ⇒ low stated) + **band-width in `dRaw`** + **minimum stated-confidence to count as a contributor** (`MIN_CONTRIB_CONF_BPS`) |
| Sybil / collusion consensus (many correlated agents faking 100% agreement to steer confidence/stress) | **quorum (`MIN_SWARM`)** + **per-agent rank-weight cap** + stake cost per agent + **diversity/error-correlation down-weighting** (correlation in P1 backtest; on-chain down-weighting = **P2**). Feed stays **advisory in v1**; collusion documented as a **known limitation**. |

UI may cosmetically label "reference" vs "community" agents; on-chain all are equal and objectively scored.

---

## 7. Backtest harness (`agents/backtest`) + parity strategy

**Replay (no look-ahead — feasibility #8):** for each category, for each step `t` over an **expanding window**, feed each agent **only `data[0..t−1]`** → forecast `t` → score against the realized value at `t`. Replicate the on-chain pipeline chronologically: EMA accuracy (`α=0.1`), calibration squared-error with the **cold-start `total<10 ⇒ 0`** threshold, bucket index `confidence/1000`. A **no-future-leakage test** corrupts `t+1` and asserts the step-`t` forecast is unchanged.

**Scoring port (BigInt, parity-tested — feasibility #1, #5):** port `RangeCrpsScorer` and the `ScoringEngine` calibration to TypeScript **in pure BigInt**, mirroring the exact Solidity op order: snap-to-bucket, doubled coords `y2 = 2·domainMin + (2·yBucket+1)·w` (the `+1` is load-bearing), integer floor division, the `deduction ≥ 2·SCALE ⇒ SCORE_MIN` branch. The TVL domain cubic reaches ~194 bits ≫ 2⁵³, so **float is forbidden**. A forge test/script **emits test vectors** (CRPS + swarm math) to JSON across **all three domains incl. the 1e17 TVL boundary**; a vitest asserts the TS port matches **bit-for-bit**. `isqrt` is the OZ Babylonian algorithm ported to BigInt (integer-sqrt-vs-integer-sqrt parity — JS `Math.sqrt` would diverge).

**Swarm + stress evaluation:** at each step compute the swarm aggregation (§2) and the 3-source stress (§4: disagreement + forecast-surprise + F&G). 

**Honest methodology (adversarial #6):**
- **Pre-registered train/test split** on the real series; **tune per-category `DISAGREE_SCALE` (+ stress thresholds) on train only**; report on held-out test.
- **DeepSeek cached on ALL steps** (run once, ~$1–2; store JSON) so it's a true peer — never a `<10`-point cold-start agent presented as a calibrated peer.
- Synthetic-shock injection is a **labeled illustration only**, never cited as validation.
- Report: per-agent accuracy/calibration; **swarm vs best-single calibration**; the **error-correlation matrix** (diversity); **corr(stress, realized-vol)** — and **report the null** if real data is too thin.

**Outputs:** a markdown/console metrics report + **`frontend/public/backtest-snapshot.json`** (per-agent metrics, correlation matrix, swarm-vs-single curve, stress timeline) for the UI. The backtest scores real data through the **pure TS port directly** — it does **not** touch the on-chain mock oracle (decouples ground truth from oracle seeding — feasibility #5).

---

## 8. Contract changes (exact)

**`ICompositeFeed.sol`** — **append** `uint32 disagreementBps` to the END of `CompositeForecast` (consumers read by field name, so appending is ABI-safe; raw decoders audited in §9).

**`CompositeFeed.sol`** — in `_aggregate` (currently :188-218): add dispersion (`isqrt`), `Wbar`, normalized `d`, agreement `g`, `MIN(calMult, g)` combine, quorum cap, store `disagreementBps`; in `_gather`/`_contributor`: **domain-clamp**, **try/skip malformed**, **min-contrib-confidence gate**, **per-agent rank-weight cap**. Add `mapping(bytes32 => uint256) disagreeScale` (+ owner setter), `MIN_SWARM`/`SINGLE_SOURCE_CEILING_BPS`/`AGREE_FLOOR`/`MIN_CONTRIB_CONF_BPS` (owner-settable where tuning is expected). Extract the rank-weight calc into a shared internal helper used by value + dispersion. Import OZ `Math` for `sqrt` (ensure submodule present).

**`MarketStressMonitor.sol`** (new) — constructor wires `CompositeFeed`, `ResolutionEngine`, `SentimentOracle`; `stressLevel(categoryId) view returns (Level, uint256 reasonBitmap)`; `poke(categoryId)` (permissionless) recomputes and emits `StressWarning` on transition; owner-set thresholds; imports RiskManager's `MAX_STALE_BLOCKS`; resolver call wrapped try/skip.

**`SentimentOracle.sol`** (new mock) — `setFearGreed`, `setFearGreedBatch`, `latest()`, `getAt(block)`; keeper-gated writes.

**`Deploy.s.sol`** — deploy `MarketStressMonitor` + `SentimentOracle`, wire, set default `disagreeScale` per category (from backtest), seed F&G.

Existing **169 forge tests stay green**; new tests in §10.

---

## 9. Frontend (light wiring)

- **`gen-insights-snapshot.ts` + `SnapCategory`** (`snapshot.ts`): add `disagreementBps`, `swarmAgreementPct` (= `100 − disagreement%`), `stressLevel`, `fearGreed`. **Regenerating `insights-snapshot.json` (`pnpm gen:insights`) is a REQUIRED build gate** in the same PR (the snapshot is frozen at build; a struct change with a stale snapshot ships `undefined` — feasibility #7).
- **`/insights`**: `YourMoveStrip` gains a swarm-agreement % + stress-level + F&G cell; `AlertPreview` (AnomalyFeed.tsx) renders the **real** `StressWarning` reason instead of a hardcoded mock.
- **`/simulation`**: the Calm→Stressed slider drives the **real** swarm/stress logic — `simulateMarket` (`rwaSim.ts`) is updated to mirror the on-chain swarm math + 3-source stress (a JS-number mirror is acceptable here since it's a UI simulation, but the labels/thresholds match the contract).
- **New backtest view**: a page/section reading `backtest-snapshot.json` — per-agent leaderboard, error-correlation heatmap, swarm-vs-single calibration, stress timeline.
- **Audit raw decoders** for the appended struct field: `frontend/src/lib/hooks.ts` viem reads, `/api/feed` (live viem read), any `decodeAbiParameters` on `CompositeForecast`. Keep BigInt→Number before React (tsconfig ES2017; values stay < 2⁵³ for bps/F&G; TVL stays bigint until display).

---

## 10. Testing & verification

- **forge** (new, on top of 169): swarm math — `n=0` (hold-last-good), `n=1` (quorum cap → ≤ `SINGLE_SOURCE_CEILING_BPS`, **not** 100%), `n=2/3`, identical midpoints (`D=0`), max-spread (`g` floor binds), TVL squared-deviation overflow boundary; hardening — malformed contributor skipped (feed still refreshes), out-of-domain clamp, rank-weight cap, min-contrib-confidence gate; `MarketStressMonitor` — each stress trigger + transitions + best-effort surprise skip; `SentimentOracle`.
- **forge vector emitter** → JSON (CRPS + swarm math, all 3 domains).
- **vitest**: TS scoring/swarm **parity** vs emitted vectors; no-future-leakage; each strategy unit-tested; `confidenceFromWidth`; `isqrt` parity.
- **frontend**: `tsc` 0 · `lint` 0 · `vitest` · `next build` · e2e (375px) green; snapshot regenerated.
- **backtest**: produces the report + `backtest-snapshot.json`; methodology asserts train/test separation.

---

## 11. Phasing

**P1a — lands now, no keys (everything buildable + verifiable offline):** `agents/forecasters` lib + 7 strategies; `agents/market-data`; `agents/backtest` + report + `backtest-snapshot.json`; swarm math (Solidity + TS, parity-tested); `CompositeFeed` extension + hardening; `MarketStressMonitor` + `SentimentOracle`; frontend wiring; all forge/TS/frontend tests green. Demo runs off **committed snapshots**. Reference strategies + SDK quickstart published as forkable templates.

**P1b — needs your funded keys + RPC (operational):** `SeedFromReal.s.sol` seeds oracles with real **day-grid** values (`setRate` at exactly the resolution blocks the agents use, and `block−43200`; synthetic disabled off-grid or documented) + seeds F&G; **redeploy** the extended contracts; register + run the 7 agents (as many as keys allow — aim to clear `MIN_SWARM`); run resolver/refresher/sentiment keeper; regenerate live snapshots; verify contracts (Etherscan V2). One-command-ready scripts provided.

**P2 — deferred:** deeper per-agent model/prompt refinement; on-chain error-correlation collusion down-weighting; on-chain forecast-surprise hardening; live indexer/bot hosting; enforce subscription gate.

---

## 12. Open risks / honest caveats

- **Thin real data:** Aave-Mantle TVL ~4mo, USDY flat monthly steps, mETH apyBase ~18mo. The backtest may find **too few real shocks to validate** the stress signal — we **report that null** rather than manufacture evidence with synthetic shocks.
- **Disagreement lags shocks:** the on-chain warning is honestly an *ensemble-consensus + surprise + sentiment* signal, **not** a shock predictor (§4).
- **Collusion:** full Sybil/collusion resistance is the oracle-manipulation problem; v1 mitigates (quorum, rank-weight cap, stake, diversity) and keeps the feed **advisory**; on-chain correlation down-weighting is P2.
- **`MIN_SWARM` vs live agent count:** if fewer than `MIN_SWARM` agents are live, the feed correctly reports capped (single-source) confidence and the Monitor flags low-quorum — so P1b should run enough agents to clear quorum for a clean demo.
- **mETH metric definition:** we use DefiLlama-derived apy → exchange-rate series (consistent across seed/resolve/agent); the on-chain archive route is an alternative left to P2.
- **F&G predictiveness:** strong for TVL, weak for APR, ~none for USDY — reflected honestly in the sentiment agent's per-category calibration.

---

## 13. File map (new / changed)

```
agents/market-data/            NEW  — DefiLlama + F&G fetch, normalize, vol, cache
agents/forecasters/            NEW  — strategies + swarm math + BigInt scoring port (single source of truth)
agents/backtest/               NEW  — expanding-window replay, metrics, backtest-snapshot.json
agents/arima-baseline/         CHG  — refactor to import forecasters lib; real confidence-from-width
agents/naive-baseline/         CHG  — refactor to import forecasters lib; real confidence-from-width
agents/<momentum|mean-rev|ewma|sentiment runners>  NEW (or one generic runner)
agents/refresher/              CHG  — also poke MarketStressMonitor + post F&G (keeper)
contracts/src/CompositeFeed.sol            CHG  — agreement multiplier, disagreement, hardening
contracts/src/interfaces/ICompositeFeed.sol CHG  — append disagreementBps
contracts/src/examples/MarketStressMonitor.sol  NEW
contracts/src/mocks/SentimentOracle.sol         NEW
contracts/script/Deploy.s.sol              CHG  — deploy+wire+seed new contracts
contracts/script/SeedFromReal.s.sol        NEW  — seed oracles from real day-grid data + F&G
contracts/test/*                           NEW  — swarm math, hardening, monitor, oracle, vectors
frontend/scripts/gen-insights-snapshot.ts  CHG  — disagreement/agreement/stress/F&G fields
frontend/src/lib/{snapshot,hooks,rwaSim}.ts CHG  — schema + real swarm/stress
frontend/src/app/(app)/insights/*          CHG  — swarm %, stress, real AlertPreview
frontend/public/backtest-snapshot.json     NEW  — backtest results for the UI
```
