# Design — Alpha & Data repositioning: Insights lens + Web2-legible AI narration

**Date:** 2026-06-01
**Status:** Approved (design), pending spec review
**Owner:** William Arthur / Vico Pratama
**Supersedes nothing — additive to the merged `master` frontend + agents.**

---

## 1. Context & strategy decisions

The hackathon org published full track + award definitions (`masterdoc/requirements.md`). Re-reading the *detailed* "Alpha & Data Track (Mirana Ventures)" requirements (not the one-line summary the team fled on 2026-05-30) shows Predictor Index is a near-perfect literal fit for **Path A — Data & Analytics: "AI-powered on-chain data analysis, monitoring, or prediction tools."**

Decisions locked in this brainstorm:

| # | Decision |
|---|----------|
| D1 | **Primary track = Alpha & Data** (Mirana). **Secondary = AI x RWA** (kept as the applied angle; multi-track tag if DoraHacks allows). |
| D2 | **Awards actively chased:** Alpha & Data track, **Best UI/UX**, **20-Project Deployment**. Community Voting = free eligibility, not chased. (No "Grand Champion" exists in this event — drop that framing.) |
| D3 | **Sequencing:** get the *features* working well first; deployment/verification/video/indexer-hosting is a **separate later conversation** (out of scope here). |
| D4 | **Clear prior debt first** before new features (lint errors + unverified tour/375px from the last merged session). |
| D5 | **Web2-legibility is a hard requirement** for every new surface: a non-crypto user must understand each concept without a glossary lookup. Lifts UI/UX "lower the Web3 barrier" (15%) + AI-Interaction (25%). |

### Track scoring this design targets
- **Alpha & Data track-specific 40% = "Insight Value: uniqueness of findings + data visualization quality."** → Section 3 (Insights lens).
- **Best UI/UX: AI-Interaction 25% + Accessibility 15%.** → Section 4 (AI narration) + Web2-legibility woven through Sections 3–4.

---

## 2. Scope

**In scope (this spec → one implementation plan):**
- **Debt cleanup (§3):** fix the ~10 lint errors; add a runtime verification path (Playwright smoke) for the spotlight tour + 375px.
- **Insights lens (§4):** new `/insights` route + a landing teaser. Headline finding = "smart-money divergence."
- **AI narration (§5):** Web2-legible — reasoner self-narrates (free) + a cached server API route narrates any agent (incl. ARIMA).
- **Cross-cutting:** Web2-legibility (jargon translation, plain-English headlines, progressive disclosure) and a11y baked into §4–§5.

**Out of scope (explicitly deferred to a later conversation):**
- Vercel public deploy, Mantlescan/Etherscan-V2 contract verification, Railway+Postgres indexer hosting, ≥2-min demo video, submission-text reframe.
- No new contracts. No re-theme of the existing terminal-core / cinematic design system. No new chart library (Recharts already covers every chart below).

---

## 3. Clear prior debt first

### 3.1 Lint cleanup (fix, do not disable)
Target: `pnpm --filter frontend lint` exits clean. Known errors (from the 2026-06-01 session note):
- `about/page.tsx` — unescaped `'` → use `&apos;` / curly entity.
- `agent/[id]/AgentDetailClient.tsx` — React-Compiler "memoization could not be preserved" → restructure so the flagged value is computed without breaking memo (extract stable callback / move derivation out of the render-conditional path).
- `ui/dithering-shader.tsx` — `Date.now()` purity → read time inside the animation frame callback / via a ref, not in render.
- `AppHeader.tsx` — ConnectButton `setState`-in-effect → guard or move to event handler / `useSyncExternalStore` for the mounted flag.
- `AllocationBar` — unused variable → remove.

Each fixed at root cause; no `eslint-disable`. If any fix is non-trivial, the plan task documents the why.

