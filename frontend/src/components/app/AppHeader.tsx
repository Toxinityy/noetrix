"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/feed/meth-apr-24h", label: "Feed" },
  { href: "/demo-consumer", label: "Consumer" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-md"
    >
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
              style={{ boxShadow: "0 0 14px var(--color-accent-glow)" }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text)]">
              Predictor<span className="text-[var(--color-accent)]">_</span>Index
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href.split("/").slice(0, 2).join("/")));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors",
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              network
            </span>
            <StatusPill tone="accent" dot pulse>
              Mantle Sepolia
            </StatusPill>
          </div>
          <button
            type="button"
            disabled
            title="Wallet integration ships with Prompt 11"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] opacity-70"
          >
            Connect
          </button>
        </div>
      </div>
    </header>
  );
}
