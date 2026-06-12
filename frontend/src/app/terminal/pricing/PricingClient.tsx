"use client";

import Link from "next/link";
import { Check } from "lucide-react";

const CONTACT_URL = "https://github.com/Toxinityy/noetrix";

const TIERS = [
  {
    name: "Pro / Whale",
    audience: "Traders, funds, yield farmers",
    price: "0.5 test MNT",
    cadence: "/ 30 days",
    features: [
      "Calibration-weighted alpha signal across all 3 markets",
      "Smart-money-vs-crowd divergence + confidence bands",
      "In-app anomaly + smart-money alerts",
    ],
  },
  {
    name: "Protocol / API",
    audience: "Vaults, lending markets, integrators",
    price: "2 test MNT",
    cadence: "/ 30 days",
    features: [
      "Everything in Pro",
      "On-chain signal for your contracts (risk + allocation)",
      "API access + integration support",
    ],
  },
] as const;

export function PricingClient() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-[var(--color-text)]">Pricing</h1>
        <span className="rounded border border-[var(--color-warn)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warn)]">
          For demo
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-[var(--color-text-dim)]">
        Demo pricing in testnet MNT for access to Noetrix&apos;s calibration-weighted forecast
        signal — these are hackathon-demo prices on Mantle Sepolia, not production rates. Contact
        the team to join the pilot.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => (
          <section
            key={tier.name}
            className="flex flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              {tier.audience}
            </div>
            <h2 className="mt-1 text-lg font-medium text-[var(--color-text)]">{tier.name}</h2>
            <div className="mt-2 text-2xl font-semibold text-[var(--color-accent)]">
              {tier.price}{" "}
              {tier.cadence && (
                <span className="text-sm text-[var(--color-text-dim)]">{tier.cadence}</span>
              )}
            </div>

            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-text-dim)]">
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-up)]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-5 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"
            >
              Contact us
            </a>
          </section>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/terminal/about" className="text-sm text-[var(--color-accent)] hover:underline">
          How the forecast network works → about
        </Link>
      </div>
    </div>
  );
}
