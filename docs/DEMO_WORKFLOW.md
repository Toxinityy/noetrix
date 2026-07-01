# Noetrix — Live Demo Runbook
### "The benchmark league for on-chain AI agents" · Alpha & Data (Mirana Ventures) track
**Target 3:30 · hard cap 5:00 · read-only demo, no wallet writes needed on stage**

---

## 1. TL;DR

**One-liner:** *"Every AI agent claims alpha — we're the Turing Test that proves it, because every forecast is hash-committed on-chain before the outcome exists and graded on-chain against verifiable truth, where nobody can edit the scoreboard. We didn't build a contestant; we built the league, the scoreboard, and the referee."*

**The single money moment (Beat 2):** open the DeepSeek reasoner's profile, read the honesty banner aloud, then show its full reasoning trace — pinned to IPFS and anchored on-chain **before** the outcome existed — and let the judge independently verify it: the commit block is earlier than the resolution block on Mantlescan, and the pinned content is fetchable from any public IPFS gateway. Un-fakeable by construction.

---

## 1.5. ⭐ THE 2-MINUTE CUT (run this version)

The tight stage version. 4 beats, ≈120s. Everything below (setup, fallbacks, Q&A, kill-shots) still
applies — this is just what you say and click. **Pre-set the leaderboard to the `AAVE_MANTLE_TVL_24H`
tab** (reasoner #1 · ARIMA #2 · naive #3) and pre-open tabs 2/3/4 from the setup checklist.

**The one rule:** if a StatusPill says "snapshot"/"cached," read it aloud. Never call it "live." Never
imply `MNT_USD_SPOT` has resolved scores yet (it's deployed, but its track record is still accruing).

| t (mm:ss) | Do this | Say this (≈verbatim) |
|---|---|---|
| **0:00–0:18** · Hook | Land on `/terminal/leaderboard` (AAVE tab) | *"Every team here pitches 'AI alpha' with a backtest you can't reproduce. We built the opposite — the on-chain benchmark **league** that proves which AI forecasters are actually right, scored on-chain, un-fakeable. This is the live board."* |
| **0:18–0:48** · Real benchmark | Point down the column: naive → ARIMA → reasoner | *"It's a real benchmark because it has a control. Our naive baseline is deliberately dumb — and it loses to the statistical ARIMA agent, which loses to the DeepSeek reasoner. That ordering is skill, not luck. Every score is CRPS-graded on-chain — no self-reported numbers."* (if the pill says snapshot, say so) |
| **0:48–1:38** · 🎯 **MONEY MOMENT** | Click the top agent → `/terminal/agent/2`. Read the "Illustrative profile" banner aloud, show the reasoning trace → switch to the **IPFS** tab → switch to **Mantlescan `getPrediction(773)`** | *"Here's the proof, in two halves you can each check. This is the reasoner's actual reasoning — full prompt and forecast, pinned to IPFS and content-addressed, so I can't edit it. [IPFS] The bytes match the hash. [Mantlescan] And the track record is on-chain: agent 2 has 43 resolved mETH forecasts — here's one, committed at a block **earlier than its resolution block**, then CRPS-scored. A 200-block cutoff means it physically cannot see the answer and back-fit. No hindsight, no cherry-pick — verify any of them yourselves right now."* |
| **1:38–2:00** · Close / ask | Stay, or flip to `/terminal/agents` | *"Every other project is one AI making a claim. We're the league, the scoreboard, and the referee — we even grade one category against a **live Pyth price pinned on-chain**, verifiable truth, not our own oracle. It's on Mantle Sepolia today, 224 tests, open to any agent. That's the Turing Test for on-chain AI."* |

**Verify-it-yourself handles (say the judges can check these unaided):** IPFS `QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy` (the reasoning payload — content-addressed, the bytes match the CID) · Mantlescan PredictionMarket `0xaa92b0434F89a17F2275b655c6fA459C43813f22` → `getPrediction(773)` → **agentId 2**, status **Resolved**, commit block **40,106,259 < 40,149,456** resolution, non-empty contentHash + on-chain CRPS score (one of agent 2's 43 resolved mETH forecasts) · Pyth truth on **hermes.pyth.network**. *(The pinned IPFS trace is a real DeepSeek payload from an earlier seed run on a prior contract deployment; it demonstrates the reasoning format — the current-contract on-chain proof is the resolved track record above, not a byte-match to this specific CID.)*

**Bots-down safety:** the money moment (IPFS + explorer) needs neither our bots nor indexer. If a live surface is stale, name the pill and move on. **If you hit ~2:15, cut Beat 2's detail** (just say "naive loses to ARIMA loses to the reasoner — that's the benchmark") and protect the money moment.

**Recorded-video variant:** for a *recorded* 2-min cut (not live), use the shot-by-shot in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

---

## 2. The real-user persona + job-to-be-done

**Devi — Head of Treasury / Risk at a Mantle-native yield protocol.** (She is also the archetype of the Mirana-style allocator the judges represent: someone who must put capital or protocol parameters behind a signal and answer for it.)

**Her job-to-be-done, in her words:**
> "Every week another team pitches me 'AI alpha' — always a gorgeous backtest I can't reproduce and can't audit. Before I wire an AI forecast into my vault's risk parameters, I need proof the AI has actually been right, on data it *could not have seen in advance*, and that its track record is **impossible to fake.**"

Nobody sells Devi that proof today. That is the entire product. Keep repeating **league / scoreboard / referee** — it reframes every competitor as an input to be ranked, not a rival.

---

## 3. Pre-demo setup checklist (do this 10 minutes before)

**Decide your data path first.** From a terminal: `curl -s https://<APP_URL>/api/feed`
- `200` with `{"source":"chain",...}` → the on-chain read **succeeded**. This proves the read works, **not** that the data is fresh: bots can be paused and the value stale. Judge freshness by the returned `lastUpdatedBlock` / `value` and the on-screen `StatusPill` — **not** by the HTTP status.
- `502` → RPC/read error. `503` → feed address not configured. **Neither indicates bot state.**
- If the `StatusPill` reads "Live" and `lastUpdatedBlock` is recent, say "live on-chain read." Otherwise you're on the **snapshot path** (still real on-chain data, just not streaming) — say so.
- **Know which one before you walk up.** Never claim more than the on-screen `StatusPill` says.

**Open tabs in demo order** (avoid live nav fumbles):
1. `<APP_URL>/terminal/leaderboard`
2. `<APP_URL>/terminal/agent/2` (DeepSeek reasoner — the real pinned trace)
3. IPFS gateway open to the real trace: `https://ipfs.io/ipfs/QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy` (plus the Pinata fallback below)
4. Mantlescan on **PredictionMarket** `0xaa92b0434F89a17F2275b655c6fA459C43813f22` (chainId 5003)
5. `<APP_URL>/api/feed` (raw JSON) and `<APP_URL>/api/leaderboard` (raw JSON)
6. `<APP_URL>/terminal/feed/aave-mantle-tvl-24h`
7. `<APP_URL>/terminal/insights`
8. Optional deep-cut: a terminal in `contracts/` with `forge test --match-test test_Snapshot_ImmutableAgainstLaterPriceMoves -vvv` **staged but not run** (pre-run it once so the second run is warm)

**Setup rules:**
- **Pre-click past the `/terminal` boot animation** (`INITIALIZING…` sequence — don't burn demo seconds on it).
- **Set the leaderboard category tab to `AAVE_MANTLE_TVL_24H`** — the category where the ranking cleanly reads **naive < ARIMA < reasoner** (reasoner #1, ARIMA #2, naive #3), so "click the top-ranked agent" lands on the DeepSeek reasoner (`agent/2`) with the real pinned trace. (All three *live* categories have the naive control resolved; AAVE has the cleanest ordering. Do **not** demo `MNT_USD_SPOT` — it has no resolved history yet.)
- **Pre-verify the money moment (do NOT skip):** fetch the CID `QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy` from **both** `ipfs.io` **and** `dweb.link` and confirm the payload actually loads. If either hangs, keep the app's own gateway `https://gateway.pinata.cloud/ipfs/QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy` open as the fallback. Then on Mantlescan call **PredictionMarket → Read Contract → `getPrediction(773)`** and confirm it returns **agentId 2**, status **Resolved**, **commitBlock 40,106,259 < resolutionBlock 40,149,456**, and a **non-empty contentHash** — a real current-contract resolved forecast (verify on-chain rather than trusting the frontend). If you want a different example, any of agent 2's 43 resolved mETH ids works.
- **Read the `/terminal/insights` snapshot age** (top-right). If it shows the **warn/amber age badge (>24h)**, rehearse the line: "captured N days ago — the *scores are permanent on-chain*, this page just caches them for speed."
- Zoom the browser to ~110–125% so numbers and hashes read from across the room. Dark mode, notifications off, bookmarks bar hidden.
- **Wallet:** not required. `/terminal/pricing` is a real MNT tx but is labeled "For demo" and gates nothing in v1 — don't demo it live.
- **Backup:** a local folder of full-page screenshots of tabs 1, 2, 6, 7 in case the venue network dies entirely.
- **Do NOT plan a live wallet write.** Everything scores on read paths; a failed MetaMask popup is an unforced error.

**The one rule for the whole demo:** whenever the UI shows a snapshot pill or an "as-of block," **read it aloud.** Volunteering the caveat *is* the anti-scam pitch.

---

## 4. The demo arc

| t (mm:ss) | Slide / topic | On-screen action (exact route) | What the judge sees | Talking point | Proof / rubric column |
|---|---|---|---|---|---|
| 0:00–0:20 | Hook | Land on `/terminal/leaderboard` | A ranked terminal-style table of AI agents with Accuracy + Honesty scores | *"Devi runs treasury at a Mantle yield protocol. She's pitched 'AI alpha' constantly — always a backtest she can't reproduce. We built the neutral scoreboard she needs: an on-chain benchmark league for AI forecasting agents."* | Business (A-10), Ecosystem fit (A-10) |
| 0:20–1:05 | It's a real benchmark | On `AAVE_MANTLE_TVL_24H` tab, walk the field bottom→top (naive → ARIMA → reasoner); note the source pill + composite-feed widget | Naive baseline < ARIMA < DeepSeek reasoner; `StatusPill` "Live" or "On-chain snapshot @ block #…"; weighted composite value, contributors, confidence | *"A real benchmark needs a control. Our naive persistence baseline is deliberately dumb — and it loses to the statistical agent, which loses to the reasoner. That ordering is proof the ranking measures skill, not luck. Every score is CRPS-graded on-chain — no screenshots, no self-reported numbers."* | Insight value (B-15), Data source quality (B-15), Verifiability (B-15) |
| 1:05–2:05 | 🎯 **MONEY MOMENT** | Click the top-ranked reasoner → `/terminal/agent/2`. **Read the "Illustrative profile" banner aloud**, scroll to the featured trace. Switch to IPFS tab (`QmREF…3Wvy`), then Mantlescan (`getPrediction(773)`) | Full reasoning → forecast band + confidence, pinned + content-addressed on IPFS; and on-chain, one of agent 2's 43 resolved mETH forecasts whose commit block precedes its resolution block, CRPS-scored | *"This is the moment. Real reasoning, content-addressed on IPFS. And a real on-chain track record — 43 resolved forecasts, each committed **before the outcome existed**. The 200-block submission cutoff means the agent physically cannot see the answer and back-fit. And notice — we tell you ourselves which parts are demo-shaped. An honest benchmark says what it can't yet prove."* | **Verifiability & auditability (B-15)**, Technical (A-15), Innovation (A-10) |
| 2:05–2:45 | Why the scores can't be faked | Stay on agent page / flip to `/terminal/agents`; optionally Mantlescan | Machine-readable contract list + on-chain addresses; (optional) a real commit→reveal→resolve tx | *"The referee is deterministic and on-chain: commit a hashed [low,high] band, reveal in a bounded 10–100 block window, then CRPS grades against on-chain truth — 224 passing Foundry tests, resolver paid first, stake conservation asserted. Our newest data source grades against a live, Hermes-verifiable Pyth price — deployed on Sepolia: a keeper pins it once at the resolution block, first-write-wins, so an agent can't wait for spot to drift into its own band and self-resolve."* | Technical (A-15), Data source quality (B-15), Risk management (B-8) |
| 2:45–3:25 | The product Devi buys | Open `/api/feed` (raw JSON), then `/terminal/feed/aave-mantle-tvl-24h` | `{"source":"chain","value":…,"confidenceBps":…,"contributingAgents":…}`; contributor table weighted by rank + calibration | *"Here's what Devi wires into her vault: one calibration-weighted composite feed, read straight from chain, CORS-open so any protocol or agent can consume it. It's only trustworthy **because** the public leaderboard proves the agents behind it have been right before — the reputation is the product, the feed is the delivery."* | Investment utility (B-12), Investment potential (B-12), Ecosystem fit (A-10), Scalability (B-8) |
| 3:25–3:50 | Insight + out-of-sample backtest *(cut first if long)* | `/terminal/insights` → ProofStrip + BacktestPanel; read snapshot age aloud | "Top AIs vs crowd", "forecasts graded on-chain N", "landed in range M of N", explorer link; DefiLlama out-of-sample backtest | *"Beyond the live league, we backtested six strategies on real DefiLlama history — proper train/test splits, CRPS-graded — with an inter-agent error-correlation matrix proving the agents are genuinely diverse, not the same bet six times."* | Insight value (B-15), Data source quality (B-15), Scalability (B-8) |
| 3:50–4:15 | The closing ask | Return to `/terminal/leaderboard` | The scoreboard | *"We're the benchmark league — the Turing Test — for on-chain AI agents on Mantle. Un-fakeable because forecasts are committed before the outcome and graded on-chain against verifiable truth. **Our ask: help us onboard the first cohort of agents and the first protocol to consume the feed. Point every 'AI alpha' team here — to get ranked, not just to get pitched.**"* | Business (A-10), Ecosystem fit (A-10), UX (A-5) |

**Timing:** ~4:15 with a comfortable buffer to the 5:00 cap. If running long, cut the insights beat (3:25–3:50) first; the arc still lands. If very short on time, Beats 0–2 alone (leaderboard → agent/2 → IPFS + explorer) are self-sufficient and survive any outage.

---

## 5. The MONEY MOMENT (expanded)

**Exactly what to do (60 seconds):**
1. From the leaderboard (on the `AAVE_MANTLE_TVL_24H` tab), click the top-ranked agent → lands on `/terminal/agent/2` (DeepSeek reasoner).
2. **Read the "Illustrative profile" banner aloud, verbatim in spirit:** *"I'll be upfront — the reputation radar and equity curve on this page are demo-shaped, pending the hosted indexer. But the reasoning trace I'm about to show you is a **real, on-chain, pinned forecast.**"*
3. Scroll to the featured reasoning trace. Point at the chain-of-thought → the committed `[low, high]` band → the confidence.
4. Switch to the IPFS tab (`QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy`): *"This exact prompt, reasoning, and forecast is content-hashed and pinned. It's content-addressed — the bytes match the CID, so I can't silently edit it."*
5. Switch to Mantlescan (PredictionMarket → `getPrediction(773)`): *"And here's the on-chain track record — agent 2, one of 43 resolved mETH forecasts, its commit block earlier than its resolution block, then CRPS-scored. Every forecast provably predates its outcome."*

**The line to land, then pause:** *"There is no hindsight, no editing, no cherry-pick. That is a track record you cannot fake."*

**The independent verification a judge can do, unaided, right now:**
- **IPFS:** paste `QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy` into a public gateway (ipfs.io or dweb.link — both pre-checked before the demo) and read the raw prompt + forecast themselves; if a public gateway is slow, the app serves it via its own Pinata gateway. Either way it's content-addressed — the bytes match the hash, and it's not something we can silently edit.
- **Explorer:** on `sepolia.mantlescan.xyz`, call PredictionMarket `getPrediction(773)` (or any of agent 2's 43 resolved mETH ids) and confirm agentId 2, status Resolved, a non-empty contentHash, and commit block < resolution block. Recompute the CRPS grade from the committed band and the resolved truth — the scoring is deterministic and open.
- **Oracle truth (mechanism):** for the Pyth spot category, re-verify the MNT/USD price for feed `0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585` directly at **hermes.pyth.network** — the truth source is Pyth's own signed endpoint, not an oracle we control.

**Why this is the peak:** it fuses the two things no competitor has together — the *reasoning is visible* AND it was *committed before the outcome and content-hashed*. It also relies only on IPFS + the explorer, so it **survives every bot being down.**

**Optional visceral add (deep-cut, if the room is technical and you have 20s):** run the staged `forge test --match-test test_Snapshot_ImmutableAgainstLaterPriceMoves -vvv`. It **records a Pyth price at $0.80, lets the live price drift to $4.00, and still grades the pre-committed band at the pinned $0.80** — the "wait for the outcome, then grade yourself a winner" exploit, closed in code and proven green.

---

## 6. Fallback plan (per risky beat)

The core arc is engineered to survive a full bot/indexer outage — the money moment and the mechanism proof are on-chain / IPFS / test artifacts that are not ours to break.

- **Leaderboard pill isn't "Live" (Beat 0–1):** *"Our bots run on a host and I've paused them for a clean demo — this is the last committed on-chain snapshot. The scores are permanent on-chain; only the auto-refresh is off."*
- **Agent page / app sluggish (Beat 2):** go straight to the IPFS gateway tab and the Mantlescan commit — the raw pinned artifact and the on-chain transaction are always available with zero dependency on our frontend or bots. (If a public IPFS gateway hangs, use the Pinata fallback URL.)
- **`/api/feed` errors or reads stale (Beat 4):** a `502` is an RPC error and `503` means the feed address isn't configured — **neither is caused by paused bots**; paused bots just make the value *stale* (the StatusPill will say so). Either way: *"The live read is off / stale — but notice the feed page **hides the chart rather than draw fake data.** The `/api/leaderboard` snapshot always returns; here's the machine interface instead."* Then show `/api/leaderboard`.
- **Insights shows the warn/amber age badge (>24h) (Beat 5):** read the age aloud; the scores are permanent on-chain, the page caches them for speed. The BacktestPanel is a build-time artifact and always renders.
- **Venue network dies entirely:** narrate over the screenshot backup folder; open one Mantlescan tab from a phone hotspot to prove a single commit hash is real.
- **Turn the outage into the pitch:** *"The fact that we **label** stale data instead of faking a live number is exactly the trust property a data buyer is paying for."*

**Never say "live" when the pill says "snapshot."** `MNT_USD_SPOT` **is** deployed on testnet — but it has no *resolved* track record yet, so never imply it already has graded scores. A single falsifiable claim on stage costs more than any dropped feature.

---

## 7. Competitive kill-shots (contrast, never disparage)

Deploy only if a judge names a competitor. Frame each as "they're a contestant, we're the league."

- **OnChain Radar** (mainnet, grades raw on-chain data, no oracle): *"Great at reading what already happened. We grade a forecast **committed before it happens** — that's the difference between a dashboard and a track record — and we price it against a live Pyth oracle, not just historical state."*
- **Mensa** (clean, legible backtest / allocation): *"A backtest is a claim about the past you can't reproduce. Ours is a forward, hash-committed record — un-cherry-pickable — plus a real out-of-sample backtest on top. We concede the allocation lane; we own the proof lane."*
- **OFT Sentinel** (signal/analytics): *"They produce signals. We produce a **verifiable reputation for whoever produces signals** — including them. Any signal shop can register an agent and climb our leaderboard."*
- **The Read** (analytics/intel): *"Signals are only as trustworthy as the record behind them. Ours is un-fakeable by construction — 200-block submission cutoff, bounded reveal window, first-write-wins keeper snapshot — with every agent's reasoning hash-committed to IPFS."*
- **Universal line:** *"Everyone here is a single AI making a claim. We're the only one whose entire product is proving whether those claims are any good — with a naive control baseline so you can see the skill floor."*

---

## 8. Anticipated judge Q&A (honest answers)

- **"Is the feed / this actually live right now?"** — "The contracts and the graded predictions are live on Mantle Sepolia. The off-chain indexer and bots run on a host and I've paused them for a clean demo, so several 'live' surfaces show a committed on-chain snapshot — clearly labeled. `/api/feed` reads on-chain live when the bots are running; when they're not, the on-chain read still succeeds but the value is stale — you can tell from the StatusPill / `lastUpdatedBlock`, not the HTTP status. The proof artifacts — commits, CRPS grades, the pinned reasoning — are permanent regardless."
- **"Is the subscription real?"** — "Paying is a real on-chain MNT transaction today (0.5 MNT individuals / 2 MNT protocols, 30 days), but the gate is **intentionally open in v1** — it's architectural proof of the revenue rail, not enforcement. Gating reads on an advisory feed before there's a deep track record is a footgun; we flip it once the record earns it."
- **"Only testnet?"** — "Yes, Mantle Sepolia (chainId 5003), deliberately. The operating cost that matters is mainnet resolution gas, so v1 proves the full pipeline on testnet — commit-reveal, on-chain CRPS, composite feed, keeper-verified Pyth. Mainnet is the roadmap, not a rewrite."
- **"Only 2–3 agents — is that a benchmark?"** — "The *structure* is the benchmark: a naive control that measurably loses to a statistical agent that loses to the reasoner, all CRPS-graded on-chain. Adding agents is one config entry each; registration is permissionless. The leaderboard is the same code at 3 agents or 300. I'll be exact: the reasoner and ARIMA are graded across categories, and the naive control has resolved history across all three live categories (~20 each) — with more strategy agents already in the backtested field."
- **"Is the Pyth live-price category deployed?"** — "Straight answer: **yes** — it's deployed and registered on Mantle Sepolia (PythSpotResolver `0x5CEa…5fF4`, registered on ResolutionEngine, PredictionMarket, and CompositeFeed). It's fully tested — over 30 tests, including the drift-exploit test. The honest caveat is it has **no resolved track record yet**: agents forecast it on a synthetic seed, so scores are still accruing. The truth source is Hermes-verifiable Pyth, pinned by a first-write-wins keeper snapshot — that's the part that matters, and it's live in the suite and on-chain today."
- **"What stops an agent self-resolving into its own band?"** — "The keeper pins the Pyth price **once** at the resolution block, first-write-wins, so resolution is caller- and timing-independent (`MAX_AGE` 120s, confidence gate 5%). And `voidExpired` refuses to void anything still resolvable, so you can't dodge a slash on a loser. Both are tested."
- **"How does 'Honesty' / calibration work — is it real Brier?"** — "It's a CRPS-derived calibration proxy — a per-confidence-bucket EMA with α=0.1 — and we name it honestly as a proxy, not strict Brier decomposition. Overconfidence and underconfidence both cost you rank, so you can't game the accuracy score by narrowing bands."
- **"Why should a fund pay for this vs. building their own?"** — "Because trust here is a network effect. A single fund can't produce an independently verifiable, pre-committed, multi-agent track record. The value is the un-fakeable scoreboard, and it compounds as more agents compete — time is the moat, and a back-dated record is impossible."

---

## 9. Honesty ledger (so the presenter never overclaims)

**LIVE / permanent on-chain (claim freely):**
- All contracts on Mantle Sepolia (chainId 5003): AgentRegistry `0x5B15…3396`, PredictionMarket `0xaa92…3f22`, ResolutionEngine `0xBB62…B825`, ScoringEngine `0x8993…F517`, RangeCrpsScorer `0xDf39…6487`, CompositeFeed `0x695a…B689`, plus MethApr/AaveTvl/UsdyApy resolvers + SubscriptionGate.
- **MNT_USD_SPOT Pyth spot category is deployed + registered** on Mantle Sepolia (PythSpotResolver `0x5CEa…5fF4`; register txs confirmed on ResolutionEngine, PredictionMarket, and CompositeFeed) — Hermes-verifiable truth. Caveat: no *resolved* track record yet (agents forecast it on a synthetic seed; `/api/feed`'s valid set is still METH/USDY/AAVE, so it 400s for MNT_USD_SPOT).
- Commit-reveal-before-outcome, on-chain CRPS scoring, reputation/leaderboard — all real, immutable.
- Agent #2 (DeepSeek) IPFS-pinned reasoning payload `QmREF…3Wvy` — real, content-addressed (verify via a public or the Pinata gateway) — plus agent 2's 43 resolved mETH forecasts on the current contract (e.g. `getPrediction(773)`), independently verifiable on-chain. (The pinned trace itself is from an earlier seed run on a prior deployment; it shows the reasoning format, while the live track record is the current-contract proof.)
- 224 passing Foundry tests (over 30 on the Pyth resolver, incl. `test_Snapshot_ImmutableAgainstLaterPriceMoves`).
- Real DefiLlama out-of-sample backtest: mETH 896 / AAVE 103 / USDY 124 resolved, 6 agents, correlation matrix.
- `/api/feed` performs an on-chain read whenever RPC + feed address resolve (`200` `source:"chain"`); freshness depends on the bots — judge it by `lastUpdatedBlock` / StatusPill, **not** the HTTP status. `/api/leaderboard` and `/.well-known/agents.json` always up (committed snapshot / static).
- Subscription `subscribe()` is a real payable on-chain tx.

**SNAPSHOT / demo-shaped (label out loud; never call "live"):**
- Leaderboard / insights when the pill says "On-chain snapshot" or "Cached" — real on-chain data, not streaming; may be up to 24h old (warn/amber age badge past 24h).
- `/terminal/agent/[id]` reputation radar, equity curve, and every agent *except #2* — illustrative (the page says so). Agent #2's featured trace is real.
- `/terminal/simulation` falls back to demo values (mETH 3.8% / USDY 5.0% / 43-57 alloc / risk Normal) if contracts aren't wired.
- `MNT_USD_SPOT` has no resolved history for any agent yet (track record accruing) — don't imply it has graded scores, and don't imply full 3-agent parity on any category where the field is thin.

**ROADMAP (state as "next," never as done):**
- MNT_USD_SPOT Pyth category is **deployed + registered** on Mantle Sepolia (resolver `0x5CEa…5fF4`); what's "next" is its first *resolved* rounds — agents forecast it on a synthetic seed today, so the track record is still accruing (and `/api/feed` doesn't serve it yet).
- Hosted indexer + always-on bots (so surfaces stream live instead of snapshot).
- Enforcing the subscription gate; mainnet deployment; first protocol consuming the feed.

**North star:** un-fakeable because *committed before the outcome, graded on-chain against verifiable truth.* The money moment is Beat 2. Cut the insights beat first if long. Never claim a surface is live when its pill says snapshot; never claim MNT_USD_SPOT has a resolved track record yet (it's deployed on Sepolia, but scores are still accruing).
