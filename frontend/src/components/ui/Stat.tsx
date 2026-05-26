import * as React from "react";
import { cn } from "@/lib/cn";

type StatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "up" | "down" | "warn" | "accent";
  className?: string;
};

const toneColor: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-[var(--color-text)]",
  up: "text-[var(--color-up)]",
  down: "text-[var(--color-down)]",
  warn: "text-[var(--color-warn)]",
  accent: "text-[var(--color-accent)]",
};

export function Stat({ label, value, sub, tone = "default", className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn("font-mono text-2xl leading-none tabular", toneColor[tone])}>
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-[var(--color-text-dim)]">{sub}</div>
      ) : null}
    </div>
  );
}
