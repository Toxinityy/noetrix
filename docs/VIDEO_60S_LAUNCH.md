# Video — 60s fast-paced explainer (kinetic type + real click demo)

**Goal:** in 60 seconds, make a first-time viewer *understand what Noetrix is* and why it's trustworthy. Fast, tech, information-rich. Kinetic typography between product highlights; real cursor-on-screen interaction for the demo beats; branded bookends.
**Format:** motion-graphics type cards (built in HyperFrames) **composited with** real screen-capture clips. VO + on-screen text so it reads even muted.
**Specs:** 1920×1080, 30fps (or 60fps for the type cards). Cut on the beat.

## Aesthetic & motion language (use the real brand tokens)
- **Background** `#050607` · **accent** `#33EAB3` (Mantle teal) · text `#E6E9EE` / muted `#6b7384`.
- **Type:** display words = **JetBrains Mono** (uppercase, tight tracking); body/explainer = **Inter**. Numbers tabular.
- **Motion:** words *slam* in (fast scale 1.08→1 + blur 12→0, 120ms), wipe out on cut. Single-line diagram flows left→right. Demo clips are framed in a thin `1px` teal terminal border with a faint scanline.
- **Audio:** driving electronic, ~124 bpm. One riser into the brand outro. Duck under VO. Stings on each type-card slam.

> Navigate demos directly to `/terminal/*` (bare routes redirect → flash). The two longer scripts (`VIDEO_PRODUCT_DEMO.md`, `VIDEO_USER_DEMO.md`) are your **clip sources** — capture those interactions, cut them down to the seconds below.

---

## Second-by-second shot list

| # | Time | Shot type | On-screen / KINETIC TYPE | Click / action (demo beats) | Voiceover |
|---|------|-----------|---------------------------|------------------------------|-----------|
| 1 | 0:00–0:04 | **BRAND** | Logo draws in → "**NOETRIX**" letters slam → tagline fades: *on-chain AI forecasting · Mantle* | — | *"AI forecasts are everywhere."* |
| 2 | 0:04–0:09 | **KINETIC TYPE** | Rapid-fire: `TRADING BOTS.` `YIELD MODELS.` `RISK ENGINES.` → big strike-through **`TRUST NONE.`** | — | *"Trading bots, yield models, risk engines — and you can't trust a single one."* |
| 3 | 0:09–0:14 | **KINETIC TYPE** | `a track record is just a screenshot` → screenshot icon shatters → **`until it's on-chain.`** | — | *"A track record is just a screenshot. Until it's on-chain."* |
| 4 | 0:14–0:20 | **EXPLAINER MOTION** | Animated one-liner flows L→R: **COMMIT → REVEAL → RESOLVE → SCORE**, `Mantle` chip pulses. Title under it: *Noetrix — the on-chain AI forecasting index.* | — | *"Noetrix is the on-chain AI forecasting index on Mantle. Agents commit a forecast before the outcome exists — then the chain grades them. So reputation can't be faked."* |
| 5 | 0:20–0:23 | **TYPE TRANSITION** | Full-frame word **`RANK`** wipes in (teal) | — | *"Rank."* |
| 6 | 0:23–0:29 | **DEMO (real click)** | `/terminal/leaderboard` | Cursor clicks **Accuracy** header → rows resort; hover a **"calibrating"** badge; composite value ticks up top. | *"Every agent — ranked by accuracy and calibration, scored by CRPS, all on-chain."* |
| 7 | 0:29–0:31 | **TYPE TRANSITION** | word **`PROVE`** | — | *"Prove."* |
| 8 | 0:31–0:38 | **DEMO (real click)** | `/terminal/agent/2` (DeepSeek) | Scroll into **REASONING →** panel; the 4 trace steps animate in; hover the **IPFS** content link. | *"Each forecast ships its full reasoning — pinned to IPFS, hash-committed. Provably what the AI said, before it knew the answer."* |
| 9 | 0:38–0:40 | **TYPE TRANSITION** | word **`REBALANCE`** | — | *"Rebalance."* |
| 10 | 0:40–0:47 | **DEMO (real click)** | `/terminal/simulation` | **Drag the Calm → Stressed slider.** Allocation bar shifts live; risk badge flips Normal → Caution → Frozen. Drag back once. | *"Protocols read one consensus feed. Watch the AI rebalance allocation and flip the risk state — live, on-chain."* |
| 11 | 0:47–0:49 | **TYPE TRANSITION** | word **`SUBSCRIBE`** | — | *"Subscribe."* |
| 12 | 0:49–0:53 | **DEMO (real click)** | `/terminal/pricing` | Click **Subscribe (Pro)** → wallet confirm → "subscribed · expires …". | *"Subscribe on-chain. One call — no oracle middleman."* |
| 13 | 0:53–1:00 | **BRAND OUTRO** | Kinetic: **`EVERY AI DECISION —`** / **`ON-CHAIN.`** resolves into the logo lockup + URL + tracks. | — | *"Reputations they earn and can't fake. Every AI decision, on-chain. Noetrix."* |

**Runtime:** exactly 60s. Four real-click demo beats (rows 6, 8, 10, 12), each topped by a one-word kinetic card so the structure reads instantly.

---

## End frame (the last 2s of row 13, hold)

```
NOETRIX                            ◢ logo
On-chain AI forecasting on Mantle
<live URL>   ·   github.com/<repo>
AI Alpha & Data · AI x RWA · Best UX
```

## Production approach
1. **Capture the 4 demo clips** with OBS at 60fps — leaderboard sort, reasoning scroll, simulation slider drag, pricing subscribe. Keep raw clips long; you'll trim to 4–7s each. Pre-load tabs, funded wallet for row 12.
2. **Build the type cards + explainer diagram in HyperFrames** (rows 1–5, 7, 9, 11, 13) — deterministic kinetic typography, slam-in/wipe transitions, the COMMIT→REVEAL→RESOLVE→SCORE flow.
3. **Composite**: HyperFrames timeline with the screen clips dropped onto the demo beats inside the teal terminal frame. Render to MP4.

## If it runs long / pacing safety valves
- Drop the **SUBSCRIBE** beat (rows 11–12) first → 56s, three demo beats. Strongest three are RANK, PROVE, REBALANCE.
- The **PROVE** beat (row 8, reasoning trace) is the differentiator — never cut it.
- For a muted social cut, the on-screen kinetic text already carries the full message; VO is a bonus, not a crutch.
