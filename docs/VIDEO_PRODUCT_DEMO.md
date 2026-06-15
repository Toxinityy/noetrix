# Video 1 — Product Demo shot list & VO

**Concept:** *"The AI track record you can actually verify."*
**Length:** target 1:40 (hard cap 2:00) · **Format:** voiceover + screen capture, cinematic cuts.
**Record:** OBS or Loom, 1920×1080, 30fps, cursor visible. Dark mode (default). Mute notifications.
**One-liner:** *"On-chain AI forecasting index on Mantle — agents commit forecasts before the outcome exists, the chain grades them, protocols subscribe to the consensus."*

> Brand: **Noetrix** (product) / Predictor Index (protocol). Use "Noetrix" on screen and in VO.

---

## Pre-record setup (do NOT film)

- Frontend on its public URL (or `pnpm --filter frontend dev` if filming local).
- **Feed fresh + non-zero:** restart the bots so ≥1 prediction per category is `Revealed` and `CompositeFeed.refresh` ran in the last few minutes. If you can't run bots, film against the committed snapshot — `/terminal/insights` and `/terminal/leaderboard` are honest about "on-chain snapshot."
- Both reference agents (ARIMA id1, DeepSeek id2) have resolved history; the DeepSeek agent has a **reasoning trace pinned to IPFS** on its latest forecast (this is the money shot — confirm the IPFS link resolves before filming).
- Wallet connected (injected, Mantle Sepolia) for the `/terminal/demo-consumer` refresh beat.
- Tabs pre-loaded in order so nothing waits on a spinner. **Navigate directly to `/terminal/*` routes** — the bare `/leaderboard` etc. redirect, which flashes on camera:
  1. `/terminal` (boot)
  2. `/` (landing hero)
  3. `/terminal/leaderboard`
  4. `/terminal/agent/2` (DeepSeek)
  5. `/terminal/demo-consumer`
- Open a Mantlescan tab on the deployed `CompositeFeed` for one optional 1s cut.

---

## Shot list

| # | Time | Route / on screen | Action (clicks / camera) | Lower-third caption | Voiceover |
|---|------|-------------------|--------------------------|---------------------|-----------|
| 1 | 0:00–0:08 | `/terminal` boot | Hard cut from black. Let `INITIALIZING…` resolve into the dashboard. Hold 1s. | — | *"Every AI forecaster shows you a track record. None of them can prove it."* |
| 2 | 0:08–0:22 | `/` landing hero | Slow scroll through the kinetic title into the live composite-feed pulse. | **Noetrix · on-chain AI forecasting** | *"Noetrix is the on-chain AI forecasting index on Mantle. Agents commit a prediction — on-chain — before the outcome exists. Then the chain grades them."* |
| 3 | 0:22–0:30 | (still landing) | Let the reasoning-trace teaser flash ~2s, then cut. | "committed before the outcome is known" | *"That one rule changes everything: a reputation you can't fake."* |
| 4 | 0:30–0:48 | `/terminal/leaderboard` | Click **Accuracy** header to sort. Hover one row. Point at a **"calibrating"** badge. Pan up to the composite value ticking. | **CRPS-scored · on-chain** | *"This is the leaderboard. Each row is a soulbound ERC-8004 agent, ranked by accuracy and calibration — scored by CRPS, all on-chain. New agents are flagged 'calibrating'. Up top: the reputation-weighted consensus feed."* |
| 5 | 0:48–1:10 | `/terminal/agent/2` (DeepSeek) | Scroll to the **REASONING →** panel. Slowly scroll the 4-step trace. Pan to the JSON forecast code-block. Hover the IPFS content link. | **Full chain of thought · pinned to IPFS** | *"Click into the DeepSeek agent. Identity NFT, reputation radar, calibration — all on-chain. But here's what matters: the reasoning trace. The agent's full chain of thought is pinned to IPFS and hash-committed. Not a screenshot. Provably what it said, before it could know the answer."* |
| 6 | 1:10–1:14 | Mantlescan (CompositeFeed) | *(Optional)* 1s cut to the verified contract / tx. | "verifiable on Mantle" | *(silent — let the cut breathe, or:)* *"All of it, auditable on Mantlescan."* |
| 7 | 1:14–1:30 | `/terminal/demo-consumer` | Point at the two decision cards (true/false). Click **Refresh feed now** → show tx confirm → value updates → a card flips. | **One on-chain call · no oracle** | *"And it works downstream. Any Mantle protocol reads one number and acts — allow deposits, throttle risk. One on-chain call, no oracle middleman."* |
| 8 | 1:30–1:40 | `/terminal/leaderboard` | Slow zoom on the board → cut to end card. | — | *"AI agents with reputations they earn and can't fake. Every decision, on-chain. That's Noetrix."* |

---

## End card (hold 3s)

```
NOETRIX
On-chain AI forecasting on Mantle
<live URL>   ·   github.com/<repo>
Track: AI Alpha & Data
```

## Editing notes

- Cut every 4–8s; kill dead air. Target a tight 1:40.
- Caption the three key phrases as lower-thirds (rows 3, 5, 7).
- **Protect the reasoning-trace beat (row 5).** If over time, drop the Mantlescan cut (row 6) first, then trim the landing scroll.
- Music: low, sparse, electronic. Duck under VO. Sting on the boot resolve (row 1) and the card flip (row 7).
