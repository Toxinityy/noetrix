"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

export function TerminalBootClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<"boot" | "boom">("boot");

  React.useEffect(() => {
    const boomDelay = reduceMotion ? 120 : 950;
    const routeDelay = reduceMotion ? 220 : 1350;
    const boomTimer = window.setTimeout(() => setPhase("boom"), boomDelay);
    const routeTimer = window.setTimeout(() => router.replace("/terminal/dashboard"), routeDelay);
    return () => {
      window.clearTimeout(boomTimer);
      window.clearTimeout(routeTimer);
    };
  }, [reduceMotion, router]);

  return (
    <div className="relative grid min-h-[calc(100svh-3.5rem)] place-items-center overflow-hidden px-6">
      <motion.div
        aria-hidden
        animate={phase === "boom" ? { opacity: [0, 1, 0], scale: [0.96, 1.08, 1.24] } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.42, ease: "easeOut" }}
        className="absolute inset-0 bg-[var(--color-accent)] mix-blend-screen"
      />
      <motion.div
        aria-hidden
        animate={phase === "boom" ? { opacity: [0, 0.9, 0], scaleX: [0, 1, 1.15] } : { opacity: 0, scaleX: 0 }}
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
  );
}
