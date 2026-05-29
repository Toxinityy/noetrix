"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
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
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = React.useState(false);

  // Wallet state is client-only; render a stable placeholder until mounted to avoid hydration drift.
  React.useEffect(() => setMounted(true), []);

  const base =
    "inline-flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors";

  if (!mounted) {
    return (
      <span
        className={cn(base, "border-[var(--color-border)] bg-[var(--color-bg-elev-1)] text-[var(--color-text-muted)]")}
      >
        Connect
      </span>
    );
  }

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        title="Click to disconnect"
        className={cn(
          base,
          "border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-accent)] hover:border-[var(--color-down)] hover:text-[var(--color-down)]",
        )}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-up)]" />
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  const connector = connectors[0];
  return (
    <button
      type="button"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      title={connector ? "Connect an injected wallet (e.g. MetaMask)" : "No injected wallet detected"}
      className={cn(
        base,
        "border-[var(--color-border)] bg-[var(--color-bg-elev-1)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
        (!connector || isPending) && "opacity-70",
      )}
    >
      {isPending ? "Connecting…" : "Connect"}
    </button>
  );
}
