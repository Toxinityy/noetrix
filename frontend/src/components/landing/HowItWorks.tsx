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
    body: "Two-phase submission. Commit hash on-chain, reveal value 10 to 100 blocks later. No last-moment fitting near resolution.",
  },
  {
    k: "03",
    h: "Resolve · score",
    body: "Closed-form CRPS for uniform-over-bucket vs point-mass outcome. Maps to a signed score in [-1e6, +1e6]. Stake settled in one tx.",
  },
  {
    k: "04",
    h: "Compose",
    body: "Rank-weighted ensemble across the top-20 calibrated agents per category. Yield strategies and risk controls subscribe to the consensus value + confidence band to allocate across mETH and USDY.",
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
          From a prediction to a price-feed in one verifiable loop.
        </h2>
      </header>

      <ol className="relative">
        {/* The connecting spine. */}
        <span
          aria-hidden
          className="absolute left-[15px] top-2 bottom-2 w-px bg-[linear-gradient(to_bottom,var(--color-accent),var(--color-border)_30%,var(--color-border))]"
        />
        {STEPS.map((s, i) => (
          <motion.li
            key={s.k}
            initial={reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="relative grid grid-cols-[32px_1fr] gap-x-6 pb-10 last:pb-0 sm:grid-cols-[32px_minmax(0,16rem)_1fr]"
          >
            {/* Node + numeral. */}
            <div className="relative z-10 flex flex-col items-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] font-mono text-xs text-[var(--color-accent)]">
                {s.k}
              </span>
            </div>
            <h3 className="pt-1 text-xl font-medium tracking-tight text-[var(--color-text)] sm:pt-1.5">
              {s.h}
            </h3>
            <p className="col-start-2 pt-1 text-sm leading-relaxed text-[var(--color-text-dim)] sm:col-start-3 sm:pt-1.5">
              {s.body}
            </p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
