# Demo video script — Predictor Index

> **For the live pitch-deck presentation, use [`DEMO_WORKFLOW.md`](./DEMO_WORKFLOW.md)** — the sharpened,
> fact-checked live-demo runbook (benchmark-league framing, live-Pyth money moment, per-beat fallbacks,
> Q&A, honesty ledger). This file remains the shorter 2-min *recorded video* script.

**Target: 2:00 · hard cap 2:30.** Record with OBS or Loom at 1920×1080, 30fps. Cursor visible.
Speak in short, confident sentences. Pre-load every tab before recording so nothing waits on a spinner.

> Reusable one-liner: *"On-chain AI forecasting benchmark for Mantle — agents ranked by verifiable accuracy, protocols subscribing to the ensemble feed."*

---

## Pre-record setup (do not film)

- Indexer live, frontend on its public URL, both agents have ≥50 resolved predictions, composite feed refreshed in the last few minutes.
- Tabs open in order: `/` (landing), `/leaderboard`, `/agent/<deepseek-id>`, `/feed/meth-apr-24h`, `/demo-consumer`.
- Wallet connected (for the manual refresh beat). Mantlescan tab open on the deployed `CompositeFeed` for one quick cut.
- Mute notifications. Dark mode (default).

---

## 0:00–0:30 — Problem

**On screen:** Landing hero (`/`) — kinetic "PREDICTOR INDEX" title, the live composite-feed pulse.

**Voiceover:**
> "AI forecasting agents are everywhere — trading bots, yield predictors, risk models. But you can't trust any of them. Their track record is a screenshot, their reasoning is a black box, and nothing is verifiable.
> Predictor Index fixes that. Every AI agent here has an on-chain identity, every prediction is committed on-chain before the outcome is known, and every score is computed from verifiable truth."

**Shot list:** slow scroll through the hero into the live-pulse section. Let the reasoning-trace reveal flash by (~2s) as a teaser.

**Key phrases:** "can't trust any of them," "committed on-chain before the outcome is known," "verifiable."

---

## 0:30–1:30 — Walkthrough (the core minute)

### 0:30–0:50 — Leaderboard
**On screen:** `/leaderboard`. Composite feed snapshot card on top; sortable agent table.

**Voiceover:**
> "This is the leaderboard. Each row is an ERC-8004 soulbound agent, ranked by accuracy and calibration — both derived on-chain from CRPS scoring. Agents under ten resolutions are flagged 'calibrating'. Up top, the composite feed: the reputation-weighted consensus of the top agents, updating live."

**Shot list:** click the Accuracy header to sort; hover a row; point at the "calibrating" badge; point at the composite value ticking.

### 0:50–1:15 — Agent detail + reasoning trace (THE moment)
**On screen:** `/agent/<deepseek-id>`. Scroll to the **Reasoning** panel.

**Voiceover:**
> "Click into the DeepSeek agent. Identity NFT, reputation radar, calibration buckets — all on-chain. But here's the part that matters: the reasoning trace. For every forecast, DeepSeek's full chain of thought — framing, the data it pulled, its inference, the final range and confidence — is pinned to IPFS and hash-committed on-chain. This isn't a screenshot. You can verify the agent said exactly this, before the outcome was known."

**Shot list:** land on the featured "REASONING →" panel; scroll the 4-step trace slowly; pan to the JSON payload code-block; hover the IPFS content link.

**Key phrases:** "full chain of thought," "pinned to IPFS and hash-committed," "before the outcome was known."

### 1:15–1:30 — Composite feed → demo consumer
**On screen:** `/feed/meth-apr-24h` briefly, then `/demo-consumer`.

**Voiceover:**
> "All of these agents feed one number: the composite forecast. And any Mantle protocol can read it. Here's an example consumer contract — it reads the feed and makes a decision: allow deposits when the mETH APR forecast clears its floor, throttle risk when TVL drops. One on-chain call, no oracle middleman."

**Shot list:** feed history chart (1s), cut to `/demo-consumer`; point at the two decision cards (true/false); click **Refresh feed now** → show the tx confirm → value updates.

---

## 1:30–2:00 — Pitch

**On screen:** back to `/leaderboard` (or a split of leaderboard + reasoning).

**Voiceover:**
> "So that's Predictor Index: AI agents with on-chain identities, forecasts scored against verifiable truth, reputation they earn and can't fake, and a consensus feed protocols pay to consume. It's the Turing Test hackathon's thesis made real — every AI decision, on-chain.
> Agents register today. Protocols subscribe today. And Mantle is the canonical home for verifiable AI forecasting. Thanks for watching."

**Shot list:** slow zoom on the leaderboard; end card with project name + live URL + GitHub.

**Key phrases:** "reputation they earn and can't fake," "every AI decision, on-chain," "Mantle is the canonical home."

---

## End card (hold 3s)

```
PREDICTOR INDEX
On-chain AI forecasting on Mantle
<live URL>   ·   github.com/Toxinityy/mantle-hackathon
Track: AI Alpha & Data
```

## Editing notes

- Cut dead air between beats; keep momentum. Target a cut every 4–8s.
- Caption the three key phrases as lower-thirds.
- If over 2:00, trim the feed-history beat (1:15–1:18) first; protect the reasoning-trace beat.
- Music: low, sparse, electronic. Duck under voiceover.
