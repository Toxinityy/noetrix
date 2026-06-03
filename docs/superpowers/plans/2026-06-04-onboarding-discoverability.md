# Onboarding & Discoverability Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route each of three personas (Earn / Alpha / Build) to one clear goal via an additive "Start here" landing strip, a simplified nav, a first-run intent modal, and goal-scoped guided tours — without overhauling the existing landing.

**Architecture:** A single `PERSONA_PATHS` source-of-truth drives a `StartHere` landing section, a first-run `OnboardingModal`, and the existing Spotlight tour engine (generalized from leaderboard-only to a `tourId`-keyed registry). Each goal tour is single-page, so the modal just routes to the page then arms the tour. Frontend-only; no backend changes. Landing changes are additive (one inserted section + optional tiny hero affordance).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Radix (`react-dialog` + `react-dropdown-menu` — already deps), lucide-react, motion, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-04-onboarding-discoverability-design.md` (approved; landing additive-only).

**Branch:** `web-onboarding-redesign` (already created off `master`).

**Frontend `AGENTS.md` note:** Next 16 has breaking changes — this plan only touches client components + plain JSX/links, no new Next APIs.

**Disambiguation/non-goals reminder:** do NOT rename routes, restructure existing landing sections, or change any backend. Internal `AgentKind` enum untouched.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/components/tour/steps.ts` | Modify | `TourId`, per-goal step arrays, `TOURS` + `TOUR_PAGES` registries |
| `frontend/src/lib/personaPaths.ts` | Create | `PERSONA_PATHS` single source of truth (label/blurb/href/tourId/icon) |
| `frontend/src/lib/personaPaths.test.ts` | Create | vitest invariant: paths ↔ tours/pages consistency |
| `frontend/src/components/tour/TourProvider.tsx` | Modify | generalize to `requestStart(tourId?)`, `tourId` state, page-aware auto-start, onboarded guard |
| `frontend/src/components/onboarding/OnboardingModal.tsx` | Create | first-run intent dialog → route + arm tour |
| `frontend/src/app/(app)/layout.tsx` | Modify | mount `<OnboardingModal />` inside `TourProvider` |
| `frontend/src/components/landing/StartHere.tsx` | Create | 3 persona cards (additive landing section) |
| `frontend/src/app/page.tsx` | Modify | insert `<StartHere />` as slot-2 `StoryFrame` (insertion only) |
| `frontend/src/components/app/AppHeader.tsx` | Modify | primary 3 + `More ▾` dropdown + mobile hamburger |
| `frontend/src/app/(app)/rwa/RwaClient.tsx` | Modify | add 4 `data-tour` anchors (EARN) |
| `frontend/src/app/(app)/insights/InsightsClient.tsx` | Modify | add 4 `data-tour` anchors (ALPHA) |
| `frontend/src/app/(app)/submit/page.tsx` | Modify (nice) | add 3 `data-tour` anchors (BUILD) |
| `frontend/e2e/responsive.spec.ts` | Modify | `/` overflow + StartHere render; first-run modal once |

---

## Task 1: Tour step registry (`steps.ts`)

Add the three goal tours + a `tourId`-keyed registry and a page map. Keep `LEADERBOARD_STEPS`.

**Files:**
- Modify: `frontend/src/components/tour/steps.ts`

- [ ] **Step 1: Append types, step arrays, and registries to `steps.ts`**

Keep the existing `TourStep` interface and `LEADERBOARD_STEPS` array. Add below them:

