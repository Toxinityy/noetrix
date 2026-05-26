"use client";

import * as Tabs from "@radix-ui/react-tabs";
import * as React from "react";
import { cn } from "@/lib/cn";

export type CategoryTab = {
  id: string;
  label: string;
  caption?: React.ReactNode;
};

type Props = {
  tabs: CategoryTab[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
};

export function CategoryTabs({ tabs, value, onValueChange, className }: Props) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange} className={cn("w-full", className)}>
      <Tabs.List
        className="flex w-full flex-wrap items-stretch gap-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]"
        aria-label="Categories"
      >
        {tabs.map((t) => (
          <Tabs.Trigger
            key={t.id}
            value={t.id}
            className={cn(
              "group relative flex-1 min-w-[180px] cursor-pointer border-r border-[var(--color-border)] px-5 py-3 text-left transition-colors last:border-r-0",
              "hover:bg-[var(--color-bg-elev-2)]",
              "data-[state=active]:bg-[var(--color-bg-elev-2)]",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] group-data-[state=active]:text-[var(--color-accent)]">
                {t.id}
              </span>
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--color-text)]">
              {t.label}
            </div>
            {t.caption ? (
              <div className="mt-0.5 text-[11px] text-[var(--color-text-dim)]">
                {t.caption}
              </div>
            ) : null}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--color-accent)] opacity-0 transition-opacity group-data-[state=active]:opacity-100"
            />
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
