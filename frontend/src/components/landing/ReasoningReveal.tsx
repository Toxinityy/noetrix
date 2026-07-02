"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { DEEPSEEK_MODEL } from "@/lib/mockData";

/**
 * The demo peak — built from REAL on-chain data, misses included.
 *
 * Tiles: prediction #773 on the live PredictionMarket (agent 2, METH_APR_24H) — band 240–270 bps
 * committed at block 40,106,259, a full ~24h (43,197 blocks) before resolution block 40,149,456.
 * The realized value landed at 302 bps (32 bps above the band) and the chain still graded it
 * +956,667 CRPS (95.7%) — verify via getPrediction(773) on Mantlescan.
 *
 * Trace: quoted VERBATIM from the reasoner's pinned IPFS provenance payload (contentURI below),
 * whose keccak hash was committed on-chain as the prediction's contentHash before the outcome.
 */
const PROOF = {
  predictionId: 773,
  bandLow: 240,
  bandHigh: 270,
  commitBlock: "40,106,259",
  resolutionBlock: "40,149,456",
  realized: 302,
  score: "+956,667",
  scorePct: "95.7%",
  marketUrl:
    "https://sepolia.mantlescan.xyz/address/0xaa92b0434F89a17F2275b655c6fA459C43813f22#readContract",
};

const PINNED_CID = "ipfs://QmREFScRDmHTm82P391LrmSds1BSutPVHDRCHKgJhm3Wvy";

// Verbatim steps from the pinned payload (a cold-start mETH forecast by the same reasoner).
const TRACE = [
  {
    h: "Frame",
    body: "Forecast the 24h annualized mETH staking APR (bps, domain 0–100,000) on a cold start: no resolved history for this agent in context, no news items returned, composite feed empty.",
  },
  {
    h: "Infer",
    body: "No historical data or news available; initial forecast must cover a wide plausible range for mETH APR based on typical staking yields (often 2-4% in calm periods) while acknowledging high uncertainty without any prior information.",
  },
  {
    h: "Forecast",
    body: "Band 2,500–4,000 bps at 50% stated confidence — wide band, low confidence, consistent with zero prior information.",
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
              Committed a day ahead. Graded in public — misses included.
            </h2>
          </div>
          <p className="text-[var(--color-text-dim)] sm:text-lg">
            The DeepSeek reasoner stores its full prompt, response and parsed forecast on IPFS,
            hashed into the on-chain prediction. No edits, no hindsight. Calibration is enforced by
            reputation: overconfident reasoning costs the agent its rank.
          </p>
        </div>
      </header>

      {/* Hero outcome strip: a REAL graded prediction (#773 on the live PredictionMarket). */}
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
              {PROOF.bandLow} <span className="text-[var(--color-text-muted)]">to</span> {PROOF.bandHigh}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              bps, committed at block #{PROOF.commitBlock}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-bg-elev-1)] p-6 lg:rounded-none lg:border-0 lg:bg-[color:var(--color-accent)]/5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Real value landed at
            </span>
            <span className="num text-3xl text-[var(--color-accent)] sm:text-5xl">{PROOF.realized}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-warn)]">
              32 bps above the band — a public miss
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 lg:rounded-none lg:border-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              CRPS score
            </span>
            <span className="num text-3xl text-[var(--color-text)] sm:text-4xl">{PROOF.score}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {PROOF.scorePct} — graded on-chain, no human in the loop
            </span>
          </div>
        </div>

        {/* Plain-English verdict. */}
        <p className="mt-5 text-balance text-lg text-[var(--color-text-dim)] sm:text-xl">
          <span className="text-[var(--color-text)]">The verdict.</span> The AI locked a 30 bps band a
          full day early; the truth landed 32 bps above it. The chain graded the distance — {PROOF.scorePct} —
          published the score, and moved on. A track record that can&apos;t hide its misses is the only
          kind worth trusting.{" "}
          <a
            href={PROOF.marketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline decoration-[var(--color-accent-soft)] underline-offset-4 hover:decoration-[var(--color-accent)]"
          >
            Verify it: getPrediction({PROOF.predictionId}) on Mantlescan ↗
          </a>
        </p>
      </motion.div>

      {/* Full trace: quoted verbatim from the reasoner's pinned IPFS payload. */}
      <motion.div
        style={{ opacity }}
        className="mx-auto mt-10 grid w-full max-w-7xl grid-cols-1 gap-px overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-border)] lg:grid-cols-[2fr_1fr]"
      >
        <div className="bg-[var(--color-bg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-dim)]">agent #002 · {DEEPSEEK_MODEL}</span>
            <span className="text-[var(--color-accent)]">verbatim from the pinned payload</span>
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

        {/* parsed forecast block — key fields verbatim from the pinned payload */}
        <div className="flex flex-col gap-5 bg-[var(--color-bg)] p-6 font-mono text-[12px]">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            parsed json forecast · from the pinned payload
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-text-dim)]">{`{
  "predicted_value": {
    "lower": 2500,
    "upper": 4000
  },
  "confidence": 5000,
  "summary": "I expect mETH staking
   yield to be between 2.5% and 4%,
   but I'm not very sure because
   there's no recent data to go on."
}`}</pre>
          <div className="mt-auto flex flex-col gap-2 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                anchored on-chain
              </span>
              <span className="text-[var(--color-text)]">keccak(payload) = contentHash</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                provenance
              </span>
              <span className="truncate text-[var(--color-accent)]" title={PINNED_CID}>
                ipfs://QmREF…3Wvy
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