```ts
export type TourId = "leaderboard" | "earn" | "alpha" | "build";

export const EARN_STEPS: TourStep[] = [
  {
    id: "earn-yields",
    selector: '[data-tour="earn-yields"]',
    title: "AI-forecast yields",
    body: "These cards show what AI agents predict you'd earn on mETH and USDY over the next day — and how confident they are.",
  },
  {
    id: "earn-simulator",
    selector: '[data-tour="earn-simulator"]',
    title: "Try it — no wallet",
    body: "Drag the deposit amount. The AI splits it across mETH and USDY for the best risk-adjusted yield. No wallet, no signup.",
  },
  {
    id: "earn-how",
    selector: '[data-tour="earn-how"]',
    title: "How your money is protected",
    body: "When the AIs lose confidence, the strategy automatically shifts toward safety. Expand here to see the rules.",
  },
  {
    id: "earn-more",
    selector: '[data-tour="earn-more"]',
    title: "Go deeper",
    body: "Want to see which AIs drive these numbers? Open the live leaderboard.",
  },
];

export const ALPHA_STEPS: TourStep[] = [
  {
    id: "alpha-proof",
    selector: '[data-tour="alpha-proof"]',
    title: "Proof, not promises",
    body: "How the best AIs beat the crowd. Every figure is graded on-chain — follow the explorer link to verify any of it.",
  },
  {
    id: "alpha-replay",
    selector: '[data-tour="alpha-replay"]',
    title: "Forecast vs. reality",
    body: "Each row replays a past AI forecast against what actually happened on-chain. In-range means the AI called it.",
  },
  {
    id: "alpha-findings",
    selector: '[data-tour="alpha-findings"]',
    title: "Where smart money disagrees",
    body: "The most accurate AIs vs. the crowd, the biggest bull/bear split, and live anomalies.",
  },
  {
    id: "alpha-yourmove",
    selector: '[data-tour="alpha-yourmove"]',
    title: "Your move",
    body: "A plain-English briefing: the current risk state and how the AI is allocating right now.",
  },
];

export const BUILD_STEPS: TourStep[] = [
  {
    id: "build-steps",
    selector: '[data-tour="build-steps"]',
    title: "Ship an agent in 4 steps",
    body: "Register an on-chain identity, then commit and reveal forecasts. Every prediction is auto-scored.",
  },
  {
    id: "build-sdk",
    selector: '[data-tour="build-sdk"]',
    title: "The SDK does the plumbing",
    body: "One call handles the commit-reveal cycle and staking. Copy this snippet to start.",
  },
  {
    id: "build-consumer",
    selector: '[data-tour="build-consumer"]',
    title: "Read the feed",
    body: "Any Mantle protocol can read the composite feed in one call — see the consumer demo.",
  },
];

export const TOURS: Record<TourId, TourStep[]> = {
  leaderboard: LEADERBOARD_STEPS,
  earn: EARN_STEPS,
  alpha: ALPHA_STEPS,
  build: BUILD_STEPS,
};

export const TOUR_PAGES: Record<TourId, string> = {
  leaderboard: "/leaderboard",
  earn: "/rwa",
  alpha: "/insights",
  build: "/submit",
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tour/steps.ts
git commit -m "feat(tour): add earn/alpha/build goal tours + TOURS/TOUR_PAGES registry"
```

---

## Task 2: `PERSONA_PATHS` source of truth + invariant test

One constant drives StartHere, the modal, and (optionally) nav. A vitest invariant guarantees every path maps to a real tour + page.

**Files:**
- Create: `frontend/src/lib/personaPaths.ts`
- Create: `frontend/src/lib/personaPaths.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/personaPaths.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PERSONA_PATHS } from "./personaPaths";
import { TOURS, TOUR_PAGES } from "@/components/tour/steps";

describe("PERSONA_PATHS", () => {
  it("has exactly the three personas", () => {
    expect(PERSONA_PATHS.map((p) => p.id)).toEqual(["earn", "alpha", "build"]);
  });

  it("every path points at a real tour whose page matches its href", () => {
    for (const p of PERSONA_PATHS) {
      expect(TOURS[p.tourId]?.length ?? 0).toBeGreaterThan(0);
      expect(TOUR_PAGES[p.tourId]).toBe(p.href);
    }
  });

  it("every path has a non-empty label and blurb", () => {
    for (const p of PERSONA_PATHS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm --filter frontend exec vitest run src/lib/personaPaths.test.ts`
Expected: FAIL — cannot resolve `./personaPaths`.

- [ ] **Step 3: Create `frontend/src/lib/personaPaths.ts`**

