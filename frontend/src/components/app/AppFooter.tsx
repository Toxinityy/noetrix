import * as React from "react";
import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--color-border)] bg-[var(--color-bg)] py-10">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-10 px-5 sm:grid-cols-4 sm:px-8">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]"
              style={{ boxShadow: "0 0 14px var(--color-accent-glow)" }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-text)]">
              Noetri<span className="text-[var(--color-accent)]">x</span>
            </span>
          </div>
          <p className="mt-4 max-w-xs text-[12px] leading-relaxed text-[var(--color-text-dim)]">
            On-chain AI agent forecasting protocol on Mantle. Verifiable predictions,
            reputation-weighted ensemble feed, ERC-8004 soulbound identity.
          </p>
        </div>

        <FooterColumn label="Surfaces">
          <FooterLink href="/terminal/leaderboard">Leaderboard</FooterLink>
          <FooterLink href="/terminal/feed/meth-apr-24h">Composite feed</FooterLink>
          <FooterLink href="/terminal/demo-consumer">Consumer demo</FooterLink>
          <FooterLink href="/">Landing</FooterLink>
        </FooterColumn>

        <FooterColumn label="Categories">
          <FooterLink href="/terminal/feed/meth-apr-24h">METH_APR_24H</FooterLink>
          <FooterLink href="/terminal/feed/aave-mantle-tvl">AAVE_MANTLE_TVL_24H</FooterLink>
        </FooterColumn>

        <FooterColumn label="System">
          <FooterStat k="Chain" v="Mantle Sepolia (5003)" />
          <FooterStat k="Block time" v="≈ 2.0s" />
          <FooterStat k="Epoch length" v="1000 blocks" />
          <FooterStat k="Hackathon" v="Turing Test 2026" />
        </FooterColumn>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1400px] flex-col gap-2 border-t border-[var(--color-border)] px-5 pt-6 text-[10px] text-[var(--color-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="font-mono uppercase tracking-[0.18em]">
          v0.1 · testnet · not financial advice
        </span>
        <span className="font-mono">
          Built for The Turing Test Hackathon · Mantle × Bybit × Byreal × BGA
        </span>
      </div>
    </footer>
  );
}

function FooterColumn({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <ul className="mt-3 space-y-2 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-[var(--color-text-dim)] transition-colors hover:text-[var(--color-accent)]"
      >
        {children}
      </Link>
    </li>
  );
}

function FooterStat({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[12px]">
      <span className="text-[var(--color-text-muted)]">{k}</span>
      <span className="font-mono text-[var(--color-text-dim)] tabular">{v}</span>
    </li>
  );
}
