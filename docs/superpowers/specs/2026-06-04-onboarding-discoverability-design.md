# Design — Onboarding & discoverability redesign

**Date:** 2026-06-04
**Status:** Approved (brainstorming)
**Branch:** `web-onboarding-redesign` (off `master`)
**Topic:** Make Noetrix discoverable for new users by routing each of three personas to one clear goal, instead of dropping everyone into a flat wall of features.

---

## 1. Problem & driver

A new user lands and is served a 9-section cinematic scroll-story, then an app with **7 flat, equal-weight nav items** (Earn · Leaderboard · Insights · Feed · Consumer · Submit · About). The hero CTA — "Enter terminal" — dumps everyone into `/leaderboard` with no sense of *what to aim for*. The hero subtitle leads with jargon (soulbound, commit-reveal, CRPS, rank-weighted consensus feed), so a Web2 user bounces in seconds.

Coinglass (the user's reference) puts **labeled, clickable utility on frame one** and the visitor immediately knows what each surface is for. Noetrix optimizes for *narrative + completeness*, not for *getting one persona to one goal fast*.

**Goal:** every new visitor — Web2 normie, Web3 enthusiast, power user — sees a clear path to a single goal within the first screen, and a light mechanic teaches that goal once they arrive. No backend changes; no rewrite of the existing cinematic landing (it's demoted, not deleted).

---

## 2. The spine: 3 personas → 1 goal → 1 destination

| Path | Persona | Their question | Destination | Plain-English label |
|------|---------|----------------|-------------|---------------------|
| 💰 **Earn** | Web2 newcomer | "Can I earn safely?" | `/rwa` (no-wallet simulator) | "Earn — try it, no wallet" |
| 📊 **See the alpha** | Power user / trader | "Where's the edge?" | `/insights` (then `/leaderboard`) | "See the alpha — live AI signals" |
| 🛠 **Build** | Web3 developer | "Submit an agent / read the feed" | `/submit` (+ `/demo-consumer`) | "Build — ship an agent" |

These three paths are the single source of truth reused by the StartHere strip, the nav primaries, the first-run modal, and the goal tours. Defined once as a `PERSONA_PATHS` constant.

---

## 3. Scope

### Component 1 — `PERSONA_PATHS` constant (single source of truth)
- **Create:** `frontend/src/lib/personaPaths.ts` — exports `PERSONA_PATHS: PersonaPath[]` where `PersonaPath = { id: "earn" | "alpha" | "build"; label; blurb; href; icon; tourId }`.
- Consumed by StartHere, AppHeader (optional), OnboardingModal, TourProvider. No copy duplicated across components.

### Component 2 — Landing hybrid (`app/page.tsx` + `Hero`)
- **Modify:** `frontend/src/components/landing/Hero.tsx` — rewrite the subtitle **plain-English first** ("Watch AI agents forecast Mantle yields — and earn, track, or build on it."), jargon second/smaller. Add a secondary "↓ Start here" affordance next to the existing CTAs (anchor to the StartHere section).
- **Create:** `frontend/src/components/landing/StartHere.tsx` — 3 path cards from `PERSONA_PATHS` (icon + label + one-line blurb + arrow → `href`). Terminal-core styling, responsive (stack on mobile, 3-col `md`). No GSAP requirement of its own.
- **Modify:** `frontend/src/app/page.tsx` — insert `<StartHere />` as a `StoryFrame` in slot 2 (immediately after Hero, before LivePulse). Keep all other sections.

### Component 3 — Nav simplification (`AppHeader`)
- **Modify:** `frontend/src/components/app/AppHeader.tsx`:
  - Primary `navItems` → `Earn` (`/rwa`) · `Insights` (`/insights`) · `Leaderboard` (`/leaderboard`).
  - New `More ▾` dropdown (Radix `DropdownMenu` — already in deps via Radix usage; if not, a small CSS/`<details>` menu) containing Feed · Consumer · Submit · About.
  - Keep Guide + Connect untouched. Mobile (`< md`): hamburger lists ALL items flat (primary + more) — no dropdown nesting on mobile.
  - Active-state matching must still work for the moved items.

### Component 4 — First-run intent modal (`OnboardingModal`)
- **Create:** `frontend/src/components/onboarding/OnboardingModal.tsx` (client). On first visit to any `(app)` route, if `localStorage["noetrix.onboarded.v1"]` is unset, show a light modal: heading "New here? What do you want to do?" + 3 buttons from `PERSONA_PATHS` + a "Just looking" dismiss.
  - Selecting a path: set the localStorage flag, `router.push(path.href)`, and arm the goal tour for that path (`requestStart(path.tourId)` via TourProvider, fired after navigation).
  - Reduced-motion safe; Esc + backdrop-click dismiss; focus trap; `role="dialog" aria-modal`.
- **Mount:** in `frontend/src/app/(app)/layout.tsx` (alongside the existing `TourProvider`), so it covers app routes, not the landing.

### Component 5 — Goal mini-tours (extend tour engine)
- **Modify:** `frontend/src/components/tour/steps.ts` — add `EARN_STEPS`, `ALPHA_STEPS`, `BUILD_STEPS` (3–4 steps each), and a registry `TOURS: Record<TourId, TourStep[]>` keyed by `tourId`. Keep `LEADERBOARD_STEPS`.
- **Modify:** `frontend/src/components/tour/TourProvider.tsx` — `requestStart(tourId?)` accepts a tour id (defaults to leaderboard for back-compat); the provider selects the step list from `TOURS` and only runs steps whose page matches (each step keeps its `selector`; provider no-ops a step if its anchor isn't on the current page).
- **Modify (add `data-tour` anchors):**
  - `/rwa` page components — anchors for: deposit slider, AI allocation bar, risk badge, projected yield.
  - `/insights` (`InsightsClient.tsx`) — anchors for: proof strip, forecast-vs-reality replay, smart-money divergence, anomaly feed.
  - `/submit` — anchors for: the 4-step flow, an SDK snippet, the consumer-demo link.
- Tour content uses plain-English (no raw bps/CRPS in the body).

### Component 6 — Web2 legibility pass
- All NEW copy (StartHere, modal, nav labels, tour bodies) avoids `bps`, `CRPS`, `composite feed`, `commit-reveal` as *labels*. Jargon may appear once, explained, in a tour body — never as a button label.

---

## 4. Non-goals (explicit)

- **No full Coinglass-style dashboard hero** (rejected option C — biggest build, needs snapshot wired into hero).
- **No persona-grouped nav dropdowns** (rejected option B for nav — too many clicks).
- **No deletion of the cinematic landing** — it is demoted to below-the-fold story, not removed.
- **No backend / contract / indexer / agent changes.** Frontend-only.
- **No rename of routes** (`/rwa`, `/insights`, etc. stay; only nav *labels* change).
- Not coupled to the `claude-deepseek-rebrand` branch (independent; both merge to master separately).

---

## 5. Verification gate

From `frontend/`:
- `pnpm --filter frontend exec tsc --noEmit` → 0
- `pnpm --filter frontend lint` → 0/0
- `pnpm --filter frontend test` → all pass
- `pnpm --filter frontend build` → green (all routes)
- Playwright `pnpm --filter frontend test:e2e` — extend the existing 375px no-horizontal-overflow check to `/` (with StartHere) and assert the StartHere strip + nav `More` render; assert the first-run modal appears once then not again (localStorage flag).
- **Manual (documented, headless can't drive):** first-run modal → pick Earn → lands `/rwa` → mini-tour auto-starts; nav `More▾` opens; reduced-motion disables modal/tour animation.

---

## 6. Risks

- **Tour anchors on `/rwa` and `/insights` may not exist yet** — adding `data-tour` attributes to existing elements is required; if an element was refactored, the anchor must be re-targeted. Mitigation: the provider no-ops a step whose anchor is absent (never crashes a tour).
- **`More▾` dropdown dependency** — confirm Radix DropdownMenu is available; if not, fall back to a `<details>`/CSS menu to avoid adding a dep mid-hackathon.
- **First-run modal + existing first-run tour could double-trigger** on `/leaderboard`. Mitigation: the modal owns first-run; the leaderboard auto-start tour only fires if the modal was dismissed with "just looking" (or gate the leaderboard auto-start behind "no pending modal").
- **Landing already uses heavy GSAP scroll-jack** — inserting StartHere as a new `StoryFrame` must follow the existing `data-flow-section` + `.flow-art-container` contract or it breaks the pin sequence. Mitigation: reuse the `StoryFrame` wrapper exactly.
- **Mobile**: the cinematic hero + new strip must not introduce horizontal overflow at 375px (existing e2e guard covers this).

---

## 7. Deliverable artifacts

- This spec → implementation plan (`docs/superpowers/plans/2026-06-04-onboarding-discoverability.md`) via writing-plans.
- Canva infographic of the persona funnel (generated post-approval) — pitch/judge artifact, not a build reference.