```ts
import { Coins, LineChart, Wrench, type LucideIcon } from "lucide-react";
import type { TourId } from "@/components/tour/steps";

export type PersonaId = "earn" | "alpha" | "build";

export interface PersonaPath {
  id: PersonaId;
  label: string;
  blurb: string;
  href: string;
  tourId: TourId;
  icon: LucideIcon;
}

/// Single source of truth for the 3-persona onboarding spine. Reused by the
/// landing StartHere strip and the first-run OnboardingModal. Each href is the
/// page its tour lives on (kept in sync via personaPaths.test.ts).
export const PERSONA_PATHS: PersonaPath[] = [
  {
    id: "earn",
    label: "Earn",
    blurb: "Try a no-wallet yield simulator.",
    href: "/rwa",
    tourId: "earn",
    icon: Coins,
  },
  {
    id: "alpha",
    label: "See the alpha",
    blurb: "Live AI signals and on-chain track records.",
    href: "/insights",
    tourId: "alpha",
    icon: LineChart,
  },
  {
    id: "build",
    label: "Build",
    blurb: "Submit an agent or read the feed.",
    href: "/submit",
    tourId: "build",
    icon: Wrench,
  },
];
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `pnpm --filter frontend exec vitest run src/lib/personaPaths.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/personaPaths.ts frontend/src/lib/personaPaths.test.ts
git commit -m "feat(onboarding): PERSONA_PATHS source of truth + invariant test"
```

---

## Task 3: Generalize `TourProvider` to a `tourId`-keyed engine

Replace leaderboard-hardcoding with a `tourId` state selecting from `TOURS`; `requestStart(tourId?)` routes to the tour's page then auto-starts; first-run leaderboard auto-start yields to the onboarding modal.

**Files:**
- Modify: `frontend/src/components/tour/TourProvider.tsx` (full replace)

- [ ] **Step 1: Replace the file contents**

Replace the entire body of `frontend/src/components/tour/TourProvider.tsx` with:

```tsx
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOURS, TOUR_PAGES, type TourId, type TourStep } from "./steps";
import { Spotlight } from "./Spotlight";

const SEEN_KEY = "noetrix.tour.v1";
const REQUEST_KEY = "noetrix.tour.request"; // sessionStorage: holds the pending TourId
export const ONBOARDED_KEY = "noetrix.onboarded.v1"; // set by OnboardingModal

interface TourCtx {
  steps: TourStep[];
  tourId: TourId;
  isOpen: boolean;
  index: number;
  start: () => void;
  requestStart: (tourId?: TourId) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
}

const Ctx = React.createContext<TourCtx | null>(null);

