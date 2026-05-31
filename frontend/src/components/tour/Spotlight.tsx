"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTour } from "./TourProvider";
import { cn } from "@/lib/cn";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 320;
const CARD_EST_H = 180;
const GAP = 14;

export function Spotlight() {
  const { steps, index, next, prev, skip, finish } = useTour();
  const reduced = useReducedMotion();
  const [rect, setRect] = React.useState<Rect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = React.useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // On step change: scroll target into view (instant) then measure next frame.
  React.useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [step, measure]);

  // Re-measure on resize/scroll.
  React.useEffect(() => {
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  // Focus management + keyboard nav.
  React.useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) finish();
        else next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    const restore = prevFocus.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      restore?.focus?.();
    };
  }, [isLast, next, prev, skip, finish]);

  if (!step) return null;

  // Callout placement: prefer below the target, flip above if it would overflow.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  let cardTop = 24;
  let cardLeft = 24;
  if (rect) {
    const below = rect.top + rect.height + GAP;
    const placeBelow = below + CARD_EST_H < vh;
    cardTop = placeBelow ? below : Math.max(GAP, rect.top - CARD_EST_H - GAP);
    cardLeft = Math.min(Math.max(GAP, rect.left), vw - CARD_W - GAP);
  }

  const spring = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 300, damping: 32 } as const);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Click-blocker keeps the user on the tour; advance via the buttons. */}
      <div className="absolute inset-0" aria-hidden />

      {/* Spotlight cutout — dark low-opacity scrim everywhere except the target. */}
      {rect ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-lg"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={spring}
          style={{
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
            border: "1px solid var(--color-accent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" aria-hidden />
      )}

      {/* Callout card */}
      <motion.div
        ref={cardRef}
        tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute w-[320px] max-w-[calc(100vw-28px)] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-4 shadow-2xl focus:outline-none"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Guide · {index + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={skip}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Skip
          </button>
        </div>
        <h3 className="mt-2 text-sm font-medium text-[var(--color-text)]">{step.title}</h3>
        <p
          aria-live="polite"
          className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-dim)]"
        >
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className={cn(
              "rounded border border-[var(--color-border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
              index === 0
                ? "opacity-40"
                : "text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
            )}
          >
            Back
          </button>
          <button
            type="button"
            onClick={isLast ? finish : next}
            className="rounded border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-black transition-colors hover:bg-white"
          >
            {isLast ? "Finish" : "Next →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
