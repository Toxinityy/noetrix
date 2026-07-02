"use client";

import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Composite-feed pulse. Two synthetic feeds animate over a time window with a
 * confidence band, giving the page a living "data heart". The live composite is
 * read from CompositeFeed on Mantle Sepolia in the app surfaces.
 */

const W = 720;
const H = 220;
const POINTS = 96;

function seedSeries(seed: number, amplitude: number, drift: number) {
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i < POINTS; i++) {
    const noise = Math.sin(i * 0.21 + seed) * 0.6 + Math.sin(i * 0.07 + seed * 1.3) * 0.4;
    v = v * 0.82 + noise * 0.18;
    out.push(v * amplitude + Math.sin(i * 0.04) * drift);
  }
  return out;
}

function toPath(values: number[], yMid: number, yScale: number): string {
  return values
    .map((v, i) => {
      const x = (i / (POINTS - 1)) * W;
      const y = yMid - v * yScale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function bandPath(upper: number[], lower: number[], yMid: number, yScale: number): string {
  const top = upper
    .map((v, i) => {
      const x = (i / (POINTS - 1)) * W;
      const y = yMid - v * yScale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const bottom = lower
    .map((v, i) => {
      const x = ((POINTS - 1 - i) / (POINTS - 1)) * W;
      const y = yMid - v * yScale;
      return `L${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return `${top} ${bottom} Z`;
}

export function LivePulse() {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  const ref = useRef<SVGSVGElement>(null);
  const value = useMotionValue(412);
  const displayValue = useTransform(value, (v) => v.toFixed(1));

  useAnimationFrame((t) => {
    if (reduced) return;
    setTick(Math.floor(t / 800));
    const target = 400 + Math.sin(t / 1800) * 32 + Math.sin(t / 540) * 6;
    value.set(value.get() + (target - value.get()) * 0.06);
  });

  // Two series + their CIs
  const drift = (tick % 12) * 0.04;
  const mid = seedSeries(0.7 + drift, 1.0, 0.3);
  const upper = mid.map((v) => v + 0.55 + Math.sin(v) * 0.1);
  const lower = mid.map((v) => v - 0.6 + Math.cos(v) * 0.1);
  const secondary = seedSeries(2.3 + drift * 0.5, 0.7, 0.2);

  const yMid = H / 2;
  const yScale = 36;

  return (
    <section
      id="composite"
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-1 scroll-mt-24 flex-col justify-center px-6 py-20"
    >
      <header className="mb-10 flex flex-col gap-2">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[var(--color-accent)]" />
          Live · composite feed
        </div>
        <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
          The consensus of the most calibrated agents,
          <span className="text-[var(--color-text-dim)]"> read by any contract.</span>
        </h2>
        <p className="max-w-2xl text-[var(--color-text-dim)]">
          Rank-weighted ensemble of the top-20 agents per category. Outlier-resistant confidence.
          Refreshed hourly via a permissionless cron worker.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]">
        {/* meta strip */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          <div className="flex items-center gap-6">
            <span className="text-[var(--color-text-dim)]">METH_APR_24H</span>
            <span>· bps</span>
            <span className="hidden sm:inline">· N=20</span>
          </div>
          <div className="flex items-center gap-2 text-[var(--color-accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
            live · {tick.toString().padStart(4, "0")}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 sm:grid-cols-[1fr_220px]">
          {/* Chart */}
          <div className="relative">
            <svg
              ref={ref}
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="block h-[260px] w-full"
              aria-label="Composite feed chart, illustrative preview"
            >
              {/* gridlines */}
              {[0, 1, 2, 3, 4].map((i) => (
                <line
                  key={i}
                  x1={0}
                  x2={W}
                  y1={(H * (i + 1)) / 6}
                  y2={(H * (i + 1)) / 6}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
              ))}

              {/* confidence band */}
              <motion.path
                d={bandPath(upper, lower, yMid, yScale)}
                fill="var(--color-accent)"
                fillOpacity={0.07}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* secondary (lighter) series */}
              <motion.path
                d={toPath(secondary, yMid, yScale)}
                fill="none"
                stroke="rgba(231,236,243,0.22)"
                strokeWidth={1.2}
                strokeDasharray="3 4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              />

              {/* main series */}
              <motion.path
                d={toPath(mid, yMid, yScale)}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.8}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />

              {/* pulsing latest dot */}
              <motion.circle
                cx={W - 4}
                cy={yMid - mid[mid.length - 1] * yScale}
                r={4}
                fill="var(--color-accent)"
                animate={
                  reduced
                    ? {}
                    : {
                        r: [4, 7, 4],
                        opacity: [1, 0.5, 1],
                      }
                }
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            {/* x-axis ticks */}
            <div className="flex justify-between border-t border-[var(--color-border)] px-5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {["-24h", "-18h", "-12h", "-6h", "now"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>

          {/* stats panel */}
          <div className="flex flex-col border-l border-[var(--color-border)]">
            <Stat label="Composite" value={<motion.span>{displayValue}</motion.span>} unit="bps" emphasized />
            <Stat label="Confidence" value="76.4" unit="%" />
            <Stat label="Agents" value="7 / 20" unit="contributing" />
            <Stat label="Refresh cadence" value="hourly" unit="cron" muted />
            <button className="group mt-auto border-t border-[var(--color-border)] px-5 py-4 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-black">
              Subscribe to feed
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </button>
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        Illustrative preview. Live composite reads from CompositeFeed on Mantle Sepolia.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  emphasized = false,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  emphasized?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border)] px-5 py-4 last:border-b-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span
          className={`num text-2xl ${
            emphasized
              ? "text-[var(--color-accent)]"
              : muted
                ? "text-[var(--color-text-dim)]"
                : "text-[var(--color-text)]"
          }`}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function useAnimationFrameTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setT((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}
