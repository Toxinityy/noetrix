"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SlideSectionProps {
  children: ReactNode;
  /** Stack index. Later sections (higher index) cover earlier ones via z-index. */
  index?: number;
  /** Whether this section participates in scroll-snap stops. Default true. */
  snap?: boolean;
  /** Skip the entrance animation (used for the very first section). */
  noEntrance?: boolean;
  /** Skip the exit animation (used for the final section). */
  noExit?: boolean;
  className?: string;
  innerClassName?: string;
}

/**
 * Single-viewport section that participates in CSS scroll-snap.
 *
 * The browser snaps the user's scroll position to the top of each `snap` section.
 * During the snap transition, the inner content animates: enters from below with
 * fade + scale, holds while in view, exits up with fade + scale.
 *
 * Pair with `html { scroll-snap-type: y mandatory }` (set in globals.css).
 */
export function SlideSection({
  children,
  index = 0,
  snap = true,
  noEntrance = false,
  noExit = false,
  className,
  innerClassName,
}: SlideSectionProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Section moves through viewport: 0 = just appearing at bottom, 0.5 = centered, 1 = just leaving at top.
  // Animation tracks scroll position so it plays during the snap transition.
  const y = useTransform(
    scrollYProgress,
    [0, 0.45, 0.55, 1],
    reduced
      ? ["0vh", "0vh", "0vh", "0vh"]
      : [noEntrance ? "0vh" : "14vh", "0vh", "0vh", noExit ? "0vh" : "-14vh"],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.32, 0.68, 1],
    [noEntrance ? 1 : 0, 1, 1, noExit ? 1 : 0],
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.45, 0.55, 1],
    reduced
      ? [1, 1, 1, 1]
      : [noEntrance ? 1 : 0.92, 1, 1, noExit ? 1 : 0.94],
  );
  const blur = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [
    noEntrance ? 0 : 14,
    0,
    0,
    noExit ? 0 : 10,
  ]);
  const filter = useTransform(blur, (v) => (reduced ? "none" : `blur(${v}px)`));

  return (
    <section
      ref={ref}
      className={cn(
        "relative h-svh w-full overflow-hidden bg-[var(--color-bg)]",
        snap && "snap-start snap-always",
        className,
      )}
      style={{ zIndex: index + 1 }}
    >
      <motion.div
        style={{ y, opacity, scale, filter }}
        className={cn("flex h-full w-full flex-col", innerClassName)}
      >
        {children}
      </motion.div>
    </section>
  );
}
