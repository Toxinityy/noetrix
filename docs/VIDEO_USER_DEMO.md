# Video 2 — Real User Demo shot list & VO (two cuts)

**Concept:** the two-sided marketplace, told through two real users.
- **Cut A — Sam, the AI builder** (supply side): registers an agent, submits a forecast, watches it scored on-chain. *Turing-Test "Human vs AI competition" hook.*
- **Cut B — Maya, the vault operator** (demand side): consumes the feed, hands an allocation decision to verified AI. *AI x RWA + Best UX hook.*

**Format:** staged-real screen recording, **first-person VO in the user's own voice** (not a narrator), light captions, slightly unpolished = authentic.
**Record:** OBS or Loom, 1920×1080, 30fps, cursor visible.
**Stitched runtime:** ~1:45 (Cut A ~50s + transition + Cut B ~55s). Each also works as a standalone short.

> Navigate directly to `/terminal/*` routes (bare routes redirect → camera flash). Brand on screen: **Noetrix**.

---

## CUT A — Sam, the AI builder (~50s)

### Pre-record setup
- A terminal window themed dark, repo checked out. The register script ready: e.g. `pnpm --filter @predictor-index/naive-baseline register` (or the SDK `Agent.register(uri)` flow shown on `/terminal/submit`).
- **Funded controller hot-wallet** (separate key, ~0.1 MNT for the registration fee + gas). Registration mints the ERC-8004 NFT.
- Tabs pre-loaded: `/terminal/submit`, `/terminal/agents`, `/terminal/leaderboard`, `/terminal/agent/<new-id>`.
- **Staging honesty:** a brand-new agent shows as "calibrating" until ≥10 resolutions. For the "watch it climb" beat you can either (a) run the bot long enough to land 1+ resolved forecast, or (b) frame it as "submitted — now it competes" and show the existing 3-agent board (ARIMA / DeepSeek / Naive) as the field it joins. Don't claim a rank it hasn't earned.

### Shot list

| # | Time | Route / on screen | Action | Caption | Sam's VO (first person) |
|---|------|-------------------|--------|---------|--------------------------|
| A1 | 0:00–0:10 | Sam at desk / editor with a forecasting model open (B-roll or cursor on code). | Establishing. | **Sam · builds forecasting models** | *"I build forecasting models. The problem is nobody can tell if mine is actually good — or if I just got lucky on a screenshot."* |
| A2 | 0:10–0:20 | `/terminal/submit` | Scroll the 4-step commit–reveal cards; pause on the SDK `register` snippet, then `submitFullCycle`. | **Register · commit · reveal · resolve** | *"Noetrix gives my agent an on-chain identity. Four steps: register, commit a forecast, reveal it, the chain resolves and scores it."* |
| A3 | 0:20–0:30 | Terminal window | Run the register script. Show output: agent minted, `id` printed, NFT + 0.1 MNT fee. | `register → agent id minted` | *"I register from the command line. That mints a soulbound NFT — my agent's permanent, on-chain reputation."* |
| A4 | 0:30–0:40 | `/terminal/agents` then `/terminal/agent/<new-id>` | Show the agent-native interface / manifest, then the new agent's detail page (identity card, "calibrating"). | **soulbound · ERC-8004** | *"It submits a forecast — committed before the outcome exists, so I can't fudge it later. Now it's calibrating, and it competes."* |
| A5 | 0:40–0:50 | `/terminal/leaderboard` | Pan the field — ARIMA, DeepSeek, Naive, and Sam's agent in it. | **the field it competes against** | *"Against ARIMA, against DeepSeek's reasoner. May the best model win — and this time, the ranking is provable."* |

---

## TRANSITION (~3s)
Quick wipe. Caption: **"One forecast feeds the index. Who reads it?"** Cut to Maya.

---

## CUT B — Maya, the vault operator (~55s)

### Pre-record setup
- `/terminal/simulation` works 100% client-side (the Calm→Stressed slider is real, no chain needed) — this is your safest, most reliable beat.
- `/terminal/pricing` subscribe is a **real on-chain action** (tested working). Wallet connected, Mantle Sepolia, ~0.5 testnet MNT for the Pro tier. Have the Mantlescan tx tab ready.
- `/terminal/insights` reads the committed on-chain snapshot (honest "on-chain snapshot" pill) — fine to film.
- `/terminal/demo-consumer` reads the live feed; if bots are stopped it may show a degraded state — refresh the feed first, or stay on `/simulation` for the live-rebalance beat.
- Tabs pre-loaded: `/terminal/insights`, `/terminal/simulation`, `/terminal/pricing`, `/terminal/demo-consumer`.

### Shot list

| # | Time | Route / on screen | Action | Caption | Maya's VO (first person) |
|---|------|-------------------|--------|---------|---------------------------|
| B1 | 0:00–0:12 | Maya at desk / a manual allocation spreadsheet (B-roll or cursor hovering a mETH/USDY split). | Establishing the pain. | **Maya · runs a Mantle yield vault** | *"I run a small yield vault. Every week I'm guessing — more mETH, more USDY? And when the market turns, I find out too late."* |
| B2 | 0:12–0:28 | `/terminal/insights` | Point at **Crowd vs proven AI**, scroll to the anomaly feed and the risk monitor. | **proven AI, not the crowd** | *"Noetrix shows me what the AIs that have actually been right are forecasting — weighted by their on-chain track record, not the crowd. And it flags market stress before I'd catch it."* |
| B3 | 0:28–0:46 | `/terminal/simulation` | **The wow:** drag the **Calm → Stressed** slider. Allocation bar shifts; risk badge flips Normal → Caution → Frozen, live. Drag back. | **AI rebalances · live** | *"Watch this. I push conditions toward stressed — and the AI allocation rebalances, and the risk state flips, in real time. That's the call I'd be making by hand at midnight."* |
| B4 | 0:46–0:58 | `/terminal/pricing` | Connect wallet → click Subscribe (Pro) → confirm tx → "subscribed · expires …" → cut to Mantlescan tx. | **subscribed on-chain** | *"I subscribe on-chain. Now my vault reads one feed instead of me babysitting charts."* |
| B5 | 0:58–1:05 | `/terminal/demo-consumer` (or back to `/simulation`) | Show a decision card flip (deposits allowed / risk throttled) driven by the feed. | **one feed · real decisions** | *"It throttled risk a day before the last dip. I didn't touch anything — the feed did."* |
| B6 | 1:05–1:12 | Maya to camera, or hold on the dashboard. | Close. | — | *"It's not magic. It's just the AIs that proved they were right — on-chain."* |

---

## End card (hold 3s)

```
NOETRIX
Verified AI forecasts → real on-chain decisions
<live URL>   ·   github.com/<repo>
Tracks: AI Alpha & Data · AI x RWA · Best UX
```

## Editing notes

- Keep Cut A snappy (builder energy) and Cut B calmer (operator relief). The tonal shift sells the two-sided story.
- VO should sound like a real person, not a trailer narrator — record on a phone mic if it reads more authentic.
- **Most reliable beats to film live:** A2/A3 (terminal + submit page), B3 (`/simulation` slider, fully client-side), B4 (`/pricing` subscribe, verified working). Build the edit around these; stage the rest.
- Caption the personas (A1/B1) and the proof phrases (A4, B2, B4).
- If you only have time for one cut: ship **Cut B (Maya)** — the `/simulation` slider + on-chain subscribe is the strongest single demonstration of value.
