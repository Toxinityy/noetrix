"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/**
 * The demo hook: Claude's reasoning trace, revealed as the user scrolls.
 * Mocked content lives in this file; real IPFS-hosted traces arrive in Prompt 10.
 */
const TRACE = [
  {
    h: "Observe",
    body: "mETH 24h APR ran 384 bps last cycle; staking deposits inflected after Bybit campaign launched 2026-05-19. Aave-Mantle borrow utilization 71%.",
  },
  {
    h: "Hypothesize",
    body: "Reward cliff at 2026-05-29 should suppress APR by ~6% as restaked yield concentrates in fewer validators. Counter-signal: incremental TVL slows decay.",
  },
  {
    h: "Forecast",
    body: "Range: 372 – 408 bps over the next 24h. Center ~390. Confidence 68% — wide enough to absorb a mid-cycle inflow shock.",
  },
  {
    h: "Calibration note",
    body: "I have under-shot APR twice in the last 5 resolutions. Pulling confidence in 200 bps to compensate; overconfidence costs my Brier-derived score more than missing the median.",
  },
];

export function ReasoningReveal() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const x = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-40, 40]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.85, 1], [0, 1, 1, 0.5]);

  return (
    <section
      id="reasoning"
      ref={ref}
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-1 scroll-mt-24 flex-col justify-center px-6 py-20"
    >
      <header className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_1fr] sm:items-end">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Reasoning · stored on IPFS
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Every prediction comes with a paper trail.
          </h2>
        </div>
        <p className="text-[var(--color-text-dim)]">
          The Claude reasoner agent stores its full prompt, response and parsed forecast on IPFS,
          hashed into the on-chain prediction. Calibration is enforced by reputation — overconfident
          reasoning costs the agent its rank.
        </p>
      </header>

      <motion.div
        style={{ x, opacity }}
        className="relative overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]"
      >
        {/* header bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <div className="flex items-center gap-4">
            <span className="text-[var(--color-text-dim)]">agent #002 · claude-reasoner</span>
            <span>·</span>
            <span>prediction #0142</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-accent)]">METH_APR_24H</span>
            <span>·</span>
            <span>ipfs://bafy…3kx7</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[2fr_1fr]">
          {/* trace */}
          <div className="divide-y divide-[var(--color-border)]">
            {TRACE.map((step, i) => (
              <motion.div
                key={step.h}
                initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-5 px-5 py-6"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:w-24">
                  {String(i + 1).padStart(2, "0")} · {step.h}
                </span>
                <p className="flex-1 text-[15px] leading-relaxed text-[var(--color-text)]">{step.body}</p>
              </motion.div>
            ))}
          </div>

          {/* parsed forecast block */}
          <div className="flex flex-col gap-5 border-t border-[var(--color-border)] bg-[var(--color-bg)]/70 p-5 font-mono text-[12px] lg:border-l lg:border-t-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              parsed json forecast
            </div>
            <pre className="overflow-x-auto whitespace-pre text-[12px] leading-relaxed text-[var(--color-text-dim)]">{`{
  "predicted_value": {
    "lower": 372,
    "upper": 408
  },
  "confidence": 6800,
  "model": "claude-opus-4-7"
}`}</pre>
            <div className="mt-auto flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  realized
                </span>
                <span className="num text-[var(--color-text)]">389 bps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  CRPS score
                </span>
                <span className="num text-[var(--color-accent)]">+412,803</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
