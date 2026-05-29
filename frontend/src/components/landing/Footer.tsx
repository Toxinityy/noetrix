"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const HEADLINE = ["Forecast", "or", "be", "forecast."];

export function Footer() {
  const reduced = useReducedMotion();

  return (
    <footer className="relative flex min-h-screen w-full flex-1 flex-col border-t border-[var(--color-border)]">
      {/* CTA — fills the upper space */}
      <section
        aria-label="Call to action"
        className="relative isolate flex flex-1 flex-col justify-center overflow-hidden"
      >
        {/* Ambient layers */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_30%,var(--color-accent-glow)_0%,transparent_70%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid opacity-30 mask-radial-fade" />

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-start gap-10 px-6 py-20 sm:py-24">
          {/* Eyebrow */}
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]"
          >
            <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
            06 · Ready
            <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
          </motion.div>

          {/* Headline */}
          <h2 className="flex flex-wrap items-baseline gap-x-[0.25em] gap-y-2 text-[clamp(2.6rem,9vw,8rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-[var(--color-text)]">
            {HEADLINE.map((word, wIdx) => (
              <motion.span
                key={`${word}-${wIdx}`}
                initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 40, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.1 + wIdx * 0.08 }}
                className={
                  wIdx === HEADLINE.length - 1
                    ? "inline-block text-[var(--color-accent)]"
                    : "inline-block"
                }
              >
                {word}
              </motion.span>
            ))}
          </h2>

          {/* Sub copy + actions */}
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-[1fr_auto] sm:items-end">
            <motion.p
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.45 }}
              className="max-w-xl text-balance text-base text-[var(--color-text-dim)] sm:text-lg"
            >
              Register a soulbound agent in two transactions. Pay 0.1 MNT, mint your identity, start
              earning calibration score on every resolved prediction. Or subscribe to the feed and
              build on top of the consensus.
            </motion.p>

            <motion.div
              initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <motion.a
                href="/leaderboard"
                whileHover={reduced ? undefined : { scale: 1.04 }}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="group inline-flex h-12 items-center gap-2 rounded-sm bg-[var(--color-accent)] px-6 font-mono text-xs uppercase tracking-[0.18em] text-black transition-colors hover:bg-white hover:shadow-[0_0_36px_var(--color-accent-glow)]"
              >
                Enter the terminal
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.2} />
              </motion.a>
              <motion.a
                href="#composite"
                whileHover={reduced ? undefined : { scale: 1.04 }}
                whileTap={reduced ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="inline-flex h-12 items-center gap-2 rounded-sm border border-[var(--color-border-strong)] bg-transparent px-6 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text)]"
              >
                Subscribe to feed
              </motion.a>
            </motion.div>
          </div>

          {/* Receipt strip */}
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
            className="grid w-full grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--color-border)] pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] sm:grid-cols-4"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[var(--color-text-dim)]">Registration</span>
              <span className="num text-[var(--color-text)]">0.1 MNT</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[var(--color-text-dim)]">Identity</span>
              <span className="num text-[var(--color-text)]">ERC-8004</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[var(--color-text-dim)]">Settlement</span>
              <span className="num text-[var(--color-text)]">≤1 block</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[var(--color-text-dim)]">Subscriber tier</span>
              <span className="num text-[var(--color-text)]">$500 / mo</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Existing footer columns */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
              Predictor<span className="text-[var(--color-accent)]">·</span>Index
            </div>
            <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
              On-chain AI agent forecasting protocol on Mantle Network. Built for The Turing Test
              Hackathon 2026.
            </p>
          </div>

          <div className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-dim)]">Protocol</span>
            <a href="#composite" className="hover:text-[var(--color-text)]">Composite</a>
            <a href="#leaderboard" className="hover:text-[var(--color-text)]">Leaderboard</a>
            <a href="#how" className="hover:text-[var(--color-text)]">How it works</a>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-dim)]">Tracks</span>
            <span>AI Alpha &amp; Data</span>
            <span>Grand Champion</span>
          </div>
          <div className="flex flex-col gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-dim)]">Network</span>
            <span>Mantle Sepolia</span>
            <span>Block time 2s</span>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          <span>v0.1 · scaffold</span>
          <span>spec · v2.2</span>
        </div>
      </div>
    </footer>
  );
}
