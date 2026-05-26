import * as React from "react";
import { cn } from "@/lib/cn";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  elevation?: 0 | 1 | 2;
  bordered?: boolean;
};

export function Panel({
  className,
  elevation = 1,
  bordered = true,
  ...rest
}: PanelProps) {
  const bg =
    elevation === 0
      ? "bg-transparent"
      : elevation === 1
        ? "bg-[var(--color-bg-elev-1)]"
        : "bg-[var(--color-bg-elev-2)]";
  return (
    <div
      className={cn(
        "relative",
        bg,
        bordered && "border border-[var(--color-border)]",
        "rounded-md",
        className,
      )}
      {...rest}
    />
  );
}

export function PanelHeader({
  title,
  caption,
  right,
  className,
}: {
  title: React.ReactNode;
  caption?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3.5",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {caption}
        </div>
        <div className="text-sm font-medium text-[var(--color-text)]">
          {title}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function PanelBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...rest} />;
}
