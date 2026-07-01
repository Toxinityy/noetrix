# Live Pyth spot-price category + composite-feed cleanup — design

**Date:** 2026-07-01
**Status:** APPROVED (build-ready)
**Track:** AI Alpha & Data (Mirana) — Path A Data & Analytics, spine = verifiability
**Author:** CEO-review session (strategy locked 2026-07-01)

---

## 1. Why (one paragraph)

Our on-chain scoring truth is currently a synthetic curve (`MockMethRateOracle.setSynthetic`). Our top competitor **OnChain Radar** grades against raw on-chain data with **no oracle** and is on mainnet — so in a side-by-side "which one is real?" comparison, we lose the credibility contest, and our flagship Composite Feed chart reads as fake (flat plateau + a cliff; see §5). This spec adds **one category whose truth is a genuinely-live, independently-verifiable Pyth price feed on Mantle Sepolia**, and fixes the feed chart so it renders honestly. It directly lifts the scorecard's **Ecosystem fit (10)** + **Data source quality (15)** + **Technical completeness**, and neutralizes OnChain Radar's cleanest advantage.

**Non-goal:** replacing the existing mETH/USDY/Aave categories. Those stay (backed by the real-DefiLlama backtest). This ADDS one real-truth category and makes it the demo lead.

---

## 2. The category

- **Id:** `MNT_USD_SPOT` (keccak256 of the label, per existing category pattern).
  - **Primary: MNT/USD.** MNT is Mantle's native token → maximally "Mantle-native data" for the Ecosystem-fit + Data-source-quality criteria. Confirm the MNT/USD feed exists in Pyth's catalog via Hermes (§7). If unavailable, fall back to **ETH/USD** (feed definitely exists).
- **Meaning:** "the MNT/USD spot price at resolution, in 8-decimal USD." A short-horizon forecast (commit now → resolve ~1h later), so it resolves inside a demo and produces a dense, naturally-moving feed history.
- **Outcome unit:** `uint256` price in 8-dec USD (matches `AaveMantleTvlResolver`'s 8-dec convention; `RangeCrpsScorer` scores any `uint256` outcome).
- **Domain (scorer config `abi.encode(uint256 domainMin, uint256 domainMax)`):**
  - MNT/USD: `[0, 5e8]` ($0–$5), 100 buckets → $0.05/bucket.
  - ETH/USD fallback: `[1000e8, 6000e8]`, 100 buckets → $50/bucket.
- **Resolution offset:** short. Default **1800 blocks (~1h at 2s)**, configurable. Must be ≥ `MIN_RESOLUTION_OFFSET (300)` from `PredictionMarket`. Shorter horizon → more frequent resolutions → denser feed chart (side-benefit that cures §5).

No new scorer. Reuse `RangeCrpsScorer` with the price domain.

---

## 3. New contracts

### 3.1 `interfaces/IPyth.sol` (minimal)
```solidity
interface IPyth {
    struct Price { int64 price; uint64 conf; int32 expo; uint256 publishTime; }
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
```

### 3.2 `resolvers/PythSpotResolver.sol` — **keeper-snapshot** (design changed during build)

> **The naive live-read is exploitable — rejected.** `ICategoryResolver.resolve` is `view`, and `ResolutionEngine.resolve(predId)` is **permissionless with no upper deadline** (only `block.number >= resolutionBlock`). A `view` resolver that returns "Pyth's latest price at call time" therefore lets the *agent itself* wait until the live spot drifts into its own committed band, then self-resolve into a near-max CRPS score — the price truth becomes caller-and-timing-selected. A review caught this as a ship-blocker; a "bounded live-read" (add a resolve deadline) only shrinks the cherry-pick window to ~10 min AND introduces a permanent stuck-stake cliff. **We pin the outcome instead.**

**Keeper-snapshot design (shipped):** an authorized keeper records the real Pyth print **once** into an immutable per-block snapshot; the `view` resolver just reads that fixed value. Because the graded price is set once and never depends on *who* calls resolve or *when*, the self-resolve / grief-resolve timing exploit is closed.

```solidity
contract PythSpotResolver is ICategoryResolver, Ownable {
    uint256 public constant MAX_AGE = 120;      // seconds — staleness at record time
    uint256 public constant MAX_CONF_BPS = 500; // 5% — refuse to grade against a print Pyth flags unreliable
    IPyth public immutable pyth;
    bytes32 public immutable feedId;
    address public keeper;                       // owner-settable

    mapping(uint256 => uint256) public snapshotPrice;   // resolutionBlock => 8-dec USD, first write wins
    mapping(uint256 => bool)    public recorded;
    mapping(uint256 => uint256) public recordedAtBlock;  // audit: how close to horizon

    // Keeper pushes the signed Hermes update to Pyth, reads + conf-gates the fresh price,
    // normalizes to 8-dec USD, stores it once. onlyKeeper + first-write-wins = no cherry-pick.
    function record(uint256 resolutionBlock, bytes[] calldata updateData) external payable; // see source

    // view (ICategoryResolver): reads the pinned snapshot; reverts NotRecorded until the keeper records.
    function resolve(bytes calldata, uint256 resolutionBlock) external view returns (bytes memory);
}
```

**Why a keeper, not permissionless record:** a permissionless `record()` would just move the cherry-pick to whoever records first. A single honest keeper recording the first valid print at the horizon is deterministic, and the stored value is a **real, Hermes-verifiable Pyth print** — the `record` tx updates Pyth's on-chain price to it (auditable), same trust model as the existing mETH rate keeper. `MAX_CONF_BPS` rejects a print whose Pyth confidence interval is > 5% of price (Pyth's own "this print is unreliable" signal).

