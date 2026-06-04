# Predictor Index — Architecture Review & Audit

**Date:** 2026-06-03
**Type:** Architecture review / audit (correctness · economic/game-theory · system-robustness/ops · judge-defense)
**Method:** Parallel review fleet (6 read-only specialists, one per cluster/lens) → adversarial verification of every High/Critical finding against source → synthesis. Approach "B + triage" per the brainstorming session.
**Scope:** 17 deployed contracts (2,182 LoC Solidity), the off-chain stack (4 bots + SDK + Ponder indexer + Next.js frontend + cached-snapshot tier), the economic mechanism, and the demo/ops reality.
**Subject commit context:** `master` @ `ba4b0a2`, deployment `contracts/deployments/mantle-sepolia.json` (chainId 5003).

> **Two severity axes.** A hackathon finding lives on two scales that often diverge: **Protocol severity** (would this lose funds / break the protocol on mainnet) and **Demo/Submission risk** (would this hurt the demo or a judge's impression *this week*). Where they diverge, both are stated. Nothing here is a "you got hacked" Critical — the money paths are sound. The Criticals are **demo-readiness** issues; the Highs are **mechanism/correctness** issues a sharp judge will probe.

---

## 1. Verdict (read this first)

The on-chain **money core is genuinely sound**: stake conservation is enforced by strict equality with resolver-paid-first, reentrancy is closed off, the pull-claim bonus design has no gas-DoS loop, and the CRPS/calibration math is correct for the deployed domains. There are **no fund-theft vulnerabilities.** This is strong work for a 2-week build and it is well-tested.

The real exposure is in three places, and a technical judge will go straight to them:

1. **The reputation *signal* itself is softer than the pitch claims.** Stated confidence is a free dial decoupled from the score (calibration is gameable), wide bands collapse to a domain-midpoint in the feed, and a flat-fee/testnet Sybil swarm can capture the top-20 and the bonus pool. The product is sold on "calibration-scored confidence" — that's the weakest-defended part of the mechanism.
2. **The trust root is a mock oracle the team owns.** Every score, rank, and feed value descends from an owner-seeded oracle. This is the *correct* honest framing to lead with, not hide.
3. **The demo data is real-but-thin and one feed never refreshes.** The committed snapshot shows everything "calibrating," all feed-history empty, risk "Frozen" everywhere, and USDY (the RWA-track-named asset) is missing from the refresher entirely.

**One real code bug to fix** (one line): the refresher omits USDY. **One real correctness flaw worth fixing** before any mainnet money: rollover-stranding on out-of-order epoch finalization. Everything else is either a documented/defensible v1 tradeoff or honest-framing material.

---

## 2. Findings at a glance (ranked)

| # | Severity | Lens | Finding | Verified? | Action |
|---|----------|------|---------|-----------|--------|
| C1 | **Critical (demo)** | ops | Snapshot real-but-thin: all agents "calibrating", calibration 0, feedHistory empty, risk "Frozen", smart-money silently mock | ✅ source | Grow data → re-snapshot, or frame honestly |
| C2 | **Critical (demo) / High (bug)** | ops | Refresher omits `USDY_APY_24H` → USDY feed never refreshes | ✅ source | One-line fix + re-run |
| H1 | **High** | correctness/sec | Rollover MNT stranded on out-of-order `finalizeEpoch` | ✅ source | Fix before mainnet; defensible for demo |
| H2 | **High** | economic | Calibration is a free dial decoupled from score → gameable; "overconfidence harms calibration" only half-true | ✅ source | Lead with the honest proxy framing |
| H3 | **High** | economic | Wide-band safe-mediocre + feed midpoint-collapse discards band width | ✅ (collapse) | Disclose; v2 surface width |
| H4 | **High** | economic | Sybil: 0.1 MNT is the only cost (≈free on testnet); top-20 + bonus pool capturable | ✅ source | Reframe fee as spam-deterrent; have the answer ready |
| H5 | **High (judge)** | oracle-trust | Truth = owner-seeded mock oracle; whole reputation system inherits it | ✅ source | Lead with "verifiable-given-oracle", not "trustless" |
| H6 | **High (submission)** | ops | 17 contracts deployed but **unverified** on explorer | ✅ source | Verify via Etherscan-V2 / Sourcify |
| M1 | Medium | correctness | CRPS cube overflows for any future category with domain ≳1e24 (deployed categories safe) | ✅ source | Guard domain or document cap |
| M2 | Medium | ops | Single-machine hosting; state-file + `0x`-key foot-guns poison a re-run | ✅ history | Commit to snapshot demo; op checklist |
| M3 | Medium | economic | `CompositeFeed.refresh` has no caller incentive — the *paid product* has no liveness funding | ✅ source | Roadmap: subscription → keeper reward |
| M4 | Medium | correctness | `finalizeEpoch` deducts both 5%+0.5% off raw pool — diverges from PRD §7.2.4 prose (immaterial, citable) | ✅ source | Reconcile doc to code |
| M5 | Medium | correctness | `CompositeFeed.read()` has no staleness signal — consumer can read stale/zero | ✅ source | Document; `DemoFeedConsumer.valueFresh` models the gate |
| M6 | Medium | economic | Bonus weight `score²·stake` rewards capital as much as skill | ✅ source | Decide if intended; state it |
| M7 | Medium | economic | 2% resolver tax → no single prediction is EV-neutral; honest EV carried by bonus | ✅ source | Don't claim "honest stake is safe"; it's a tournament |
| L1–L10 | Low/Info | mixed | Stale `_latestRevealed` after cancel; dead approvals on soulbound; Python-ref vs Solidity div mismatch on negative scores; unbounded/unrefunded `msg.value` stake; forfeit push-pattern; rotation re-check brick; gate-blocks-advisory-reads; Aave decimal assumption; tiny-stake contribution truncation; EV/anti-grief notes | ✅ mixed | Mostly document/defend |

---

## 3. Critical (demo-readiness)

### C1 — Snapshot is real but thin: the proof surfaces are nearly empty
- **Lens:** ops · **Protocol severity:** N/A · **Demo severity:** Critical
- **Evidence (verified):** `frontend/public/{insights-snapshot.json, fallback-leaderboard.json}` — `source: "chain"` @ block 39441549, but: `calibrationScore: 0` for **all 6** agent×category entries; `resolvedCount` ∈ {2,3,4} (all below the `>=10` top-agent / qualified floor); `feedHistory: []` in all three categories; `risk: "Frozen"` in all three.
- **Impact on demo day:** leaderboard shows 2 agents, both flagged `calibrating`; any "qualified-agent / smart-money" surface that filters on `resolvedCount >= 10` renders its EmptyState; `useSmartMoneyBands` falls back to **mock** with no banner (judges may view curated mock unknowingly); consensus/feed-over-time charts are blank; the RWA risk monitor reads "Frozen/Paused" everywhere, which *looks broken* rather than "safe default."
- **Fix / defense:** (a) **Grow the data** — burst-run the pipeline to ≥10 resolved/category, then regenerate **both** snapshots (`pnpm --filter frontend gen:fallback` + `pnpm gen:insights`) against a PAYG RPC. This clears the `calibrating` flag and populates calibration. (b) **Honest framing** (partly in the footer already): "N is small and growing; calibration is cold until ≥10 resolutions; Frozen is the safe default for an unrefreshed feed." Do **not** let the smart-money card silently serve mock — populate it or show its EmptyState.

### C2 — Refresher never refreshes USDY (real bug, known class)
- **Lens:** ops · **Protocol severity:** High (functional bug) · **Demo severity:** Critical if USDY shown live
- **Evidence (verified):** `agents/refresher/src/config.ts:56-59` — `categories` array contains **only** `METH_APR_24H` and `AAVE_MANTLE_TVL_24H`. `USDY_APY_24H` is absent, although both bots forecast USDY and the frontend renders a USDY tab. USDY's `CompositeFeed` is therefore never refreshed → permanently stale/zero.
- **Why it matters:** USDY is the asset *named in the AI×RWA track*. This is a re-occurrence of the exact "USDY-omission" bug class the project hit before (SDK `categories.ts`, the stale `fallback-leaderboard.json`).
- **Fix:** add `{ label: "USDY_APY_24H", id: categoryId("USDY_APY_24H") }` to the array (one line), then include USDY in the burst-run before re-snapshotting. If you *don't* fix it, do not demo USDY's live feed/risk — demo its leaderboard/predictions (which are populated).

---

## 4. High

### H1 — Rollover MNT permanently stranded on out-of-order epoch finalization
- **Lens:** correctness/security (value-stuck, **not** stealable) · **Protocol severity:** High · **Demo severity:** N/A
- **Evidence (verified):** `BonusDistributor.sol:105-115`. `finalizeEpoch(cat, e)` imposes **no ordering constraint** — it only checks `finalized[cat][e]` and `block.number >= (e+1)*EPOCH_BLOCKS`. Line 113 freezes `finalPool[e] = rawPool − rollover − finalizerReward`; line 114 does `pool[e+1] += rollover`. Finalization is permissionless and order-free, so a keeper can finalize `e+1` *before* `e` (both ended). When `e` is later finalized, its 5% rollover lands in `pool[e+1]` — but `finalPool[e+1]` was already frozen from the pre-rollover value and `finalized[e+1] == true` (re-finalize reverts `AlreadyFinalized`). That rollover has **no claim path** and there is no owner sweep.
- **Impact:** A subset of the bonus pool (the rollover of any out-of-order-finalized epoch) is permanently locked. No theft; a genuine conservation break — the documented `Σ claimable ≤ finalPool` invariant silently understates inflow and the gap is irrecoverable. (`notifySlash` is bounded to `currentEpoch()`, so the *other* stranding path — slashing into a past finalized epoch — is mitigated by construction.)
- **Fix / defense:** Force in-order finalization (require `e-1` finalized), or redirect rollover to the next *unfinalized* epoch, or add an owner `sweepStranded`. **Defensible for the hackathon:** "rollover assumes monotonic finalization by our keeper; out-of-order finalize is operator error, not adversarial." But a stats-literate judge can construct it — call it out rather than be caught.

### H2 — Calibration is a free dial decoupled from the score (gameable)
- **Lens:** economic/mechanism-design · **Protocol severity:** High (undermines the headline product claim) · **Demo severity:** High (judge will probe)
- **Evidence (verified):** `RangeCrpsScorer.sol:50` — the `confidence` parameter is `uint16, /* confidence */`, **unused**; NatSpec line 45 states "confidence is unused by the CRPS computation." In `ScoringEngine.sol:141`, `bucketIdx = confidence / CONFIDENCE_PER_BUCKET` selects *which* calibration bucket updates, but the value written (`realizedScaled = (score+1e6)/2`, line 145) and the accuracy EMA (line 154) are **band-driven, confidence-independent**. `_calibration` (lines 193-213) penalizes `(bucketMidpoint − bucketAccuracyEMA)²` weighted by count.
- **The attack:** Stated confidence touches **only** calibration — never accuracy, never stake, never CRPS. An agent can report a *constant* confidence equal to its own long-run realized hit-rate; the single populated bucket's EMA converges to that bucket's midpoint, and calibration → ~0 (perfect) mechanically — **without ever expressing honest per-forecast uncertainty.** So the reasoner system-prompt claim "overconfidence harms calibration, underconfidence harms accuracy" is only *half* enforced: the accuracy half is real (a worse band lowers CRPS); the calibration half is not — a constant-reporter that nails its average is "calibrated but not sharp," and there is no sharpness requirement on confidence.
- **Impact:** Calibration — the headline "calibration-scored confidence" wedge — is farmable. The feed's confidence multiplier is inflated toward 1.0 for gamers, making the published confidence *less* informative than advertised. Honest agents who vary confidence per-forecast can score *worse* on calibration than a constant-reporter.
- **Honest judge-defense (lead with this):** "Calibration is a documented **CRPS-derived proxy**, not a strict per-event Brier decomposition (CLAUDE.md §3 invariant 10). It rewards stating a confidence that matches your realized accuracy *distribution* — which **is** what calibration means long-run. A constant-reporter that nails its hit-rate *is* well-calibrated; it just isn't *sharp*, and sharpness is captured separately by the band-driven accuracy/CRPS score." **Do not** present "overconfidence is penalized" as a hard guarantee. **Real fix (post-hackathon):** make the score (hence stake) a function of confidence via a proper scoring rule, so mis-stating confidence is penalized in EV.

### H3 — Wide-band safe-mediocre + feed midpoint-collapse discards width
- **Lens:** economic · **Protocol severity:** High · **Demo severity:** Medium
- **Evidence:** CRPS gives a near-domain-width band a mediocre-but-*positive, low-variance* score (it never eats the out-of-range deduction a tight wrong band takes). `CompositeFeed.sol:154-155` then collapses every contributor's `[low,high]` to `(low+high)/2` **before** aggregation (verified) — the band width (the one honest uncertainty signal) is thrown away. Two ensembles with wildly different agreement can publish the same confidence.
- **Impact:** Top-20 can fill with width-gamers who are never hard-slashed; the feed inherits their midpoint — for a domain-wide band, just "the middle of the domain" dressed as a forecast. A subscriber could be buying domain-midpoints. The deployed mETH domain `[0,100000]` bps is ~10× wider than realistic APR (already flagged in CLAUDE.md), which makes wide bands artificially cheap.
- **Defense:** "CRPS *does* penalize width (case-3 deduction grows with `b−a`), so a tight band centered on truth strictly beats a wide one **for a skilled agent**; width-gaming only wins for agents with no edge, and a subscriber can sanity-check a domain-midpoint against spot." **v2 fix:** surface band width / inter-agent dispersion as a feed field (already a CLAUDE.md v2 note); tighten the deployed domains so "wide" is genuinely costly.

### H4 — Sybil: 0.1 MNT is the only cost; top-20 and bonus pool are capturable
- **Lens:** economic · **Protocol severity:** High · **Demo severity:** High (obvious judge question)
- **Evidence (verified):** `AgentRegistry.register` charges `REGISTRATION_FEE = 0.1 ether` and binds one-controller-one-agent, but there is **no per-operator cap**. `topAgents` ranks purely by `accuracyScore`; the rank-weighted ensemble and the `score²·stake` bonus split have no diversity/operator constraint. On Mantle **Sepolia** (the deploy target) MNT is faucet-free, so the fee is ≈0.
- **Impact:** One operator can run the same good model under 20 identities, fill the entire top-20, turn the "ensemble" into one opinion ×20, and capture nearly the whole epoch bonus pool (fed by *others'* slashed stake). The calibration clamp at −0.5 bounds one *bad* agent's confidence drag — it does nothing against *correlated identical* agents capturing *value*.
- **Honest defense:** "The 0.1 MNT fee is a **spam deterrent + bonus-pool seed** (CLAUDE.md §3 invariant 12), not Sybil resistance. Sybil resistance for a forecasting oracle is known-hard; v1's neutrality rests on 'reputation is *earned* by resolved on-chain accuracy — a swarm still has to actually be good.'" **Real fixes:** per-operator caps on top-20 share, a correlation/diversity penalty in the ensemble, stake-weighted (not flat-fee) entry, a higher mainnet bond.

### H5 — Trust root is an owner-seeded mock oracle
- **Lens:** oracle-trust · **Protocol severity:** High (foundational) · **Demo severity:** High (the question you *will* get)
- **Evidence (verified):** `MockMethRateOracle.sol` (`setRate`/`setRates`/`setSynthetic`, all `onlyOwner`, owner = deployer) feeds `MethAprResolver`/`UsdyApyResolver`; `MockAavePool` (owner-seeded reserves) feeds the TVL resolver. The resolvers do correct pure arithmetic on whatever the oracle returns. There is no second source, no timelock, no on-chain provenance tying the rate to a real off-chain value.
- **Impact:** Whoever controls the oracle key controls every score, rank, feed value, and RWA recommendation. The pitch ("centralized leaderboards are the problem we solve") is undercut if the *resolver* is the centralized component.
- **The answer to give (honest and strong):** "Correct — in v1 the resolver is a mock, so the trust root is the oracle, **not us hand-picking winners**: the scoring, ranking, stake, and feed math are fully on-chain, deterministic, and **verifiable given any outcome**. `MethAprResolver` already implements the real APR formula (§7.3.1); productionizing is swapping one oracle *address* for a live mETH/Ondo/Aave read — not a redesign. The protocol is exactly as trustworthy as its resolver, and the resolver is designed to be a *permissionless on-chain read*, not a committee." **Do not** claim trustlessness while the mock is live — claim *verifiable-given-the-oracle* + a clear path to a live one.

### H6 — 17 deployed contracts are unverified on the explorer
- **Lens:** ops (judge-facing trust) · **Protocol severity:** N/A · **Demo/submission severity:** High
- **Evidence (verified):** `contracts/deployments/mantle-sepolia.json` lists 17 addresses; Mantlescan killed its V1 API and `forge --verify` failed. The README links straight to these addresses. For an on-chain protocol whose pitch is "verifiable on-chain," unverified bytecode reads as sketchy.
- **Fix:** verify via **Etherscan API V2** (`--verifier-url https://api.etherscan.io/v2/api` + V2 key) or **Sourcify** (`forge verify-contract --verifier sourcify`). Hours of work, no code risk, high credibility payoff — prioritize before submission. If time-boxed out, pre-empt verbally.

---

## 5. Medium

- **M1 — CRPS cube overflow for domain ≳1e24** (`RangeCrpsScorer.sol:95-97`, verified). `num = dya³ + dby³` then `SCALE*num`; for an in-band outcome with `D ≳ 1e24` this exceeds uint256 → `score()` reverts → `resolve()` reverts → those predictions can never resolve and **stake is stuck**. **All three deployed categories are safe** (AAVE TVL `D=1e17` sits at ~193/256 bits). It fails silently at config time (no guard rejects an unsafe domain). *Fix:* document a hard domain cap (~1e21) and guard it, or use mulDiv-512 / divide-before-cube.
- **M2 — Single-machine hosting + re-run foot-guns** (verified vs history). Bots/indexer die on sleep/terminal-close; PGlite exit-75 resets the leaderboard; the `0x`-prefix-missing key bug bit the deployer and all 4 bots and is undocumented in every `.env.example`; Ponder reads `.env.local` not `.env`; stale `resolver.state.json` cursor / `agent.state.json` seed-mode poison a fresh run after redeploy. *Mitigation:* commit fully to the snapshot demo with `NEXT_PUBLIC_INDEXER_URL` **unset**; for the data-grow burst, normalize keys in the config loaders, and `rm` the state files after any redeploy. (The SEED_MODE auto-flip *logic* is correct — one-directional, dual-trigger, returns 0 on indexer outage so it can't falsely flip.)
- **M3 — `CompositeFeed.refresh` has no caller incentive** (verified; PRD §7.5.3 admits it). The revenue-bearing artifact (feed freshness) is an unfunded cost borne by a team cron, while `resolve()` (2%) and `finalizeEpoch` (0.5%) *are* incentivized. *Roadmap framing:* route subscription revenue → a refresh keeper reward (or Chainlink Automation). This is the missing loop that makes it a business.
- **M4 — `finalizeEpoch` math diverges from PRD §7.2.4** (`BonusDistributor.sol:109-113`, verified). Code deducts both 5% rollover and 0.5% finalizer off the **raw** pool; PRD prose takes 0.5% off `(pool−rollover)`. Gap ≈ 0.0025% of pool — immaterial, but a careful judge cross-checking doc-vs-contract will spot it. Conservation holds (`finalPool + rollover + finalizerReward == rawPool`). *Fix:* reconcile the PRD to the code (raw-pool base, which is what's tested).
- **M5 — `CompositeFeed.read()` has no staleness signal** (verified). A never-refreshed category returns a zero forecast indistinguishable from a real zero; a naive consumer can act on stale/zero data with no on-chain alarm (refresh liveness is an off-chain cron). The struct *does* expose `lastUpdatedBlock`, and `DemoFeedConsumer.valueFresh` models the gate — so it's a documented consumer responsibility, not a bug. *Harden:* add `readFresh(cat, maxStale)` that reverts, or return a freshness bool.
- **M6 — Bonus weight `score²·stake` rewards capital** (`ScoringEngine.sol:232-237`, verified). A whale staking 10× earns ~10× the bonus for identical forecast quality — compounding the Sybil/whale incentive, since the pool is funded by others' slashes. *Decide:* is stake-weighting intended (skin-in-the-game) or should it be `score²` alone (pure-skill)? Either is defensible **if stated**.
- **M7 — No single prediction is EV-neutral** (`ScoringEngine._stakeSplit`, verified). The 2% resolver tax means even a perfect score returns only `0.98·stake`; break-even needs `score_norm ≈ +1.04` (unreachable). Honest forecasting is net-positive **only** via bonus claims — it's a redistributive *tournament*, not a per-prediction safe-stake game. *Don't tell judges "honest agents always get their stake back."* Frame it as intended selection pressure.

---

## 6. Low / Informational (document or defend; none are blockers)

- **L1** Excess/unbounded `msg.value` on `commit` becomes stake with no cap and no surplus refund (`PredictionMarket.sol:128,137`). Foot-gun for third-party integrators; the bots always send exactly `minStake`. *Make the "stake == msg.value by design" intent explicit in NatSpec, or add a cap/refund.*
- **L2** `cancel` after reveal leaves a stale `_latestRevealed` pointer; mitigated because the in-tree consumer re-checks `status == Revealed` (the interface documents the requirement).
- **L3** Controller-rotation re-checks `ControllerAlreadyBound` at execute — a benign race can brick a pending rotation (liveness only; the re-check is the *correct* invariant).
- **L4** `approve`/`setApprovalForAll` succeed on the soulbound NFT (transfers still revert via `_update`) — cosmetic dead approvals; override to revert if you want the invariant literally true.
- **L5** The Python reference scripts use floor `//` while Solidity truncates toward zero — they diverge by ≤1 unit on **negative** scores, so the "bit-exact" claim is false for losing predictions (committed vectors don't exercise it). *Fix the references or footnote it* — a judge re-deriving on a losing prediction would see a mismatch.
- **L6** `_bonusContribution` truncates to 0 for tiny stakes (documented floor-div).
- **L7** If `SubscriptionGate` is ever flipped to required, advisory reads (`YieldAllocator`/`RiskManager`/`DemoFeedConsumer`) would **revert** instead of returning a safe default — latent v2 foot-gun (v1 gate is open).
- **L8** `AaveMantleTvlResolver` assumes `aToken.decimals() == underlying decimals` and 8-dec oracle prices (true for Aave V3; undefended against a misconfigured reserve).
- **L9** Midpoint-collapse information loss (also H3) — the feed confidence is a reputation-weighted *claim*, not a measured agreement of the underlying bands.
- **L10** *Strength, not flaw:* never-reveal forfeits 100% (self-slashing), cancel costs 10%, spam never reaches the feed without earning top-20 — every griefing path costs the griefer more than the victim, and cleanup is bounty-incentivized (0.5%).

---

## 7. The hardest judge questions — and crisp honest answers

1. **"Your oracle is a mock you control — what makes this more trustworthy than the centralized leaderboards you criticize?"**
   → "The *outcomes* are mock-seeded in v1; the *scoring, ranking, stake, and feed* are fully on-chain, deterministic, and verifiable given any outcome — we can't hand-pick winners. `MethAprResolver` already implements the real APR formula; production swaps the mock address for a live mETH/Ondo read, no redesign. We're exactly as trustworthy as our resolver, and the resolver is a permissionless on-chain read by design."

2. **"Can an agent just always claim max confidence?"**
   → "Confidence doesn't touch your score or stake — only calibration, which is a documented CRPS-derived proxy. The optimal play is to state the confidence that matches your *realized* accuracy, which is exactly honest calibration. A liar who claims max confidence on inaccurate bands tanks calibration; a constant-reporter who nails their own hit-rate is calibrated-but-not-sharp, and sharpness is scored separately by accuracy. v2 folds confidence into a proper scoring rule so mis-stating it costs EV."

3. **"What stops one person running 20 bots to own the leaderboard?"**
   → "Nothing fully, in v1 — the 0.1 MNT fee is a spam deterrent and pool seed, not Sybil resistance. But a swarm still has to actually *be accurate* to rank, since reputation is earned by resolved on-chain CRPS. v2 adds per-operator caps and a correlation penalty so 20 identical forecasts don't count as 20 independent ones."

4. **"Why pay $500–$2,000/mo for your feed when I can read a spot oracle for free?"**
   → "Spot tells you *now*; we publish a *forward* 24h estimate plus a *calibration-scored* confidence a risk manager consumes to move collateral factors *before* conditions move — we show `YieldAllocator`/`RiskManager` reacting to our feed live. Honest caveat: no paying customer yet, and v1 calibration is a proxy; the value compounds as the track record grows."

5. **"Are these contracts verified? Can I read the source on-chain?"**
   → *(Have the answer be "yes" by submission.)* If not yet: "Deployed and source is in the repo; explorer verification is pending the Mantlescan→Etherscan-V2 migration — here's the address-to-source mapping."

6. **"Why is everything on the leaderboard 'calibrating' and the risk 'Frozen'?"**
   → "Calibration needs ≥10 resolved predictions per agent — we're at 2–4 and growing; 'Frozen' is the *safe default* for an unrefreshed feed, not an error. The numbers shown are real on-chain CRPS scores at block 39441549." *(Better: grow the data first so this question doesn't arise.)*

7. **"Is an honest agent's stake safe?"**
   → "It's a tournament, not a savings account — a 2% resolver tax means even a perfect forecast returns 98%, and average agents are net-negative on stake alone; the bonus pool redistributes from worse to better forecasters. That's the intended selection pressure toward good forecasting."

---

## 8. What's genuinely done right (don't undersell these)

- **Stake conservation is provably exact** — enforced by strict equality (`returnAmount + bonusAmount + resolverReward == stake`), resolver paid first, re-asserted in both `ScoringEngine` and `PredictionMarket`, backed by a conservation fuzz test. The v1 2%-overpay bug is genuinely fixed.
- **Pull-claim, zero-iteration bonus** — no loop over agents anywhere; the gas-DoS-at-scale failure mode is fully avoided. Fixed top-20 walks are the only loops, and they're bounded.
- **Reentrancy is closed off** — every value-moving function is `nonReentrant`, `reveal` is correctly *un*-guarded (no external call), and there's a real adversarial reentrancy test, not a claim.
- **Soulbound enforcement at the correct chokepoint** (`_update`), with a real two-step 24h controller-rotation timelock that rotates the authority handle without moving the NFT.
- **Outlier-resistant feed confidence** — per-agent calibration floored at −0.5 *before* averaging, empty-contributor set is zero-safe with no division.
- **Fail-safe RWA semantics** — `YieldAllocator` requires *both* feeds usable before allocating (the 100%-concentration bug is fixed and tested); `RiskManager` and `DemoFeedConsumer` default to Frozen / throttle-on / no-deposits under stale or zero data.
- **The cached-snapshot demo strategy is the single best ops decision** — it removes the entire flaky live stack (PGlite, RPC throttling, bot liveness) from the demo critical path, and the `gen-fallback` anti-stub guard *throws* rather than committing an empty-but-"live"-looking file.
- **Rank-based weighting correctly dodges the signed-softmax bug**; the resolver caller is provably insulated from the score; griefing is self-slashing.

---

## 9. Prioritized action list (before submission)

**Must-do (credibility / correctness):**
1. **Verify the 17 contracts** on Etherscan-V2 or Sourcify (H6). Highest credibility-per-hour.
2. **Add USDY to the refresher** (C2) — one line — then include it in the data-grow run.
3. **Grow resolvedCount ≥10/category**, then regenerate **both** snapshots against a PAYG RPC (C1). Clears "calibrating" + cold calibration, populates feed history, lifts "Frozen."

**Should-do (demo robustness):**
4. Ship Vercel with `NEXT_PUBLIC_INDEXER_URL` **unset** (deterministic snapshot/mock; no flaky live fetch) (M2).
5. **Bake the hero reasoning trace** (pre-generate + IPFS-pin) — no live LLM call at the booth.
6. Add a cached tier to `useFeedHistory`/`useSmartMoneyBands` so they don't silently serve unlabeled mock (C1).

**Nice-to-have (mainnet hygiene; defensible to defer):**
7. Fix rollover-stranding (H1) — force in-order finalize or add a sweep.
8. Guard the CRPS domain cap (M1); reconcile PRD §7.2.4 to the contract (M4); normalize `0x` keys + key state files by chainId (M2).

**Pure framing (no code):**
9. Rehearse the §7 answers — especially the oracle-trust (H5), calibration-proxy (H2), and Sybil (H4) ones. These are where the score is won or lost.

---

*Method note: 6 read-only specialist agents reviewed the clusters in parallel; the author independently re-read `BonusDistributor.sol`, `RangeCrpsScorer.sol`, `ScoringEngine.sol`, `refresher/src/config.ts`, and both snapshot JSONs to verify every High/Critical against source before inclusion. Findings the agents raised that did not survive verification were dropped. No code was modified.*
