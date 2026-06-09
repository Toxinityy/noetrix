"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTour, ONBOARDED_KEY, REQUEST_KEY } from "@/components/tour/TourProvider";

/**
 * Plays the "INITIALIZING" boot animation whenever the user ENTERS the /terminal
 * segment. The terminal layout (and therefore this gate) mounts on entry from the
 * landing/outside and stays mounted across internal /terminal navigation, so the
 * boot fires once per entry, from EVERY entrypoint (Enter-terminal button, logo,
 * persona deep-link, a redirected old route, or a direct URL), and never on
 * in-app navigation between terminal pages.
 *
 * On the first-ever visit it also auto-starts the guided leaderboard tour once the
 * boot finishes (unless a persona tour is already pending).
 */
export function TerminalBootGate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const { requestStart } = useTour();
  const [phase, setPhase] = React.useState<"boot" | "boom" | "done">("boot");

  React.useEffect(() => {
    const boomDelay = reduceMotion ? 120 : 950;
    const doneDelay = reduceMotion ? 220 : 1350;
    const boomTimer = window.setTimeout(() => setPhase("boom"), boomDelay);
    const doneTimer = window.setTimeout(() => {
      setPhase("done");
      // First-ever visit: auto-start the guided tour. Skip if the user has already
      // been onboarded or a persona tour is already queued (so we never override it).
      try {
        const onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
        const pending = sessionStorage.getItem(REQUEST_KEY);
        if (!onboarded && !pending) {
          localStorage.setItem(ONBOARDED_KEY, "1");
          requestStart("leaderboard");
        }
      } catch {}
    }, doneDelay);
    return () => {
      window.clearTimeout(boomTimer);
      window.clearTimeout(doneTimer);
    };
  }, [reduceMotion, requestStart]);

  return (
    <>
      {children}
      {phase !== "done" ? (
        <div
          aria-hidden
          className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-[var(--color-bg)] px-6"
        >
          <motion.div
            animate={phase === "boom" ? { opacity: [0, 1, 0], scale: [0.96, 1.08, 1.24] } : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.42, ease: "easeOut" }}
            className="absolute inset-0 bg-[var(--color-accent)] mix-blend-screen"
          />
          <motion.div
            animate={
              phase === "boom" ? { opacity: [0, 0.9, 0], scaleX: [0, 1, 1.15] } : { opacity: 0, scaleX: 0 }
            }
            transition={{ duration: reduceMotion ? 0.1 : 0.34, ease: "easeOut" }}
            className="absolute inset-x-0 top-1/2 h-px origin-center bg-[var(--color-accent)] shadow-[0_0_44px_var(--color-accent)]"
          />
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={phase === "boom" ? { opacity: 0, y: -18, scale: 1.08 } : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0.1 : 0.5, ease: "easeOut" }}
            className="relative z-10 w-full max-w-xl rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-bg-elev-1)]/80 p-8 text-center shadow-[0_0_80px_rgba(51,234,179,.16)] backdrop-blur"
          >
            <div className="mx-auto mb-6 h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_18px_var(--color-accent)]" />
            <h1 className="font-mono text-sm uppercase tracking-[0.34em] text-[var(--color-accent)]">
              INITIALIZING...
            </h1>
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
              <motion.div
                className="h-full bg-[var(--color-accent)]"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: reduceMotion ? 0.15 : 1.05, ease: "easeInOut" }}
              />
            </div>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Mantle Sepolia · AI forecast protocol
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
