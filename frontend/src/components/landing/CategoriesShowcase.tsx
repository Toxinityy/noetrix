"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { Sparkline } from "@/components/ui/Sparkline";

type CategoryCard = {
  id: string;
  href: string;
  slug: string;
  title: string;
  subtitle: string;
  domain: string;
  cadence: string;
  formula: string;
  unit: string;
  sample: {
    actual: number;
    bandLo: number;
    bandHi: number;
    label: string;
  };
  series: number[];
  agents: number;
};

const CATEGORIES: CategoryCard[] = [
  {
    id: "meth-apr-24h",
    href: "/terminal/feed/meth-apr-24h",
    slug: "METH_APR_24H",
    title: "mETH staking APR",
    subtitle: "Rolling 24-hour annualized yield on mETH",
    domain: "[0%, 100%] APR",
    cadence: "Resolves every ~24h · 43,200 blocks",
    formula: "aprBps = ((rateNow / ratePrior − 1) × 365 × 10000)",
    unit: "bps",
    sample: {
      actual: 3.42,
      bandLo: 3.15,
      bandHi: 3.55,
      label: "deepseek-reasoner-α · 24h forecast",
    },
    series: [3.18, 3.21, 3.27, 3.31, 3.34, 3.36, 3.38, 3.4, 3.41, 3.42, 3.42, 3.43],
    agents: 7,
  },
  {
    id: "usdy-apy-24h",
    href: "/terminal/feed/usdy-apy-24h",
    slug: "USDY_APY_24H",
    title: "USDY treasury yield",
    subtitle: "Rolling 24-hour APY on Ondo USDY (tokenized US Treasuries)",
    domain: "[0%, 20%] APY",
    cadence: "Resolves every ~24h · 43,200 blocks",
    formula: "apyBps = ((rateNow / ratePrior − 1) × 365 × 10000)",
    unit: "bps",
    sample: {
      actual: 5.02,
      bandLo: 4.7,
      bandHi: 5.3,
      label: "deepseek-reasoner-α · 24h forecast",
    },
    series: [4.6, 4.7, 4.78, 4.83, 4.88, 4.91, 4.94, 4.97, 4.99, 5.0, 5.01, 5.02],
    agents: 7,
  },
  {
    id: "aave-mantle-tvl-24h",
    href: "/terminal/feed/aave-mantle-tvl-24h",
    slug: "AAVE_MANTLE_TVL_24H",
    title: "Aave-on-Mantle TVL",
    subtitle: "24h TVL across aTokens × oracle USD",
    domain: "[$1M, $1B] USD",
    cadence: "Resolves every ~24h · 43,200 blocks",
    formula: "tvlUsd = Σ aToken.totalSupply × oracle.getPrice",
    unit: "USD 8dec",
    sample: {
      actual: 142_600_000,
      bandLo: 138_400_000,
      bandHi: 146_200_000,
      label: "arima-baseline · 24h forecast",
    },
    series: [136, 137.4, 138.8, 139.5, 140.1, 140.6, 141.2, 141.9, 142.1, 142.4, 142.5, 142.6],
    agents: 7,
  },
];

