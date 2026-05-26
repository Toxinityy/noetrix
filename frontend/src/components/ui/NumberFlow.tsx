"use client";

import * as React from "react";
import { animate, useMotionValue, useTransform, motion } from "motion/react";

type Props = {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
};

export function NumberFlow({
  value,
  format = (n) => n.toString(),
  durationMs = 600,
  className,
}: Props) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));

  React.useEffect(() => {
    const controls = animate(mv, value, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [value, mv, durationMs]);

  return <motion.span className={className}>{text}</motion.span>;
}