**Liveness escape (finding #1 tail):** a keeper/RPC outage must not permanently strand stake. `PythSpotResolver` has **no hard record deadline** (keeper may record late to recover liveness), and `PredictionMarket.voidExpired(predId)` lets the controller reclaim the **full** stake (no slash, no score) once `block.number > resolutionBlock + VOID_DELAY_BLOCKS` (43 200 ≈ 24h). This is the catastrophic-case valve (keeper key lost / feed delisted). `cancel` can't cover it — `cancel` is blocked once `block.number >= resolutionBlock`.

---

## 4. Wiring

### 4.1 Deploy (`script/Deploy.s.sol` or a standalone `AddPythCategory.s.sol`)
1. Reference the deployed Pyth contract (address from §7 — CONFIRM the Sepolia address before broadcast).
2. Deploy `PythSpotResolver(pyth, feedId, owner, keeper)` — `keeper` = the resolver bot's hot wallet (owner can rotate it later via `setKeeper`).
3. Register the category on **ResolutionEngine** (`registerCategory(id, resolver, scorer, configBytes)`) where `scorer = RangeCrpsScorer`, `configBytes = abi.encode(domainMin, domainMax)`.
4. Register the category on **PredictionMarket** (`registerCategory(...)` with minStake + allowed window; `allowedWindowStart ≥ 300`).
5. Serialize the new addresses into `deployments/mantle-sepolia.json`.

### 4.2 Category config surfaces to update
- SDK `agents/sdk/src/categories.ts` — add `MNT_USD_SPOT` to `CATEGORIES` (label, domain, decimals) and export it from the barrel (index). (Same gap that bit USDY — don't repeat it.)
- Frontend `CATEGORIES` map + `KNOWN_AGENTS` unaffected; add the category tab.
- Refresher `agents/refresher` — add the new categoryId to its refresh list so `CompositeFeed.refresh(id)` runs for it.

### 4.3 Resolver bot change (`agents/resolver/src/index.ts`) — the key change
The bot is the **keeper**. For a prediction in the Pyth category, once its `resolutionBlock` is reached it **records the snapshot, then resolves** (two steps, but resolve is now permissionless and can be anyone):

1. Read the prediction's `categoryId` (already fetched in `getPrediction`). If it equals `PYTH_CATEGORY_ID`, take the keeper path; else unchanged.
2. If `resolver.recorded(resolutionBlock)` is already true → skip to step 6 (another keeper tx already pinned this block; snapshots are shared per resolutionBlock).
3. Fetch signed update from Hermes:
   `GET https://hermes.pyth.network/v2/updates/price/latest?ids[]=<feedId>&encoding=hex`
   → `data.binary.data[]` (hex VAAs).
4. `fee = pyth.getUpdateFee([updateData])` (read).
5. `PythSpotResolver.record{value: fee}(resolutionBlock, [updateData])` — pushes the update to Pyth, reads + conf-gates the fresh print, pins the 8-dec snapshot (first write wins; excess value refunded).
6. `ResolutionEngine.resolve(predId)` — the `view` resolver reads the pinned snapshot. Multiple predictions sharing a `resolutionBlock` all resolve against the one snapshot.

`record` is `onlyKeeper`, so only the bot's wallet can pin — that plus first-write-wins is what closes the timing exploit (§3.2). The `record` tx needs a small MNT balance for the Pyth fee + gas. No atomic helper needed: correctness no longer depends on the record→resolve gap (the snapshot is frozen the moment `record` lands).

New resolver config (`agents/resolver/src/config.ts` + `.env`): `PYTH_CATEGORY_ID`, `PYTH_ADDRESS`, `PYTH_FEED_ID`, `PYTH_RESOLVER_ADDRESS`, `HERMES_URL` (default `https://hermes.pyth.network`). The bot wallet must be set as the resolver's `keeper` at deploy (§4.1).

### 4.4 Agents forecasting the new category
- `agents/market-data` — add a MNT/USD (or ETH/USD) price-history fetcher (Coingecko or Pyth Benchmarks) so the forecasters have a real series to seed on. Keep the provenance-stamp pattern (`source`, `fetchedAt`).
- `agents/forecasters` — the existing EWMA-Vol / Momentum / Mean-Reversion / Naive strategies operate on any series → point them at the price series for this category. No new strategy needed.
- Register the new category in each running agent's config (arima, naive, deepseek-reasoner, swarm-runner) so they submit forecasts for it.

---

## 5. Composite-feed chart cleanup (bundled — shares the root fix)

Root causes of the "unnatural" chart (`frontend/src/app/terminal/feed/[category]/FeedClient.tsx`):

1. **Axis bug (the cliff).** `XAxis dataKey="block"` on a default **category** axis spaces all points evenly, so the ~540k-block gap between an old seed-run cluster and recent points collapses into a single step.
   - **Fix:** `XAxis type="number"` with a numeric block domain (`domain={['dataMin','dataMax']}`, `scale="linear"`), OR plot against `timestamp`. Gaps then render as gaps, not cliffs.
2. **Sparse/burst history.** Only clustered log windows are retrievable (RPC 10k `eth_getLogs` cap) + bots ran in bursts.
   - **Fix (visual, now):** filter to the contiguous recent window, or bucket to evenly-spaced points; don't render a 500-point series that's 99% stale cluster.
   - **Fix (root):** the new short-horizon Pyth category + steady refresher cadence produce a dense, continuous, naturally-moving series.
3. **Derived stats inherit the distortion.** "24h change +3.29%" vs "current 3.14%" is nonsense because `findLookbackPoint(history, DAY_BLOCKS)` lands across the data hole. "Contributors 7" disagrees with the weight table (Momentum 38.57% ⇒ ~4–5 effective contributors).
   - **Fix:** lookback to the nearest real point (skip across gaps); reconcile the "Contributors N" KPI with the count of agents that actually contributed a revealed prediction this refresh.

Do the axis + lookback + contributor-count fixes regardless of the Pyth work — they're honesty fixes worth hours.

---

## 6. Test plan

- **Foundry:** ✅ **done — `PythSpotResolver.t.sol`, 32 tests, full suite 223 green.** Unit: `MockPyth` returns known `(price, conf, expo, publishTime)`; asserts `_to8dec` for expo −8/−5/0/−10/eth-scale, staleness at/past/future boundary (absolute-diff), feed-not-found, negative/zero price, wide/at-threshold confidence, out-of-domain raw pass-through, constructor/keeper guards. Anti-cherry-pick core: `test_Record_FirstWriteWins`, `test_Snapshot_ImmutableAgainstLaterPriceMoves`, `test_Record_OnlyKeeper`, `test_Record_BeforeHorizon_Reverts`, `test_Resolve_RevertsBeforeRecord`. Pipeline (`PythSpotPipelineTest`): register→commit→reveal→keeper-record→resolve→CRPS; `test_SnapshotPinned_TimingAndDriftIrrelevant` (grades pinned $0.80 near-max despite live drift to $4.00 = **the exploit closed at pipeline level**), scorer-discriminates, out-of-domain clamp, and the void escape (`test_UnrecordedThenVoid_RefundsFullStake`, `test_VoidExpired_*`).
- **Resolver bot:** unit-test the Hermes fetch → `resolver.record(resolutionBlock, updateData)` → `ResolutionEngine.resolve` path with a stubbed Pyth (or a Sepolia dry-run); assert the `recorded(block)` skip and the `AlreadyRecorded` catch.
- **Frontend:** vitest for the new axis/lookback helpers; e2e keeps `/feed/<new-category>` at 375px with no overflow.

---

## 7. Values to CONFIRM before deploy (do not hardcode from memory)

| Value | Source | Status |
|---|---|---|
| Pyth **Mantle mainnet** address | Pyth docs | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` (confirmed ×2) |
| Pyth **Mantle Sepolia** address | Pyth docs `price-feeds/contract-addresses/evm` OR pyth-crosschain `contract_manifest` | **CONFIRM** (docs fetch returned a malformed length; verify the full 40-hex before broadcast) |
| MNT/USD feed ID | Hermes (confirmed 2026-07-01) | ✅ `0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585` (`Crypto.MNT/USD`, exists) |
| ETH/USD feed ID (fallback) | Hermes (confirmed 2026-07-01) | ✅ `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` (`Crypto.ETH/USD`) |

Fetching from Hermes at implementation is authoritative — use it, don't trust any hex pasted here or recalled.

---

## 8. Rollout order

1. Confirm §7 values (Hermes + Pyth docs).
2. `IPyth` + `PythSpotResolver` + tests → `forge build` + full suite green.
3. `AddPythCategory.s.sol` → broadcast on Sepolia → serialize addresses.
4. SDK + agent configs + market-data fetcher → agents forecast the new category.
5. Resolver bot record-then-resolve path (bot wallet = resolver `keeper`) → deploy to the host (pm2).
6. Refresher: add categoryId → steady cadence.
7. Frontend: category tab + chart axis/lookback/contributor fixes → rebuild.
8. Run to ≥10 resolved on the new category (clears "calibrating") → regen snapshots.
9. Demo: lead with this category — "real Pyth price, verifiable on Hermes, forecast committed before it printed, CRPS-scored on-chain."

---

## 9. Out of scope (separate follow-on workstreams from the same CEO review)

- **Verifiable-backtest legibility surface** — translate the (already rigorous, real-DefiLlama, train/test) backtest into a VC-readable artifact + the "commit-reveal can't be overfit" kill-shot vs Mensa. Highest-value copy/UX work after this.
- **"AI Reasoner" archetype rename** — rename the *type* to "AI Reasoner (LLM)", keep the instance honest ("running DeepSeek v3.1"). Display + docs only; no re-registration (on-chain identity stays "DeepSeek Reasoner").
- **Positioning reframe** — "Noetrix is the Turing Test / the benchmark league" one-liner across hero/README/demo.
- **Subtract RWA-allocation surfaces** — concede the allocation lane to Mensa; sharpen to Alpha&Data-as-benchmark.
