"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PERSONA_PATHS } from "@/lib/personaPaths";
import { REQUEST_KEY } from "@/components/tour/TourProvider";

const EASE = [0.22, 1, 0.36, 1] as const;

export function StartHere() {
  const reduced = useReducedMotion();
  return (
    <section
      id="start-here"
      aria-label="Start here"
      className="relative flex min-h-screen w-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20"
    >
      {/* Backdrop: square grid texture + a soft teal gradient wash, edge-faded so the strip
          reads as a focal stage without competing with the cards. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid mask-radial-fade" />
        <div className="absolute inset-0 bg-grid-fine opacity-40 mask-radial-fade" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_38%,_var(--color-accent-glow)_0%,_transparent_70%)] opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,_var(--color-bg)_0%,_transparent_22%,_transparent_78%,_var(--color-bg)_100%)]" />
      </div>

      <div className="relative z-10 mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        Start here, pick a path
      </div>
      <h2 className="relative z-10 max-w-2xl text-balance text-center text-[clamp(1.7rem,5vw,2.6rem)] font-semibold leading-tight tracking-tight text-[var(--color-text)]">
        What do you want to do?
      </h2>

      <div className="relative z-10 mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
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
                onClick={() => {
                  // Arm this persona's spotlight tour; the terminal boot gate picks it
                  // up and auto-starts it after the boot animation finishes.
                  try {
                    sessionStorage.setItem(REQUEST_KEY, p.tourId);
                  } catch {}
                }}
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
