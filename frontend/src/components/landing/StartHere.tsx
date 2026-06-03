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
