# Proof-first `/insights` — investor/judge intelligence surface

**Date:** 2026-06-02
**Status:** Approved (design), pre-plan
**Branch base:** `insights-pixel-gradient` (local-only)
**Supersedes scope of:** extends the shipped `/insights` from `2026-06-01-alpha-data-insights-and-narration-design.md`

---

## 1. Context

`/insights` already ships (Tasks 1–14, committed): 4 cards (SmartMoney centerpiece, ConsensusBand
chart, NotableMove, TopPerformers) over pure fns in `lib/insights.ts`, category-tabbed, Web2
plain-English framing, with narration on agent pages. It currently runs on **demo/mock** data unless a
live indexer is configured.

This work **extends** that page into an investor/judge-facing proof surface, without standing up new
hosting (deployment remains postponed).

## 2. Goals & audience

Reframe `/insights` so a reader can answer, in priority order:

1. **Hackathon judges / VCs** (primary) — *Is the alpha real and fundable?* Wants proof, verifiability,
   defensibility.
2. **Protocol integrators** (secondary) — *Is the signal good enough to pay for?* Wants signal quality,
   freshness, productized-alert vision.
3. **Web2 retail** (tertiary) — *Should I trust this with my money?* Plain English, no jargon.

UI/UX quality stays high throughout (Best UI/UX award is in play). Primary track = **Alpha & Data**
(smart-money tracking + anomaly detection); these extensions map directly to that.

## 3. Hard constraints (load-bearing decisions)

- **Real on-chain numbers, no new hosting.** Numbers come from the live Mantle Sepolia contracts (the
  ~10 real resolved predictions, real CRPS grades, real reputations), captured via a **build-time chain
  snapshot** script → committed JSON the page serves. No indexer/Railway/Vercel hosting commitment.
- **Data is thin.** ~10 total resolutions across 3 categories (~3–4 each) + a handful of feed refreshes.
  Every aggregate stat MUST use honest *N-growing* framing (e.g. "3 of 4 so far"); never imply a large
  sample.
- **Outcome oracle is seeded.** The mETH/USDY rate oracles are synthetic curves for the demo. So
  **forecasts and on-chain grading are 100% real**, but the "reality" they're graded against is
  demo-seeded until v2 reads live Ondo/mETH. This caveat is stated plainly in the methodology footer.
- **No bps/CRPS/feed jargon shown to end users.** Web2-legibility remains a requirement on every surface
  (CRPS may appear as "graded 0.99/1.0 on-chain" but not as the literal acronym in the primary copy).

## 4. Page structure (top → bottom = judge reading order)

### §0 Header *(keep, retune)*
Same hero copy ("What the AIs are seeing, in plain English."). The Demo/Live `StatusPill` gains a
caption `snapshot @ block N · <date>` when serving snapshot data, so judges see it is real on-chain
data as-of a block.

### §1 Proof strip *(NEW — the judge hook, top of page)*
Three stat tiles + a verifiability line:
- **Top AIs vs crowd accuracy** — mean accuracy of the top-3 qualified agents vs the crowd mean,
  expressed as "X% more accurate." From reputations.
- **Forecasts graded on-chain** — count of resolved predictions + "every grade independently
  verifiable."
- **Track record** — smart-money-closer-than-crowd hit rate "k of N" with *N-growing* framing.
- **Verifiability line** — "Computed from Mantle Sepolia @ block N · contracts <explorer links>."

### §2 Forecast-vs-reality replay *(NEW — visceral proof, demo peak)*
For each resolved prediction (a handful): a compact viz showing the **predicted band** [low, high] as a
shaded region, the **actual outcome** as a dot/line, the on-chain **grade chip**, and the agent. Plain
sentence: "AI predicted 2.9–3.0%; actual landed 2.99%; graded 0.99/1.0 on-chain." Works with 3–4 real
examples. This is the demo peak.

### §3 Smart money vs crowd *(keep + extend)*
Keep existing `SmartMoneyCard` + `ConsensusBandCard`. Add a **biggest-disagreement** callout: where the
top AIs split hardest (highest dispersion) = the highest-opportunity/risk metric. Backed by a new
`biggestDisagreement` pure fn.

### §4 Anomaly feed *(NEW — literal Alpha & Data track fit)*
A timeline list of detected anomalies derived from feed history: "Unusual: Aave TVL −4% in ~1 day,
flagged @ block N." Plus **one alert-preview card** styled like a Telegram/Discord message
("🔔 noetrix alert: …") to make the productized anomaly-bot concrete for integrators. The alert card is
explicitly labeled a product mock; the anomaly timeline itself is computed from real feed deltas.

### §5 "Your move" strip *(NEW — actionable; integrators + retail)*
Three elements:
- **Risk monitor** — per-category Normal / Caution / Frozen, from `RiskManager` (or derived from
  confidence + freshness if the read is unavailable).
- **AI allocation suggestion** — the split across mETH / USDY / Aave from `YieldAllocator`.
- **Daily AI briefing** — one narrated plain-English paragraph digesting the findings (reuse the
  narration path; may be a snapshot-baked string to avoid a live LLM call on render).

*Heaviest section to wire (two extra contract reads). If time-constrained it degrades gracefully to the
elements that read cleanly.*

### §6 Methodology footer *(expand existing)*
Keep the existing "how this works" block. Add: the **seeded-oracle honesty caveat**, the snapshot
**block + date**, and **contract + sample-tx explorer links**. This is what makes the proof defensible
under a skeptical judge's questioning.

## 5. Data layer

