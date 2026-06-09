# Terminal Namespace and Dashboard Design

## Goal
Separate the public cinematic landing experience from the terminal application experience.

The landing navbar should remain marketing/section oriented. Entering the terminal should go through a dedicated `/terminal` route with a short boot animation that says `INITIALIZING...`, then reveal an immersive terminal shell and land on `/terminal/dashboard`.

## Route structure

- `/` remains the cinematic landing page.
- `/terminal` is the boot entry route.
- `/terminal/dashboard` is the terminal home.
- Existing terminal application pages move under `/terminal/*`:
  - `/terminal/insights`
  - `/terminal/leaderboard`
  - `/terminal/try`
  - `/terminal/pricing`
  - `/terminal/simulation`
  - `/terminal/feed/[category]`
  - `/terminal/demo-consumer`
  - `/terminal/submit`
  - `/terminal/agents`
  - `/terminal/about`
  - `/terminal/agent/[id]`
  - `/terminal/category/[category]`

Old app routes should redirect to their `/terminal/*` equivalents so external links do not break.

## Navigation

Landing navbar:
- Keep only landing-section links and the terminal CTA.
- Terminal CTA text stays `Enter terminal` and points to `/terminal`.
- Remove direct app links from the landing nav unless they are section anchors on the landing page.

Terminal navbar:
- Belongs only inside `/terminal/*`.
- Primary nav should lead with Dashboard, Insights, Leaderboard, Try, Pricing.
- Secondary nav remains in More.
- Brand link should route to `/terminal/dashboard`; a separate small Exit/Home affordance can point back to `/` if needed.

## Boot animation

`/terminal` should show a full-screen terminal boot state:

- Text: `INITIALIZING...`
- Visual feel: terminal scanlines, subtle grid/noise, accent glow, mono type.
- After a short delay, the terminal shell enters with a strong reveal: quick flash/glitch/scale-in/opacity transition.
- Then route to `/terminal/dashboard` or render the dashboard after the reveal.
- Respect reduced motion by shortening or skipping the animation.

## Dashboard content

The dashboard must show real protocol information only. It must not include vague onboarding copy such as "What can I do?".

Dashboard sections:
- Feed status across active categories: latest value, confidence, contributors, freshness/source.
- Protocol metrics: active categories, total committed/resolved forecasts, qualified/top agents where available.
- Top agents: best current agents by category using existing leaderboard data.
- Latest resolved predictions: recent forecast bands, realized outcomes/scores when snapshot data supports it.
- Anomalies/signals: existing insights snapshot anomaly items if available; otherwise empty state with factual wording.
- Network/system status: Mantle Sepolia, snapshot/live source, relevant block numbers.
- Subscription status: price/access/payment rail state if the subscription gate address is configured.

No fake helper text. If data is unavailable, show precise state: `No live indexer configured`, `Snapshot unavailable`, or `No resolved predictions yet`.

## Data sources

Reuse existing frontend data paths:

- `useInsightsData` / committed `insights-snapshot.json` for snapshot-backed proof data.
- `useLeaderboard` for leaderboard/top-agent data with live/cached/mock source flags.
- Existing env and contract helpers for network/subscription/feed status.

Do not add new backend services for this change.

## Testing

Required checks:
- Frontend lint passes.
- Frontend TypeScript/build passes using the repo's real commands.
- Existing e2e responsive routes update to `/terminal/*` and pass.
- Add route checks for `/terminal` and `/terminal/dashboard`.
- Verify old app routes redirect to terminal namespace.

Known baseline note: direct `tsc --noEmit` currently fails because Next global `PageProps` is unavailable outside the Next build/typegen context. Use `next build` as the authoritative frontend type/build verification unless a separate typegen step is added.
