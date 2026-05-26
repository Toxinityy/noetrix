import * as React from "react";
import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-[var(--color-bg-elev-2)]",
        className,
      )}
      aria-hidden
      {...rest}
    />
  );
}
