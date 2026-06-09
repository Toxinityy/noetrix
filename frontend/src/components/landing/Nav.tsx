"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";

export function Nav() {
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 120], [0, 12]);
  const bg = useTransform(scrollY, [0, 120], ["rgba(5,6,7,0)", "rgba(5,6,7,0.72)"]);
  const border = useTransform(scrollY, [0, 120], ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"]);

  return (
    <motion.nav
      style={{
        backdropFilter: useTransform(blur, (v) => `blur(${v}px) saturate(140%)`),
        background: bg,
        borderBottom: useTransform(border, (b) => `1px solid ${b}`),
      }}
      className="fixed top-0 z-50 w-full"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_var(--color-accent)]" />
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
            Noetri<span className="text-[var(--color-accent)]">x</span>
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {[
            ["Start", "#start-here"],
            ["Categories", "#categories"],
            ["How it works", "#how"],
            ["FAQ", "#faq"],
            ["For builders", "/terminal/demo-consumer"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-text)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
            >
              {label}
            </a>
          ))}
        </div>

        <a
          href="/terminal/leaderboard"
          className="group inline-flex items-center gap-2 rounded-sm border border-[var(--color-accent-soft)] bg-[var(--color-accent-glow)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent)] hover:text-black"
        >
          <span>Enter terminal</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] group-hover:bg-black group-hover:shadow-none" />
        </a>
      </div>
    </motion.nav>
  );
}