### Snapshot script
`frontend/scripts/gen-insights-snapshot.ts` — sibling of `gen-fallback.ts`. Reads chain via **viem**
using addresses from `contracts/deployments/mantle-sepolia.json` and an RPC URL from env. Produces a
committed `frontend/public/insights-snapshot.json`:

```jsonc
{
  "generatedAt": "<ISO>",
  "chainId": 5003,
  "block": <number>,
  "source": "chain",            // or "mock" when run without RPC, clearly labeled
  "categories": {
    "METH_APR_24H": {
      "reputations": [ /* {agentId, accuracy, calibration, resolvedCount} */ ],
      "predictions": [ /* {id, agentId, band:{low,high}, confidence, status, score, outcome, blocks} */ ],
      "feedHistory": [ /* {block, value, confidence, contributors} */ ],
      "risk":       "Normal|Caution|Frozen",
      "allocation": { "meth": <bps>, "usdy": <bps>, "aave": <bps> }
    }
    // …USDY, AAVE
  }
}
```

The snapshot stores **raw inputs only** (reputations, predictions w/ outcome+score, feedHistory, risk,
allocation). Derived views (anomalies, replay rows, track-record, disagreement) are computed at render
time by the tested pure fns in §5 — single source of math, no duplication between script and fns.

Reads required (all already on-chain per CLAUDE.md addresses):
- `PredictionMarket.nextPredictionId` + `getPrediction(id)` loop → bands, confidence, status, score, blocks.
- Per resolved prediction, call the category **resolver view** at its `resolutionBlock` → actual outcome
  (enables replay + track-record). Deterministic against the seeded oracle.
- `AgentRegistry` reputations per agent/category.
- `CompositeFeedRefreshed` event logs (`eth_getLogs`) → feed time-series for anomaly/consensus.
- `RiskManager` state + `YieldAllocator` allocation (best-effort; degrade if unavailable).

Run before the demo; re-runnable. Falls back to a clearly-labeled mock snapshot if no RPC.

### Hook + tiering
- New `useInsightsSnapshot()` in `lib/hooks.ts` loads `public/insights-snapshot.json` (load-once,
  cache-forever, like `useFallbackLeaderboard`).
- Page tiering for the **new** proof features: live indexer (if ever configured) → snapshot → mock.
  Snapshot is the real tier for everything the indexer REST API does not serve (replay, anomalies,
  track-record, risk, allocation).
- Existing cards keep their current `useLeaderboard`/`useFeedHistory`/`useSmartMoneyBands` tiering.

### New pure fns (TDD in `lib/insights.ts`)
- `signalTrackRecord(predictions, feedHistory)` → `{ hits, total, ratePct }` (smart-money-closer-than-crowd).
- `topVsCrowdAccuracy(reputations)` → `{ topMean, crowdMean, pctMoreAccurate }`.
- `anomalyTimeline(feedHistory, thresholdPct)` → `Anomaly[]`.
- `biggestDisagreement(bands, crowdValue)` → `{ spreadPct, agentsHighLow }`.
- replay shaping helper (band + outcome + score → view model).
All deterministic, unit-tested; reuse existing `smartMoneyDivergence`, `uncertaintyLevel`,
`notableMove`, `topPerformers`, `topFinding`.

## 6. Components (new)
Under `frontend/src/app/(app)/insights/`:
- `ProofStrip.tsx` (§1)
- `ReplayCard.tsx` (§2)
- `DisagreementCallout.tsx` (§3 addition)
- `AnomalyFeed.tsx` + `AlertPreview.tsx` (§4)
- `YourMoveStrip.tsx` (§5)
- methodology footer = expand the existing block in `InsightsClient.tsx`

Reuse existing UI primitives (`Panel`, `StatusPill`, `Skeleton`, `CategoryTabs`, `EmptyState`,
Recharts patterns from `ConsensusBandCard`). No new design system; terminal-core aesthetic preserved.

## 7. Honesty / non-goals
- No fabricated aggregate numbers — all from chain; *N-growing* framing on every aggregate.
- Outcome-oracle seeding stated in the footer; do not imply the seeded curve is live market data.
- Not standing up the indexer / Railway / Vercel / demo video / submission reframe (still postponed).
- Not adding new categories or contracts.
- The alert-preview is a product mock, labeled as such; not a live integration.

## 8. Testing & verification
- `vitest`: unit tests for each new pure fn in `insights.ts` (TDD).
- Run `gen-insights-snapshot.ts` once against chain; verify it emits a valid, real JSON (non-empty
  predictions/reputations) and commit the snapshot.
- `pnpm --filter frontend lint` clean; `build` green (new route stays static + `/api/narrate` ƒ).
- Existing Playwright 375px smoke covers `/insights` (no horizontal overflow).

## 9. Phasing
You approved all four directions, so all sections are in scope. Build order (lowest risk → highest):
1. Snapshot script + `useInsightsSnapshot` + new pure fns (foundation).
2. §6 methodology footer expand (cheap, high-trust).
3. §1 proof strip.
4. §2 replay (demo peak).
5. §3 disagreement callout.
6. §4 anomaly feed + alert preview.
7. §5 your-move strip (heaviest; degrade gracefully).

**Irreducible core** if time runs short: 1 + 2 + 3 + 4 (snapshot, footer, proof strip, replay).

## 10. Implementation note
`frontend/AGENTS.md` warns this Next.js build has breaking changes vs. training data — read the
relevant guide in `node_modules/next/dist/docs/` before writing route/page code.