export function useTour(): TourCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useTour must be used within <TourProvider>");
  return v;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tourId, setTourId] = React.useState<TourId>("leaderboard");
  const [isOpen, setIsOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const steps = TOURS[tourId];

  const start = React.useCallback(() => {
    setIndex(0);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  const next = React.useCallback(
    () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const prev = React.useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const skip = React.useCallback(() => close(), [close]);
  const finish = React.useCallback(() => close(), [close]);

  // Start a specific tour. If we're not on its page, stash the id and navigate;
  // the effect below picks it up on arrival.
  const requestStart = React.useCallback(
    (id: TourId = "leaderboard") => {
      const page = TOUR_PAGES[id];
      if (pathname === page) {
        setTourId(id);
        start();
        return;
      }
      try {
        sessionStorage.setItem(REQUEST_KEY, id);
      } catch {}
      router.push(page);
    },
    [pathname, router, start],
  );

  // On every navigation: run a pending requested tour if its page matches; else
  // auto-start the leaderboard tour on first visit — UNLESS the onboarding modal
  // owns first-run (ONBOARDED_KEY set) or the user has already seen a tour.
  React.useEffect(() => {
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(REQUEST_KEY);
    } catch {}

    if (pendingId && TOUR_PAGES[pendingId as TourId] === pathname) {
      try {
        sessionStorage.removeItem(REQUEST_KEY);
      } catch {}
      setTourId(pendingId as TourId);
      const t = setTimeout(start, 600);
      return () => clearTimeout(t);
    }

    if (pathname === "/leaderboard") {
      let seen = false;
      let onboarded = false;
      try {
        seen = localStorage.getItem(SEEN_KEY) === "1";
        onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
      } catch {}
      if (!seen && !onboarded) {
        setTourId("leaderboard");
        const t = setTimeout(start, 600);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, start]);

  const value: TourCtx = {
    steps,
    tourId,
    isOpen,
    index,
    start,
    requestStart,
    next,
    prev,
    skip,
    finish,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen ? <Spotlight /> : null}
    </Ctx.Provider>
  );
}
```

- [ ] **Step 2: Typecheck (AppHeader's `requestStart()` no-arg call still valid — defaults to leaderboard)**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: exit 0. (`Spotlight.tsx` reads `steps`/`index` from context — unchanged API.)

- [ ] **Step 3: Lint**

Run: `pnpm --filter frontend lint`
Expected: 0/0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/tour/TourProvider.tsx
git commit -m "feat(tour): generalize TourProvider to tourId-keyed engine + onboarded guard"
```

---

## Task 4: First-run `OnboardingModal` + mount

A light Radix dialog on first `(app)` visit that routes by persona and arms the goal tour.

**Files:**
- Create: `frontend/src/components/onboarding/OnboardingModal.tsx`
- Modify: `frontend/src/app/(app)/layout.tsx`

- [ ] **Step 1: Create `frontend/src/components/onboarding/OnboardingModal.tsx`**

```tsx
"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PERSONA_PATHS } from "@/lib/personaPaths";
import { useTour, ONBOARDED_KEY } from "@/components/tour/TourProvider";
import { cn } from "@/lib/cn";

/// First-run intent modal. Shows once per browser (localStorage ONBOARDED_KEY).
/// Picking a persona routes to its page and arms that goal's tour; "Just looking"
/// dismisses. Owns first-run, so the leaderboard auto-tour stands down.
export function OnboardingModal() {
  const { requestStart } = useTour();
  const [open, setOpen] = React.useState(false);

  // Client-only first-run check (avoids SSR/hydration mismatch).
  React.useEffect(() => {
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {}
    if (!onboarded) setOpen(true);
  }, []);

  const markOnboarded = React.useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
  }, []);

  const dismiss = React.useCallback(() => {
    markOnboarded();
    setOpen(false);
  }, [markOnboarded]);

  const pick = React.useCallback(
    (tourId: Parameters<typeof requestStart>[0]) => {
      markOnboarded();
      setOpen(false);
      requestStart(tourId); // routes to the page + arms the tour
    },
    [markOnboarded, requestStart],
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (!o ? dismiss() : setOpen(o))}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-6 shadow-2xl focus:outline-none"
          aria-describedby="onb-desc"
        >
          <Dialog.Title className="text-lg font-medium text-[var(--color-text)]">
            New here? What do you want to do?
          </Dialog.Title>
          <Dialog.Description id="onb-desc" className="mt-1 text-sm text-[var(--color-text-dim)]">
            Pick a path and we&apos;ll show you around in a few steps.
          </Dialog.Description>

          <div className="mt-5 flex flex-col gap-2.5">
            {PERSONA_PATHS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p.tourId)}
                  className={cn(
                    "group flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-left transition-colors",
                    "hover:border-[var(--color-accent)]",
                  )}
                >
                  <Icon size={20} className="text-[var(--color-accent)]" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-[var(--color-text)]">{p.label}</span>
                    <span className="text-xs text-[var(--color-text-dim)]">{p.blurb}</span>
                  </span>
                  <span aria-hidden className="ml-auto text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="mt-4 w-full text-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Just looking
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Mount it in `frontend/src/app/(app)/layout.tsx`**

Replace the file with:

```tsx
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { TourProvider } from "@/components/tour/TourProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <OnboardingModal />
      <div className="flex min-h-svh flex-col bg-[var(--color-bg)]">
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <AppFooter />
      </div>
    </TourProvider>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: tsc exit 0; lint 0/0. (Radix `react-dialog` is already a dependency.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/onboarding/OnboardingModal.tsx "frontend/src/app/(app)/layout.tsx"
git commit -m "feat(onboarding): first-run intent modal routing to goal tours"
```

---

## Task 5: `StartHere` landing section (additive)

The "know your target" strip — 3 persona cards, inserted as one new landing section. Existing sections untouched.

**Files:**
- Create: `frontend/src/components/landing/StartHere.tsx`
- Modify: `frontend/src/app/page.tsx` (insertion only)

- [ ] **Step 1: Create `frontend/src/components/landing/StartHere.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PERSONA_PATHS } from "@/lib/personaPaths";

const EASE = [0.22, 1, 0.36, 1] as const;

export function StartHere() {
  const reduced = useReducedMotion();
  return (
    <section
      id="start-here"
      aria-label="Start here"
      className="flex min-h-screen w-full flex-1 flex-col items-center justify-center px-6 py-20"
    >
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        Start here — pick a path
      </div>
      <h2 className="max-w-2xl text-balance text-center text-[clamp(1.7rem,5vw,2.6rem)] font-semibold leading-tight tracking-tight text-[var(--color-text)]">
        What do you want to do?
      </h2>

      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {PERSONA_PATHS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.id}
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.5, ease: EASE, delay: reduced ? 0 : i * 0.08 }}
            >
              <Link
                href={p.href}
                className="group flex h-full flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 transition-colors hover:border-[var(--color-accent)] focus-visible:border-[var(--color-accent)]"
              >
                <Icon size={26} className="text-[var(--color-accent)]" aria-hidden />
                <span className="text-lg font-medium text-[var(--color-text)]">{p.label}</span>
                <span className="text-sm text-[var(--color-text-dim)]">{p.blurb}</span>
                <span
                  aria-hidden
                  className="mt-auto pt-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-accent)]"
                >
                  Enter →
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Insert into `frontend/src/app/page.tsx` (insertion only — change nothing else)**

Add the import alongside the other landing imports:

```tsx
import { StartHere } from "@/components/landing/StartHere";
```

Then insert this `StoryFrame` block **immediately after the Hero `StoryFrame` and before the LivePulse `StoryFrame`**:

```tsx
        <StoryFrame label="Start here">
          <StartHere />
        </StoryFrame>
```

The Hero `StoryFrame` and every other section stay exactly as-is.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend build`
Expected: tsc exit 0; build green, `/` still renders (now with the extra section in the GSAP flow).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/StartHere.tsx frontend/src/app/page.tsx
git commit -m "feat(landing): additive Start-here persona strip (slot 2)"
```

---

## Task 6: Nav simplification — primary 3 + `More ▾` + mobile

**Files:**
- Modify: `frontend/src/components/app/AppHeader.tsx`

- [ ] **Step 1: Restructure `navItems` and add a `More` dropdown + mobile menu**

In `frontend/src/components/app/AppHeader.tsx`:

1. Add imports at the top:

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Menu } from "lucide-react";
```

2. Replace the `navItems` constant with two lists:

```tsx
const primaryNav = [
  { href: "/rwa", label: "Earn" },
  { href: "/insights", label: "Insights" },
  { href: "/leaderboard", label: "Leaderboard" },
];
const moreNav = [
  { href: "/feed/meth-apr-24h", label: "Feed" },
  { href: "/demo-consumer", label: "Consumer" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
];
const allNav = [...primaryNav, ...moreNav];
```

3. Replace the desktop `<nav aria-label="Primary" ...>` block (the one mapping `navItems`) with primaries + a `More` dropdown:

```tsx
<nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
  {primaryNav.map((item) => {
    const active =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(item.href.split("/").slice(0, 2).join("/")));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors",
          active ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
        )}
      >
        {item.label}
      </Link>
    );
  })}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)] focus-visible:text-[var(--color-text)] data-[state=open]:text-[var(--color-accent)]"
      >
        More <ChevronDown size={13} aria-hidden />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        className="z-50 min-w-[160px] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-1 shadow-xl"
      >
        {moreNav.map((item) => (
          <DropdownMenu.Item key={item.href} asChild>
            <Link
              href={item.href}
              className="block cursor-pointer rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] outline-none transition-colors hover:text-[var(--color-text)] focus:text-[var(--color-accent)] data-[highlighted]:text-[var(--color-accent)]"
            >
              {item.label}
            </Link>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</nav>
```

4. Add a mobile menu button + panel. Inside the right-hand cluster `<div className="flex items-center gap-3">`, before `<GuideButton />`, add a mobile-only dropdown listing ALL items:

```tsx
<div className="md:hidden">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        aria-label="Menu"
        className="inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-2 text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
      >
        <Menu size={16} aria-hidden />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        className="z-50 min-w-[180px] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-1 shadow-xl"
      >
        {allNav.map((item) => (
          <DropdownMenu.Item key={item.href} asChild>
            <Link
              href={item.href}
              className="block cursor-pointer rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] outline-none transition-colors data-[highlighted]:text-[var(--color-accent)]"
            >
              {item.label}
            </Link>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</div>
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: tsc exit 0; lint 0/0. (`@radix-ui/react-dropdown-menu` already a dep.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/app/AppHeader.tsx
git commit -m "feat(nav): primary 3 + More dropdown + mobile menu"
```

---

## Task 7: EARN + ALPHA tour anchors (must-have)

Add `data-tour` attributes the tours target. EARN anchors go on RwaClient's existing plain wrapper divs; ALPHA anchors wrap the bare insight components + reuse the existing findings-grid container (avoids breaking grid-child col-spans).

**Files:**
- Modify: `frontend/src/app/(app)/rwa/RwaClient.tsx`
- Modify: `frontend/src/app/(app)/insights/InsightsClient.tsx`

- [ ] **Step 1: EARN anchors in `RwaClient.tsx`**

Add `data-tour` to the four existing wrapper divs in the returned JSX:
- The YieldCard grid: `<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">` → add `data-tour="earn-yields"`.
- The DepositSimulator wrapper: `<div className="mt-6">` (the one wrapping `<DepositSimulator .../>`) → add `data-tour="earn-simulator"`.
- The HowItWorks wrapper: `<div className="mt-6">` (the one wrapping `<HowItWorks />`) → add `data-tour="earn-how"`.
- The leaderboard-link wrapper: `<div className="mt-8 text-center">` → add `data-tour="earn-more"`.

Example (DepositSimulator wrapper):
```tsx
<div className="mt-6" data-tour="earn-simulator">
  <DepositSimulator sim={sim} />
</div>
```

- [ ] **Step 2: ALPHA anchors in `InsightsClient.tsx`**

Wrap the three bare components and tag the existing findings grid:
- Wrap ProofStrip: `<div data-tour="alpha-proof"><ProofStrip data={data} /></div>`
- Wrap ReplayCard: `<div data-tour="alpha-replay"><ReplayCard categoryId={categoryId} predictions={data.category?.predictions ?? []} /></div>`
- The findings grid already has `id="insights-findings"` — add `data-tour="alpha-findings"` to that same `<div>`.
- Wrap YourMoveStrip: `<div data-tour="alpha-yourmove"><YourMoveStrip categoryId={categoryId} data={data} /></div>`

(Plain `<div>` wrappers are full-width block elements — they don't affect the single-column flow above the grid, and the grid container keeps its own classes.)

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend build`
Expected: tsc exit 0; build green.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(app)/rwa/RwaClient.tsx" "frontend/src/app/(app)/insights/InsightsClient.tsx"
git commit -m "feat(tour): EARN + ALPHA data-tour anchors on /rwa and /insights"
```

---

## Task 8 (nice-to-have): BUILD anchors + optional hero affordance

Only do this if must-have tasks are green and time allows.

**Files:**
- Modify: `frontend/src/app/(app)/submit/page.tsx`
- Modify (optional): `frontend/src/components/landing/Hero.tsx`

- [ ] **Step 1: BUILD anchors in `submit/page.tsx`**

Open `frontend/src/app/(app)/submit/page.tsx` and add three `data-tour` attributes to the existing wrapper elements:
- The 4-step flow container (the element rendering the commit-reveal step cards) → `data-tour="build-steps"`.
- The first SDK code block / `<pre>` (the register or submitFullCycle snippet) → `data-tour="build-sdk"`.
- The link/section pointing to the reference agents or the consumer demo → `data-tour="build-consumer"`.

If a target is a presentational child that can't take the attribute, wrap it in a `<div data-tour="...">`. (The tour no-ops any step whose anchor is absent, so a missing one degrades gracefully.)

- [ ] **Step 2 (optional): Hero "↓ Start here" affordance**

In `frontend/src/components/landing/Hero.tsx`, in the CTA row (the `motion.div` holding the "Enter terminal" / "How it works" anchors), add a third small anchor — copy-only, no layout restructure:

```tsx
<a
  href="#start-here"
  className="inline-flex h-11 items-center gap-2 rounded-sm border border-[var(--color-border-strong)] bg-transparent px-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text)]"
>
  ↓ Start here
</a>
```

Leave the rest of `Hero.tsx` untouched (hard landing constraint).

- [ ] **Step 3: Typecheck + build + commit**

```bash
pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend build
git add "frontend/src/app/(app)/submit/page.tsx" frontend/src/components/landing/Hero.tsx
git commit -m "feat(tour): BUILD anchors + optional hero Start-here affordance"
```

---

## Task 9: e2e coverage + final verification gate

**Files:**
- Modify: `frontend/e2e/responsive.spec.ts`

- [ ] **Step 1: Add `/` overflow + StartHere render + first-run modal checks**

Append to `frontend/e2e/responsive.spec.ts` (match the existing test style in the file — `test`, `expect`, `page.goto`, viewport from `playwright.config.ts`):

```ts
import { test, expect } from "@playwright/test";

test("landing has no horizontal overflow at 375px and shows Start-here", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  // StartHere section is present
  await expect(page.locator("#start-here")).toBeVisible();
  // no horizontal overflow
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
});

test("first-run onboarding modal appears once then not again", async ({ page }) => {
  await page.goto("/leaderboard");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Just looking" }).click();
  await expect(dialog).toBeHidden();
  // reload — flag is set, modal must not return
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
});
```

(If `responsive.spec.ts` already imports `test`/`expect`, do not duplicate the import line — append only the two `test(...)` blocks.)

- [ ] **Step 2: Run e2e**

Run: `pnpm --filter frontend test:e2e`
Expected: all pass (existing + 2 new). If the dev/preview server isn't auto-started by `playwright.config.ts`, start `pnpm --filter frontend build && pnpm --filter frontend start` first per the existing config's `webServer` setting.

- [ ] **Step 3: Full verification gate**

Run:
```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
```
Expected: tsc 0; lint 0/0; vitest all pass (existing + personaPaths 3); build green (route count unchanged — no new routes, all changes are components).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/responsive.spec.ts
git commit -m "test(e2e): landing Start-here + first-run modal coverage"
```

---

## Self-review notes (for the executor)

- **Spec coverage:** Component 1 (PERSONA_PATHS) → Task 2; Component 2 (landing additive) → Task 5 (+ optional hero in Task 8); Component 3 (nav) → Task 6; Component 4 (modal) → Task 4; Component 5 (goal tours) → Tasks 1 (steps) + 3 (engine) + 7/8 (anchors); Component 6 (web2 legibility) → enforced in step/label copy across Tasks 1/2/4/5. Verification gate (§5) → Task 9.
- **Non-goals honored:** no route renames; landing change is one inserted section + optional copy-only hero affordance; no backend; no `AgentKind` enum change.
- **Type consistency:** `TourId` defined in `steps.ts`, imported by `personaPaths.ts` (type-only) + `TourProvider.tsx`. `requestStart(tourId?)` used by GuideButton (no-arg, defaults leaderboard) and OnboardingModal (with id). `ONBOARDED_KEY` exported from `TourProvider`, consumed by `OnboardingModal`.
- **Ordering:** steps registry (1) before personaPaths (2, depends on TourId + TOURS); TourProvider (3) before modal (4, imports ONBOARDED_KEY + requestStart signature); StartHere (5) and nav (6) independent; anchors (7) before/independent of e2e (9).
- **Risk guards:** Spotlight no-ops absent anchors (tour never crashes); modal owns first-run via ONBOARDED_KEY so the leaderboard auto-tour stands down; StartHere reuses the `StoryFrame` GSAP contract; ALPHA anchors avoid grid-child wrapping.
```