### 3.2 Runtime verification of the spotlight tour + 375px
The last session shipped the tour build-verified only ("NOT browser-verified"). This session makes it real:
- Add a **Playwright smoke test** (frontend dev-dependency) that drives the leaderboard tour against `next dev`:
  - first-visit auto-start fires; 6 steps advance via `→`/`Enter`; `←` goes back; `Esc` dismisses; the header **Guide** button replays; `localStorage noetrix.tour.v1` gates first-run.
  - capture **375px** screenshots of `/leaderboard`, `/insights`, `/agent/[id]` for a manual glance + as regression artifacts.
  - a `prefers-reduced-motion` run asserts the spotlight jumps (no animated tween).
- The model can run this headless (Playwright drives Chromium) → genuine verification, not assumption. Final aesthetic glance stays with the user, but logic + responsive layout get exercised.

---

## 4. Insights lens (`/insights` + landing teaser)

### 4.1 Purpose
Turn the raw forecast/leaderboard data into **readable findings** a Web2 reader grasps in one sentence. This is the Alpha & Data 40% lever ("uniqueness of findings + viz quality").

### 4.2 Architecture
- New route `frontend/src/app/(app)/insights/{page.tsx,InsightsClient.tsx}` — server page (metadata) + client component, matching the existing `(app)` page pattern.
- **No new data fetching primitives.** Reuse `useLeaderboard` + `useFeedHistory` from `lib/hooks.ts` (which already do live→cached→mock with a `DataSource` flag).
- **New pure module `lib/insights.ts`** — pure functions over the normalized `LeaderRow[]` + `LiveFeedPoint[]` rows. No I/O. Each finding is a pure derivation → trivially unit-testable and tier-agnostic (works on live, cached, or mock identically).
- Per-category tabs reuse `CategoryTabs`.
- Source pill ("Live data" / "Demo data") reused so judges see honesty about the data tier.

### 4.3 Findings + visualizations (chart types grounded in ui-ux-pro-max `chart` domain)