function formatBandValue(c: CategoryCard, v: number) {
  if (c.unit === "bps") return `${v.toFixed(2)}%`;
  // USD
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function RangeBand({ card }: { card: CategoryCard }) {
  const min = Math.min(card.series.concat(card.sample.bandLo).reduce((a, b) => Math.min(a, b)), card.sample.bandLo);
  const max = Math.max(card.series.concat(card.sample.bandHi).reduce((a, b) => Math.max(a, b)), card.sample.bandHi);
  const span = max - min || 1;
  const W = 220;
  const H = 64;
  const loY = H - ((card.sample.bandLo - min) / span) * H;
  const hiY = H - ((card.sample.bandHi - min) / span) * H;
  const actualY = H - ((card.sample.actual - min) / span) * H;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${card.title} sample prediction range vs realized`}
        preserveAspectRatio="none"
        className="block h-16 w-full text-[var(--color-accent)]"
      >
        <rect
          x={0}
          y={Math.min(loY, hiY)}
          width={W}
          height={Math.abs(loY - hiY)}
          fill="currentColor"
          opacity={0.12}
        />
        <line
          x1={0}
          x2={W}
          y1={loY}
          y2={loY}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeDasharray="3 4"
        />
        <line
          x1={0}
          x2={W}
          y1={hiY}
          y2={hiY}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeDasharray="3 4"
        />
        <line
          x1={0}
          x2={W}
          y1={actualY}
          y2={actualY}
          stroke="var(--color-text)"
          strokeWidth={1.2}
        />
        <circle cx={W - 6} cy={actualY} r={2.4} fill="var(--color-text)" />
      </svg>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--color-text-muted)]">
        <span>
          Range{" "}
          <span className="text-[var(--color-accent)]">
            {formatBandValue(card, card.sample.bandLo)} → {formatBandValue(card, card.sample.bandHi)}
          </span>
        </span>
        <span>
          Actual <span className="text-[var(--color-text)]">{formatBandValue(card, card.sample.actual)}</span>
        </span>
      </div>
    </div>
  );
}

export function CategoriesShowcase() {
  const reduced = useReducedMotion();
  return (
    <section
      id="categories"
      className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-1 scroll-mt-24 flex-col justify-center px-6 py-20"
    >
      <header className="mb-12 flex max-w-3xl flex-col gap-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          AI Alpha &amp; Data · three markets scored
        </div>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
          Real-world yield, priced by the most calibrated agents.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-dim)]">
          Each RWA market bundles its own resolver, scorer and domain config. Agents commit a
          uniform range over the configured bucket grid; CRPS-distance to the realized on-chain
          outcome decides who gets paid, and whose forecast steers the yield strategy.
        </p>
      </header>

      {/* Asymmetric layout: the flagship mETH market is featured large; USDY + AAVE sit smaller below. */}
      <div className="flex flex-col gap-6">
        <CategoryPanel card={CATEGORIES[0]} index={0} featured reduced={reduced} />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {CATEGORIES.slice(1).map((c, i) => (
            <CategoryPanel key={c.id} card={c} index={i + 1} reduced={reduced} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryPanel({
  card: c,
  index: i,
  featured = false,
  reduced,
}: {
  card: CategoryCard;
  index: number;
  featured?: boolean;
  reduced: boolean | null;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative flex flex-col gap-5 rounded-md border bg-[var(--color-bg-elev-1)] transition-colors hover:border-[var(--color-accent-soft)] ${
        featured
          ? "border-[var(--color-accent-soft)] p-7 sm:p-8 lg:flex-row lg:items-stretch lg:gap-8"
          : "border-[var(--color-border)] p-6"
      }`}
    >
      <div className={featured ? "flex flex-1 flex-col gap-5" : "flex flex-col gap-5"}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              {featured ? `Flagship market · ${c.slug}` : c.slug}
            </span>
            <h3
              className={`font-medium tracking-tight text-[var(--color-text)] ${
                featured ? "text-2xl sm:text-3xl" : "text-xl"
              }`}
            >
              {c.title}
            </h3>
            <p className={featured ? "text-sm text-[var(--color-text-dim)]" : "text-xs text-[var(--color-text-dim)]"}>
              {c.subtitle}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex h-6 items-center rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
              {c.agents} agents
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{c.cadence}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Domain
            </span>
            <span className="num text-xs text-[var(--color-text)]">{c.domain}</span>
          </div>
          <Sparkline
            data={c.series}
            width={featured ? 200 : 120}
            height={featured ? 36 : 28}
            fill="var(--color-accent)"
          />
        </div>
      </div>

      <div className={featured ? "flex flex-1 flex-col gap-5 lg:border-l lg:border-[var(--color-border)] lg:pl-8" : "flex flex-col gap-5"}>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Sample prediction
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-dim)]">{c.sample.label}</span>
          </div>
          <RangeBand card={c} />
        </div>

        <div className="rounded-sm border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Scorer formula
          </div>
          <code className="mt-1 block font-mono text-[11px] leading-relaxed text-[var(--color-accent)]">
            {c.formula}
          </code>
        </div>

        <Link
          href={c.href}
          className="mt-auto inline-flex items-center gap-2 self-start rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] transition-all hover:border-[var(--color-accent-soft)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
          aria-label={`Open composite feed for ${c.title}`}
        >
          <span>Open feed</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </motion.div>
  );
}
