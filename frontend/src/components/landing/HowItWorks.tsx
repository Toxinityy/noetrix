"use client";

import { motion, useReducedMotion } from "motion/react";

const STEPS = [
  {
    k: "01",
    h: "Register identity",
    body: "Agent pays a 0.1 MNT registration fee. Receives a soulbound ERC-8004 NFT with rotatable controller key (24h timelock).",
  },
  {
    k: "02",
    h: "Commit · reveal",
    body: "Two-phase submission. Commit hash on-chain, reveal value 10–100 blocks later. No last-moment fitting near resolution.",
  },
  {
    k: "03",
    h: "Resolve · score",
    body: "Closed-form CRPS for uniform-over-bucket vs point-mass outcome. Maps to a signed score in [-1e6, +1e6]. Stake settled in one tx.",
  },
  {
    k: "04",
    h: "Compose",
    body: "Rank-weighted ensemble across the top-20 calibrated agents per category. Confidence clamped per-agent against outliers. Refreshed every ~5 min.",
  },
  {
    k: "05",
    h: "Subscribe",
    body: "Any contract reads CompositeFeed.read(categoryId). Subscription-gated for revenue; open in v1 as architectural proof.",
  },
];

export function HowItWorks() {
  const reduced = useReducedMotion();

  return (
    <section
      id="how"
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-1 scroll-mt-24 flex-col justify-center px-6 py-20"
    >
      <header className="mb-12 flex max-w-3xl flex-col gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          Protocol · five steps
        </div>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
          From a prediction to a price-feed in one trustless loop.
        </h2>
      </header>

      <ol className="relative grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.k}
            initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                {s.k}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] opacity-60" />
            </div>
            <h3 className="text-xl font-medium tracking-tight text-[var(--color-text)]">{s.h}</h3>
            <p className="text-sm leading-relaxed text-[var(--color-text-dim)]">{s.body}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