| Finding | Plain-English headline (Web2) | Chart | Recharts build |
|---|---|---|---|
| **Smart-money divergence (centerpiece)** | "The most accurate AIs expect mETH yield **higher** than the crowd." | **Bullet chart** (KPI-vs-benchmark; AAA a11y; values always visible) — smart-money consensus = bar, crowd composite = target marker | Custom SVG or ComposedChart per category |
| **Consensus + uncertainty over time** | "AI consensus for mETH yield, with the range it's confident about." | **Line + confidence band** (skill's exact "Time-Series Forecast… for non-technical stakeholders") | `Area` (band, 15% opacity) + `Line` (solid=actual, dashed=forecast) |
| **Notable move** | "Big shift: USDY yield consensus jumped 0.4% in the last day." | **Line with highlight** (anomaly) — shape marker + text annotation, never color-only | reference dot + label |
| **Rising AIs** | "These agents are climbing fastest on accuracy." | **Bar, sorted desc, value labels** | `BarChart` |
| **Uncertainty level** | "Confidence: **High / Medium / Low**" with an icon | band-width → labeled badge (icon + text, not color alone) | derived badge |

**Smart-money definition (centerpiece):** agents with `resolvedCount ≥ 10` (the existing "qualified" gate), ranked by `accuracyScore` (tiebreak calibration). Smart-money consensus = **accuracy-weighted midpoint** of the latest revealed bands of the qualified set, **capped to the top 8 by accuracy** when more than 8 qualify (keeps the signal to the genuinely-good agents and bounds compute). Crowd = the composite feed value. Divergence = signed delta + direction word ("higher"/"lower"/"in line"). This bridges Predictor Index to the track's own "smart money tracking" encouraged direction using on-chain CRPS reputation **no other team has**.

### 4.4 Landing teaser
- An auto-generated one-line "insight of the moment" card on the landing (new `StoryFrame` slot or appended to `LivePulse`), derived from `lib/insights.ts` top finding, with a CTA → `/insights`.
- Shareable phrasing (doubles as Community-Voting bait), e.g. *"Predictor Index: the most accurate AIs see mETH yield rising faster than the market — here's why."*

### 4.5 Web2-legibility (mandatory)
- Every card leads with a **plain-English sentence**; technical terms live behind a tooltip or an expandable "How we know this" disclosure (progressive disclosure).
- Use the **jargon-translation table (§6)** consistently — same translations as the existing `/rwa` page.
- Numbers formatted human-side: APR/APY as `%` not bps; USD with `$` + thousands; "AI consensus" not "composite feed"; "accuracy score" not "CRPS".
- A short, dismissible "What is this page?" intro (skippable `<details>`, same pattern as `/rwa` HowItWorks).
- The page copy also answers the submission's three required questions inline (data sources / AI role / verifiable value) — serves both the judge and the Web2 reader.

### 4.6 Accessibility (UI/UX 15%)
- Charts: legend distinguishes series by **line-style** (solid/dashed), not color; each chart has a **toggle to a data-table** fallback; `aria-label` summary stating the chart's key insight.
- Skeleton (`animate-pulse`) when load > 300ms; `EmptyState` when no qualified agents yet; `ErrorState` (role="alert") on live-fetch failure (cached banner reused).
- 4.5:1 contrast (existing tokens pass); color never the sole signal (icon+text on every status).
- `aria-live="polite"` on the live consensus value.

---

## 5. Web2-legible AI narration (UI/UX 25%)

Two complementary mechanisms (both approved):

### 5.1 Reasoner self-narration (free — same OpenRouter→DeepSeek call)
The `claude-reasoner` agent already calls DeepSeek (`deepseek/deepseek-chat-v3.1`) via OpenRouter to produce its forecast. Extend that single completion's **output contract** to also return:
- `summary` — ≤140 chars, **plain English for a non-crypto reader**, no jargon (e.g. "I think mETH staking yield will sit between 3.0% and 3.4% next day — calm market, no big catalysts.").
- `confidence_rationale` — one sentence on why the band is wide/narrow.

Changes: `agents/claude-reasoner/src/prompt.ts` (system + output schema), `src/forecast.ts` (parse + validate the two new fields, tolerate absence for back-compat), `fewshot/*.json` (add the two fields to each example, written in Web2 language). Stored in the same IPFS payload + `contentHash`. **No extra API call, no added cost.**

### 5.2 Server narration API route (covers ARIMA + old predictions)
- `frontend/src/app/api/narrate/route.ts` — Next.js route handler (server-only).
- Input: `{ predictionId, agentKind, category, low, high, confidence, accuracy, recentContext }`.
- Calls OpenRouter→DeepSeek with a tight prompt: *"Explain this AI's forecast to someone new to crypto in 1–2 sentences. No jargon."* Returns `{ summary }`.
- **Key handling:** `OPENROUTER_API_KEY` is **server-only** (never `NEXT_PUBLIC_*`). Route reads `process.env`.
- **Caching:** keyed by `predictionId` (predictions are immutable once revealed). Demo-grade cache = a persisted JSON file under `frontend/.narrate-cache/` (or in-memory Map with file-backing) so repeated judge views never re-call. On-demand only — fired when a row is expanded, debounced.
- **Failure:** returns a graceful fallback string; never blocks the UI.

### 5.3 Render
- On `/agent/[id]` (predictions table + `FeaturedReasoning` panel) and on `/insights` finding cards where an agent is cited:
  - Show the **friendly `summary` headline** → `confidence_rationale` → then the existing dense 4-step trace below (progressive disclosure; trace is the power-user view).
  - For ARIMA rows (no reasoner field): summary comes from `/api/narrate` ("ARIMA projects ~3.2% because the recent trend is flat; it widened the range for normal day-to-day swings.").
- **Fallback chain for the summary:** reasoner `summary` field → cached `/api/narrate` → client-side compose from the structured trace → raw `reasoning` text.

### 5.4 Web2-legibility + a11y for narration
- Skeleton/shimmer while `/api/narrate` resolves (>300ms); `aria-live="polite"` announces the summary when it arrives; error → `role="alert"` retry.
- Confidence rendered as **icon + text** (e.g. a meter glyph + "Medium confidence"), never color alone.
- All narration text validated to avoid jargon; the prompt explicitly bans bps/CRPS/"composite feed"/"calibration".

---

## 6. Web2 jargon-translation table (single source — reuse `/rwa` translations)

| On-chain / internal term | Web2-facing label |
|---|---|
| Composite feed | **AI consensus** |
| mETH APR (bps) | **mETH staking yield (%)** |
| USDY APY (bps) | **USDY yield (%)** |
| CRPS score | **accuracy score** |
| Calibration | **confidence honesty** (how well the AI's stated confidence matches its real accuracy) |
| Top agents / qualified | **most accurate AIs** |
| Prediction band [low, high] | **the range the AI is confident about** |
| Resolved | **graded against the real outcome** |
| Stake / slash | (avoid on Web2 surfaces; keep to terminal-core pages) |
| Epoch / refresh / block | **updated [N min] ago** |

Implementation: a small `lib/labels.ts` (or extend existing `lib/format.ts`) holding these mappings + formatters (`bpsToPct`, `usd`, `relativeTime`), used by `/insights`, the landing teaser, and narration rendering.

---

## 7. Non-goals
- Not building a trading/execution agent (that's the AI Trading track — not ours).
- Not adding KYC/compliance (RWA is secondary, not the judged primary).
- Not re-theming terminal-core or the cinematic landing.
- Not hosting/deploying anything (deferred).

---

## 8. Risks & honest caveats
- **Demo-shaped numbers:** `/insights` renders on cached/mock data until a live indexer is hosted (deferred). Findings are real *derivations*; the underlying values are demo-tier until then. State this via the source pill.
- **`/api/narrate` cost/latency:** mitigated by predictionId caching + on-demand-only firing. DeepSeek ~$0.0012/call; bounded by distinct predictions viewed.
- **Reasoner output drift:** adding two fields could tempt the model to break the JSON contract. `forecast.ts` must parse defensively (the existing fence-strip + brace-slice) and treat the new fields as optional.
- **Playwright on Windows:** browser install can be heavy; if it fails in the environment, fall back to a documented manual checklist (but attempt the automated path first).
- **Smart-money sample size:** with few qualified agents (`resolvedCount ≥ 10`) early, the centerpiece may show "not enough graded forecasts yet" — design an honest empty/low-data state rather than a fake divergence.

---

## 9. Verification approach
- Lint: `pnpm --filter frontend lint` green.
- Types/build: `pnpm --filter frontend build` green (TS pass, all routes incl. `/insights`).
- `lib/insights.ts` + `lib/labels.ts`: unit tests (pure functions) covering smart-money divergence sign/direction, uncertainty bucketing, notable-move threshold, label/format mappings, and low-data empty states.
- Reasoner: `tsc` clean for `claude-reasoner`; a parse test asserting `forecast.ts` accepts output **with and without** the new fields.
- Tour/375px: Playwright smoke green + screenshots captured.
- `/api/narrate`: a route test with a mocked OpenRouter response (no real network in CI) asserting cache-hit skips the call and failure returns the fallback string.
- Manual: user glances at the 375px screenshots + does the final aesthetic pass.

---

## 10. Build order (for the plan)
1. Debt cleanup §3 (lint → tour/375px Playwright) — clears the deck.
2. `lib/labels.ts` + `lib/insights.ts` (pure, tested) — foundation for the page.
3. `/insights` page + per-category tabs + the 5 finding cards/charts.
4. Landing teaser.
5. Reasoner self-narration (prompt + forecast + fewshot).
6. `/api/narrate` route + cache.
7. Narration render on `/agent/[id]` + insights cards.
8. Full a11y + Web2-legibility pass + verification gates.
