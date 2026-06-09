"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { DEEPSEEK_MODEL } from "@/lib/mockData";

/**
 * The demo peak: the DeepSeek reasoner's full trace, the forecast it committed
 * before the outcome, and the verdict once the real value landed. This is the
 * one frame that is deliberately styled to not look like the other cards.
 */
const TRACE = [
  {
    h: "Observe",
    body: "mETH 24h APR ran 384 bps last cycle; staking deposits inflected after the Bybit campaign launched 2026-05-19. Aave-Mantle borrow utilization 71%.",
  },
  {
    h: "Hypothesize",
    body: "Reward cliff at 2026-05-29 should suppress APR by roughly 6% as restaked yield concentrates in fewer validators. Counter-signal: incremental TVL slows the decay.",
  },
  {
    h: "Forecast",
    body: "Range 350 to 420 bps over the next 24h. Center near 389. Confidence 68%, wide enough to absorb a mid-cycle inflow shock.",
  },
  {
    h: "Calibration note",
    body: "I have under-shot APR twice in the last 5 resolutions. Pulling confidence in by 200 bps to compensate. Overconfidence costs my Brier-derived score more than missing the median.",
  },
];

export function ReasoningReveal() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [40, -40]);
  // Fade in once, then stay at full opacity.
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);

  return (
    <section
      id="reasoning"
      ref={ref}
      className="relative flex min-h-screen w-full flex-1 scroll-mt-24 flex-col justify-center px-[clamp(1.5rem,5vw,5rem)] py-16"
    >
      {/* Accent rule + eyebrow: signals "this is the proof", not another bordered card. */}
      <header className="mx-auto mb-10 w-full max-w-7xl">
        <div className="mb-5 h-px w-full bg-[linear-gradient(to_right,var(--color-accent),transparent)]" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1.3fr_1fr] sm:items-end">
          <div className="flex flex-col gap-3">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
              The proof, committed on-chain before the outcome
            </div>
            <h2 className="text-balance text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-6xl">
              It called the band. It landed inside it.
            </h2>
          </div>
          <p className="text-[var(--color-text-dim)] sm:text-lg">
            The DeepSeek reasoner stores its full prompt, response and parsed forecast on IPFS,
            hashed into the on-chain prediction. No edits, no hindsight. Calibration is enforced by
            reputation: overconfident reasoning costs the agent its rank.
          </p>
        </div>
      </header>

      {/* Hero outcome strip: realized-vs-predicted is the headline number. */}
      <motion.div
        style={{ y, opacity }}
        className="mx-auto w-full max-w-7xl"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr_1fr] lg:gap-px lg:overflow-hidden lg:rounded-md lg:border lg:border-[var(--color-border)] lg:bg-[var(--color-border)]">
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 lg:rounded-none lg:border-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Predicted band
            </span>
            <span className="num text-3xl text-[var(--color-text)] sm:text-4xl">
              350 <span className="text-[var(--color-text-muted)]">to</span> 420
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              bps, committed at block #0142
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-bg-elev-1)] p-6 lg:rounded-none lg:border-0 lg:bg-[color:var(--color-accent)]/5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Real value landed at
            </span>
            <span className="num text-3xl text-[var(--color-accent)] sm:text-5xl">389</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-up)]">
              inside the band
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 lg:rounded-none lg:border-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              CRPS score
            </span>
            <span className="num text-3xl text-[var(--color-text)] sm:text-4xl">+412,803</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              graded on-chain, no human in the loop
            </span>
          </div>
        </div>

        {/* Plain-English verdict. */}
        <p className="mt-5 text-balance text-lg text-[var(--color-text-dim)] sm:text-xl">
          <span className="text-[var(--color-text)]">The verdict.</span> The AI locked a 70 bps range
          a day early, and the truth landed dead center. That is the whole protocol in one prediction.
        </p>
      </motion.div>

      {/* Full trace: enlarged body, full-width, no generic card chrome. */}
      <motion.div
        style={{ opacity }}
        className="mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 gap-px overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-border)] lg:grid-cols-[2fr_1fr]"
      >
        <div className="bg-[var(--color-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-dim)]">agent #002 · {DEEPSEEK_MODEL}</span>
            <span className="text-[var(--color-accent)]">METH_APR_24H</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {TRACE.map((step, i) => (
              <motion.div
                key={step.h}
                initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-3 px-6 py-7 sm:flex-row sm:gap-6"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] sm:w-28 sm:shrink-0">
                  {String(i + 1).padStart(2, "0")} · {step.h}
                </span>
                <p className="flex-1 text-[17px] leading-relaxed text-[var(--color-text)] sm:text-[18px]">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* parsed forecast block */}
        <div className="flex flex-col gap-5 bg-[var(--color-bg)] p-6 font-mono text-[12px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            parsed json forecast
          </div>
          <pre className="overflow-x-auto whitespace-pre text-[13px] leading-relaxed text-[var(--color-text-dim)]">{`{
  "predicted_value": {
    "lower": 350,
    "upper": 420
  },
  "confidence": 6800,
  "model": "${DEEPSEEK_MODEL}"
}`}</pre>
          <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                realized
              </span>
              <span className="num text-[var(--color-text)]">389 bps</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                provenance
              </span>
              <span className="text-[var(--color-accent)]">ipfs://bafy…3kx7</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
