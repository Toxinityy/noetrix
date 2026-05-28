import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  detail?: string;
  retry?: ReactNode;
  className?: string;
};

export function ErrorState({ title, detail, retry, className }: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-md border border-[var(--color-down)]/40 bg-[color:color-mix(in_srgb,var(--color-down)_8%,var(--color-bg-elev-1))] px-5 py-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full bg-[var(--color-down)] shadow-[0_0_8px_var(--color-down)]"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-down)]">
          Error
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
        {detail ? (
          <p className="text-xs leading-relaxed text-[var(--color-text-dim)]">{detail}</p>
        ) : null}
      </div>
      {retry ? <div>{retry}</div> : null}
    </div>
  );
}
