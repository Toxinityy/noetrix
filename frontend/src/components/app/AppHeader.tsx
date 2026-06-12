"use client";

import * as React from "react";
import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ChevronDown, ExternalLink, Menu } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

// Primary nav follows the pitch priority: Alpha & Data (Insights/Leaderboard) +
// the Best-Web2-UX surface (Simulator) + the live write demo (Try). Pricing (open
// in v1) and the niche/utility routes live under More.
type NavItem = { href: string; label: string; external?: boolean };

const primaryNav: NavItem[] = [
  { href: "/terminal/dashboard", label: "Dashboard" },
  { href: "/terminal/insights", label: "Insights" },
  { href: "/terminal/leaderboard", label: "Leaderboard" },
  { href: "/terminal/simulation", label: "Simulator" },
  { href: "/terminal/try", label: "Try" },
];
const moreNav: NavItem[] = [
  { href: "/terminal/pricing", label: "Pricing" },
  { href: "/terminal/feed/meth-apr-24h", label: "Feed" },
  { href: "/terminal/demo-consumer", label: "For protocols" },
  { href: "/terminal/submit", label: "Submit" },
  { href: "/terminal/agents", label: "For agents" },
  { href: "/terminal/about", label: "About" },
  { href: "https://noetrix.gitbook.io/product-docs/", label: "Docs", external: true },
];
const allNav = [...primaryNav, ...moreNav];
const isActiveNavItem = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function AppHeader() {
  const pathname = usePathname();
  const moreActive = moreNav.some((item) => isActiveNavItem(pathname, item.href));
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [0, 12]);
  const bg = useTransform(scrollY, [0, 120], ["rgba(5,6,7,0)", "rgba(5,6,7,0.72)"]);
  const border = useTransform(scrollY, [0, 120], ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"]);

  return (
    <motion.header
      style={{
        backdropFilter: useTransform(blur, (v) => `blur(${v}px) saturate(140%)`),
        background: bg,
        borderBottom: useTransform(border, (b) => `1px solid ${b}`),
      }}
      className="fixed top-0 z-50 w-full"
    >
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-7">
          <Link href="/terminal/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/logo-noetrix.png"
              alt="Noetrix"
              width={28}
              height={28}
              priority
              className="rounded-md"
            />
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
              Noetri<span className="text-[var(--color-accent)]">x</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            {primaryNav.map((item) => {
              const active = isActiveNavItem(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-[0.16em] transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]",
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
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:text-[var(--color-text)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] data-[state=open]:text-[var(--color-accent)]",
                    moreActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]",
                  )}
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
                  {moreNav.map((item) => {
                    const itemClass = cn(
                      "block cursor-pointer rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] outline-none transition-colors hover:text-[var(--color-text)] focus:text-[var(--color-accent)] data-[highlighted]:text-[var(--color-accent)]",
                      isActiveNavItem(pathname, item.href)
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-text-dim)]",
                    );
                    return (
                      <DropdownMenu.Item key={item.href} asChild>
                        {item.external ? (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={itemClass}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {item.label} <ExternalLink size={13} aria-hidden />
                            </span>
                          </a>
                        ) : (
                          <Link href={item.href} className={itemClass}>
                            {item.label}
                          </Link>
                        )}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] lg:inline-flex"
          >
            Exit
          </Link>
          <div className="md:hidden">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Menu"
                    className="inline-flex items-center rounded-sm border border-[var(--color-accent-soft)] bg-[var(--color-accent-glow)] p-2 text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)] hover:text-black"
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
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/"
                      className="block cursor-pointer rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] outline-none transition-colors data-[highlighted]:text-[var(--color-accent)]"
                    >
                      Exit
                    </Link>
                  </DropdownMenu.Item>
                  {allNav.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block cursor-pointer rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] outline-none transition-colors data-[highlighted]:text-[var(--color-accent)]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {item.label} <ExternalLink size={13} aria-hidden />
                          </span>
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="block cursor-pointer rounded px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] outline-none transition-colors data-[highlighted]:text-[var(--color-accent)]"
                        >
                          {item.label}
                        </Link>
                      )}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <ConnectButton />
        </div>
      </div>
    </motion.header>
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
    "inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors";

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
        "border-[var(--color-accent-soft)] bg-[var(--color-accent-glow)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black",
        (!connector || isPending) && "opacity-70",
      )}
    >
      {isPending ? "Connecting…" : "Connect"}
    </button>
  );
}
