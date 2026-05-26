"use client";

import * as React from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { shortAddr } from "@/lib/format";
import { cn } from "@/lib/cn";

type Props = {
  address: string;
  href?: string;
  className?: string;
};

export function AddressChip({ address, href, className }: Props) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-2 py-1 font-mono text-[11px] text-[var(--color-text-dim)] tabular",
        className,
      )}
    >
      <span>{shortAddr(address)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)] focus:text-[var(--color-accent)] focus:outline-none"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label="View on explorer"
          className="text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        >
          <ExternalLink size={11} />
        </a>
      ) : null}
    </span>
  );
}
