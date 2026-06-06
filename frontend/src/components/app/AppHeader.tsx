"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { HelpCircle, ChevronDown, Menu } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { StatusPill } from "@/components/ui/StatusPill";
import { useTour } from "@/components/tour/TourProvider";
import { cn } from "@/lib/cn";

const primaryNav = [
  { href: "/insights", label: "Insights" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/try", label: "Try" },
  { href: "/pricing", label: "Pricing" },
];
const moreNav = [
  { href: "/rwa", label: "Earn" },
  { href: "/feed/meth-apr-24h", label: "Feed" },
  { href: "/demo-consumer", label: "Consumer" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
];
const allNav = [...primaryNav, ...moreNav];

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
              Noetri<span className="text-[var(--color-accent)]">x</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {primaryNav.map((item) => {
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
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)] focus-visible:text-[var(--color-text)] data-[state=open]:text-[var(--color-accent)]"
                >
                  More <ChevronDown size={13} aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[160px] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-1 shadow-xl"
                >
                  {moreNav.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className="block cursor-pointer rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] outline-none transition-colors hover:text-[var(--color-text)] focus:text-[var(--color-accent)] data-[highlighted]:text-[var(--color-accent)]"
                      >
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Menu"
                  className="inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-2 text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)]"
                >
                  <Menu size={16} aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 min-w-[180px] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-1 shadow-xl"
                >
                  {allNav.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className="block cursor-pointer rounded px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] outline-none transition-colors data-[highlighted]:text-[var(--color-accent)]"
                      >
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              network
            </span>
            <StatusPill tone="accent" dot pulse>
              Mantle Sepolia
            </StatusPill>
          </div>
          <GuideButton />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

function GuideButton() {
  const { openOnboarding } = useTour();
  return (
    <button
      type="button"
      onClick={openOnboarding}
      title="What do you want to do? Pick a guided path."
      className="hidden items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] sm:inline-flex"
    >
      <HelpCircle size={13} aria-hidden />
      Guide
    </button>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  // Wallet state is client-only; render a stable placeholder until mounted to avoid hydration drift.
  // Hydration-safe "client mounted" flag — store never changes, so subscribe is intentionally a no-op.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
