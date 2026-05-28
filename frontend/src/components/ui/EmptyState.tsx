import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, body, action, className }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
        {body ? (
          <p className="max-w-sm text-xs leading-relaxed text-[var(--color-text-dim)]">
            {body}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
