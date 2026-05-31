"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LEADERBOARD_STEPS, type TourStep } from "./steps";
import { Spotlight } from "./Spotlight";

const SEEN_KEY = "noetrix.tour.v1";
const REQUEST_KEY = "noetrix.tour.request";

interface TourCtx {
  steps: TourStep[];
  isOpen: boolean;
  index: number;
  start: () => void;
  requestStart: () => void;
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
  const steps = LEADERBOARD_STEPS;
  const [isOpen, setIsOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const onLeaderboard = pathname === "/leaderboard";

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

  // Replay from any terminal page: if not on the leaderboard, navigate there and start on arrival.
  const requestStart = React.useCallback(() => {
    if (onLeaderboard) {
      start();
      return;
    }
    try {
      sessionStorage.setItem(REQUEST_KEY, "1");
    } catch {}
    router.push("/leaderboard");
  }, [onLeaderboard, router, start]);

  // Auto-start on first leaderboard visit, or when a cross-page replay is pending.
  React.useEffect(() => {
    if (!onLeaderboard) return;
    let pending = false;
    let seen = false;
    try {
      pending = sessionStorage.getItem(REQUEST_KEY) === "1";
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (pending) {
      try {
        sessionStorage.removeItem(REQUEST_KEY);
      } catch {}
    }
    if (pending || !seen) {
      const t = setTimeout(start, 600); // let the page settle before measuring targets
      return () => clearTimeout(t);
    }
  }, [onLeaderboard, start]);

  const value: TourCtx = { steps, isOpen, index, start, requestStart, next, prev, skip, finish };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen ? <Spotlight /> : null}
    </Ctx.Provider>
  );
}
