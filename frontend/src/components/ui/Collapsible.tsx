"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  items: {
    id: string;
    title: React.ReactNode;
    content: React.ReactNode;
  }[];
  defaultOpen?: string[];
  className?: string;
};

export function Collapsible({ items, defaultOpen, className }: Props) {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={defaultOpen}
      className={cn(
        "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]",
        className,
      )}
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          className="border-b border-[var(--color-border)] last:border-b-0"
        >
          <Accordion.Header className="flex">
            <Accordion.Trigger
              className={cn(
                "group flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left text-sm text-[var(--color-text)] transition-colors",
                "hover:bg-[var(--color-bg-elev-2)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]",
              )}
            >
              <span>{item.title}</span>
              <ChevronDown
                size={14}
                className="text-[var(--color-text-muted)] transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-sm text-[var(--color-text-dim)] data-[state=closed]:animate-none data-[state=open]:animate-none">
            <div className="px-5 pb-5 pt-1">{item.content}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
