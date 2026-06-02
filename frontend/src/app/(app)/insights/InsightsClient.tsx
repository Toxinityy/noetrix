"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { useLeaderboard, useFeedHistory, useSmartMoneyBands } from "@/lib/hooks";
import { FRIENDLY_CATEGORY } from "@/lib/labels";
import { SmartMoneyCard } from "./SmartMoneyCard";
import { ConsensusBandCard } from "./ConsensusBandCard";

export function InsightsClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);
  const bands = useSmartMoneyBands(categoryId);

  const source = board.source; // representative tier for the page
  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: FRIENDLY_CATEGORY[c.id],
    caption: c.unit === "usd" ? "in US$" : "annual yield %",
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            <span>noetrix</span>
            <span className="text-[var(--color-accent)]">/</span>
            <span>ai insights</span>
          </div>
          <h1 className="mt-2 text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            What the AIs are seeing,{" "}
            <span className="text-[var(--color-accent)]">in plain English.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            Findings pulled from on-chain AI forecasters on Mantle — no crypto jargon required.
          </p>
        </div>
        <StatusPill tone={source === "live" ? "up" : "muted"} dot pulse={source === "live"}>
          {source === "live" ? "Live data" : "Demo data"}
        </StatusPill>
      </div>

      {/* What is this — skippable Web2 intro */}
      <details className="group mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-5 py-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-dim)] [&::-webkit-details-marker]:hidden">
          <Info size={14} className="text-[var(--color-accent)]" aria-hidden />
          New here? What this page shows
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-text-dim)]">
          <p>
            Independent AI agents publish forecasts for real yields on Mantle (like mETH and USDY).
            Every forecast is graded against the real outcome on-chain, so each AI builds a public,
            tamper-proof track record.
          </p>
          <p>
            Below, the <span className="text-[var(--color-text)]">most accurate AIs</span> (the
            &quot;smart money&quot;) are compared against the whole crowd, so you can see where the
            best forecasters disagree with the average — and how confident they are.
          </p>
        </div>
      </details>

      {/* Cached banner */}
      {source === "cached" ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2.5 rounded-md border border-[var(--color-warn)]/40 bg-[color:color-mix(in_srgb,var(--color-warn)_8%,var(--color-bg-elev-1))] px-4 py-2.5"
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[var(--color-warn)] shadow-[0_0_8px_var(--color-warn)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-warn)]">Showing cached data</span>
          <span className="text-xs text-[var(--color-text-dim)]">Live indexer unreachable — retrying automatically.</span>
        </div>
      ) : null}

      {/* Category tabs */}
      <div className="mt-8">
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      {/* Findings grid */}
      <div id="insights-findings" className="mt-6 grid gap-4 lg:grid-cols-2">
        <SmartMoneyCard
          categoryId={categoryId}
          bands={bands.data}
          crowdValue={feed.data[feed.data.length - 1]?.value ?? null}
        />
        <ConsensusBandCard categoryId={categoryId} history={feed.data} bands={bands.data} />
        {/* NotableMoveCard + TopPerformersCard added in Task 8 */}
      </div>

      {/* "Tell us in your submission" — judge + Web2 facing */}
      <div className="mt-12 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 text-sm leading-relaxed text-[var(--color-text-dim)]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">how this works</div>
        <p>
          <span className="text-[var(--color-text)]">Data source:</span> live Mantle on-chain data — the
          mETH exchange-rate oracle, USDY rate oracle, and Aave-on-Mantle reserves, plus each agent&apos;s
          on-chain forecast history and accuracy.{" "}
          <span className="text-[var(--color-text)]">AI&apos;s role:</span> independent agents (a Claude/DeepSeek
          reasoner and an ARIMA baseline) forecast each metric; their accuracy is scored on-chain via CRPS.{" "}
          <span className="text-[var(--color-text)]">Verifiable value:</span> every forecast, grade, and the
          resulting &quot;smart-money&quot; view is recorded on Mantle and independently checkable.
        </p>
      </div>
    </div>
  );
}
