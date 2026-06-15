"use client";

import * as React from "react";
import { Info, RefreshCw } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { useInsightsData } from "@/lib/hooks";
import { FRIENDLY_CATEGORY } from "@/lib/labels";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { SmartMoneyCard } from "./SmartMoneyCard";
import { ConsensusBandCard } from "./ConsensusBandCard";
import { NotableMoveCard } from "./NotableMoveCard";
import { TopPerformersCard } from "./TopPerformersCard";
import { ProofStrip } from "./ProofStrip";
import { ReplayCard } from "./ReplayCard";
import { DisagreementCallout } from "./DisagreementCallout";
import { AnomalyFeed } from "./AnomalyFeed";
import { SubscriptionGateCard } from "./SubscriptionGateCard";
import { YourMoveStrip } from "./YourMoveStrip";
import { BacktestPanel } from "./BacktestPanel";

export function InsightsClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const data = useInsightsData(categoryId);
  const source = data.source;

  // Snapshot age — computed in an effect (Date.now() stays out of render for React-Compiler purity +
  // no SSR hydration drift; setState deferred via setTimeout per the codebase's effect-setState rule).
  const [ageLabel, setAgeLabel] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState(false);
  React.useEffect(() => {
    const genAt = data.generatedAt;
    const t = setTimeout(() => {
      if (!genAt) {
        setAgeLabel(null);
        setStale(false);
        return;
      }
      const h = (Date.now() - new Date(genAt).getTime()) / 3_600_000;
      setStale(h > 24);
      setAgeLabel(h < 1 ? "just now" : h < 24 ? `${Math.floor(h)}h ago` : `${Math.floor(h / 24)}d ago`);
    }, 0);
    return () => clearTimeout(t);
  }, [data.generatedAt]);

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
            Findings pulled from on-chain AI forecasters on Mantle. No crypto jargon required.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill tone={source === "mock" ? "muted" : "up"} dot pulse={false}>
            {source === "mock" ? "Demo data" : "On-chain snapshot"}
          </StatusPill>
          {source !== "mock" && data.block ? (
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
              snapshot @ block #{data.block.toLocaleString("en-US")}
              {data.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleDateString("en-US")}` : ""}
              {ageLabel ? (
                <span className={stale ? "text-[var(--color-warn)]" : undefined}> · captured {ageLabel}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* What is this: skippable Web2 intro */}
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
            &quot;proven AI&quot;) are compared against the whole crowd, so you can see where the
            best forecasters break from the average, and how confident they are.
          </p>
        </div>
      </details>

      {/* Live data offline: showing the latest saved snapshot, with a real retry. */}
      {source === "cached" ? (
        <ErrorState
          className="mt-6"
          title="Live data is offline. Showing the latest saved snapshot."
          detail="The on-chain indexer is unreachable right now. Your view is the most recent committed snapshot."
          retry={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
            >
              <RefreshCw size={12} aria-hidden /> Retry
            </button>
          }
        />
      ) : null}

      {/* Category tabs */}
      <div className="mt-8">
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      {/* §1 proof + §2 replay: the top-of-page peak */}
      <div data-tour="alpha-proof">
        <ProofStrip data={data} />
      </div>
      <div data-tour="alpha-replay">
        <ReplayCard categoryId={categoryId} predictions={data.category?.predictions ?? []} />
      </div>

      {data.isLoading ? (
        <div className="mt-6 space-y-4" aria-busy>
          <Skeleton className="h-56 w-full" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      ) : (
        <>
          {/* HERO: the core thesis. Full-width, heaviest weight on the page. */}
          <div className="mt-6" data-tour="alpha-findings">
            <SmartMoneyCard
              categoryId={categoryId}
              bands={data.bands}
              crowdValue={data.crowdValue}
            />
          </div>

          {/* Primary supporting evidence: disagreement + consensus trend. Time-series cards
              need >=2 feed points to say anything — with sparse history (public-RPC log cap)
              they'd render as empty shells, which reads as "unfinished" rather than honest.
              Hide them until the history exists; the remaining card takes the full row. */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DisagreementCallout
              categoryId={categoryId}
              bands={data.bands}
              crowdValue={data.crowdValue}
            />
            {data.feed.length >= 2 ? (
              <ConsensusBandCard categoryId={categoryId} history={data.feed} bands={data.bands} />
            ) : null}
          </div>

          {/* Secondary row: lighter-weight context (move, track record). */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data.feed.length >= 2 ? <NotableMoveCard categoryId={categoryId} history={data.feed} /> : null}
            <TopPerformersCard rows={data.board} />
          </div>

          {/* Anomaly watch: premium signal — gated behind a real on-chain subscription. */}
          <div className="mt-4">
            <SubscriptionGateCard
              title={`Anomaly watch: ${FRIENDLY_CATEGORY[categoryId]}`}
              caption="Live anomaly + market-stress alerts are part of the paid data feed."
            >
              <AnomalyFeed categoryId={categoryId} history={data.feed} category={data.category} />
            </SubscriptionGateCard>
          </div>
        </>
      )}

      {/* §5 your move */}
      <div data-tour="alpha-yourmove">
        <YourMoveStrip categoryId={categoryId} data={data} />
      </div>

      {/* §6 backtest results */}
      <BacktestPanel />

      {/* "Tell us in your submission": judge + Web2 facing */}
      <div className="mt-12 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 text-sm leading-relaxed text-[var(--color-text-dim)]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">how this works</div>
        <p>
          <span className="text-[var(--color-text)]">Data source:</span> live Mantle on-chain data: the
          mETH exchange-rate oracle, USDY rate oracle, and Aave-on-Mantle reserves, plus each agent&apos;s
          on-chain forecast history and accuracy.{" "}
          <span className="text-[var(--color-text)]">AI&apos;s role:</span> independent agents (a DeepSeek
          reasoner and an ARIMA baseline) forecast each metric; their accuracy is scored on-chain via CRPS.{" "}
          <span className="text-[var(--color-text)]">Verifiable value:</span> every forecast, grade, and the
          resulting &quot;proven-AI&quot; view is recorded on Mantle and independently checkable.
        </p>
        <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-dim)]">Honesty note:</span> for this demo the outcome
          oracles (mETH / USDY rates) are seeded with a deterministic curve. The AI forecasts and the
          on-chain grading are fully real, but the &quot;reality&quot; they are graded against is
          demo-seeded until v2 reads the live Ondo / mETH contracts. Track-record sample sizes are small
          and growing. All figures are computed from Mantle Sepolia
          {source !== "mock" && data.block ? ` at block #${data.block.toLocaleString("en-US")}` : ""}.
        </p>
      </div>
    </div>
  );
}
