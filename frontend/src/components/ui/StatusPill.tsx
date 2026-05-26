import * as React from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "up" | "down" | "warn" | "accent" | "muted";

const toneStyles: Record<Tone, string> = {
  neutral:
    "border-[var(--color-border)] bg-[var(--color-bg-elev-1)] text-[var(--color-text-dim)]",
  up: "border-[color:var(--color-up)]/30 bg-[color:var(--color-up)]/8 text-[var(--color-up)]",
  down: "border-[color:var(--color-down)]/30 bg-[color:var(--color-down)]/8 text-[var(--color-down)]",
  warn: "border-[color:var(--color-warn)]/30 bg-[color:var(--color-warn)]/10 text-[var(--color-warn)]",
  accent:
    "border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent)]/8 text-[var(--color-accent)]",
  muted:
    "border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]",
};

type Props = {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function StatusPill({
  tone = "neutral",
  dot,
  pulse,
  children,
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        toneStyles[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn(
            "relative inline-block h-1.5 w-1.5 rounded-full",
            tone === "up" && "bg-[var(--color-up)]",
            tone === "down" && "bg-[var(--color-down)]",
            tone === "warn" && "bg-[var(--color-warn)]",
            tone === "accent" && "bg-[var(--color-accent)]",
            (tone === "neutral" || tone === "muted") && "bg-current",
          )}
        >
          {pulse ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" />
          ) : null}
        </span>
      ) : null}
      {children}
    </span>
  );
}
