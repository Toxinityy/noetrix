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
  /// First-run "what do you want to do?" needs-picker (OnboardingModal). Re-openable via the Guide button.
  onboardingOpen: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
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
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const steps = TOURS[tourId];

  const openOnboarding = React.useCallback(() => setOnboardingOpen(true), []);
  const closeOnboarding = React.useCallback(() => {
    setOnboardingOpen(false);
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
  }, []);

  // First run: show the needs-picker once per browser. Deferred out of the effect
  // body (React-Compiler: no synchronous setState in effects).
  React.useEffect(() => {
    let onboarded = false;
    try {
      onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
    } catch {}
    if (onboarded) return;
    const t = setTimeout(() => setOnboardingOpen(true), 0);
    return () => clearTimeout(t);
  }, []);

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

  // On every navigation: run a pending requested tour if its page matches.
  // First-run onboarding is owned by OnboardingModal (which arms a tour via
  // requestStart), so there is no separate leaderboard auto-start to avoid a
  // modal+tour double-trigger. The leaderboard tour is reachable via the Guide
  // button (requestStart("leaderboard")).
  React.useEffect(() => {
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(REQUEST_KEY);
    } catch {}

    if (pendingId && TOUR_PAGES[pendingId as TourId] === pathname) {
      try {
        sessionStorage.removeItem(REQUEST_KEY);
      } catch {}
      const id = pendingId as TourId;
      // Defer setState out of the effect body (React-Compiler: no synchronous
      // setState in effects); also lets the page settle before measuring targets.
      const t = setTimeout(() => {
        setTourId(id);
        start();
      }, 600);
      return () => clearTimeout(t);
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
    onboardingOpen,
    openOnboarding,
    closeOnboarding,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen ? <Spotlight /> : null}
    </Ctx.Provider>
  );
}
