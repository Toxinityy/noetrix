"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, TrendingDown, TrendingUp } from "lucide-react";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { anomalyTimeline } from "@/lib/insights";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";
import type { SnapCategory } from "@/lib/snapshot";

function fearGreedLabel(value: number): string {
  if (value <= 20) return "extreme fear";
  if (value <= 40) return "fear";
  if (value <= 60) return "neutral";
  if (value <= 80) return "greed";
  return "extreme greed";
}

/** Compose the alert text from the real on-chain stress signal when available; fall back to anomaly-derived text. */
function composeAlertText(
  categoryId: CategoryId,
  stress: SnapCategory["stress"],
  swarmAgreementPct: SnapCategory["swarmAgreementPct"],
  fearGreed: SnapCategory["fearGreed"],
  fallback: string,
): string {
  if (stress == null) {
    return `calibrating — stress monitor not yet active. ${fallback}`;
  }
  const agreementStr = swarmAgreementPct != null ? `swarm agreement ${swarmAgreementPct}%` : null;
  const fgStr = fearGreed != null ? `Fear&Greed ${fearGreed} (${fearGreedLabel(fearGreed)})` : null;
  const signals = [agreementStr, fgStr].filter(Boolean).join(", ");
  const signalSuffix = signals ? ` — ${signals}` : "";
  if (stress === "Stressed") {
    return `⚠️ ${FRIENDLY_CATEGORY[categoryId]} Stressed${signalSuffix}.`;
  }
  if (stress === "Elevated") {
    return `${FRIENDLY_CATEGORY[categoryId]} showing elevated stress${signalSuffix}.`;
  }
  // Calm
  return `${FRIENDLY_CATEGORY[categoryId]} calm${signalSuffix}.`;
}

/** Telegram/Discord-style alert mock: concretizes the productized anomaly bot for integrators. */
function AlertPreview({ categoryId, text }: { categoryId: CategoryId; text: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15 text-[var(--color-accent)]">
          <Bell size={11} aria-hidden />
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text)]">noetrix alerts</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">· bot · now</span>
        <StatusPill tone="muted" className="ml-auto">product preview</StatusPill>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
        <span className="text-[var(--color-text)]">{FRIENDLY_CATEGORY[categoryId]}</span>: {text}
      </p>
    </div>
  );
}

export function AnomalyFeed({
  categoryId,
  history,
  category,
}: {
  categoryId: CategoryId;
  history: LiveFeedPoint[];
  category?: SnapCategory | null;
}) {
  const anomalies = anomalyTimeline(history, 16, 2).slice().reverse().slice(0, 5);
  const latest = anomalies[0];
  const fallbackAlertText = latest
    ? `unusual ${latest.direction === "up" ? "jump" : "drop"} of ${Math.abs(latest.deltaPct).toFixed(1)}% detected, now ${friendlyValue(categoryId, latest.to)}.`
    : "no unusual moves right now, all quiet.";

  const alertText = composeAlertText(
    categoryId,
    category?.stress ?? null,
    category?.swarmAgreementPct ?? null,
    category?.fearGreed ?? null,
    fallbackAlertText,
  );

  return (
    <Panel elevation={1} className="lg:col-span-2">
      <PanelHeader
        caption="What's unusual"
        title={`Anomaly watch: ${FRIENDLY_CATEGORY[categoryId]}`}
        right={<StatusPill tone={anomalies.length ? "warn" : "up"}>{anomalies.length} flagged</StatusPill>}
      />
      <PanelBody className="pt-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            {anomalies.length === 0 ? (
              <EmptyState title="No anomalies detected" body="Sharp 24h moves in the AI consensus get flagged here automatically." />
            ) : (
              <ul className="flex flex-col gap-2">
                {anomalies.map((a) => (
                  <li key={a.block} className="flex items-center gap-3 rounded border border-[var(--color-border)] px-3 py-2 text-sm">
                    <span className={a.direction === "up" ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                      {a.direction === "up" ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                    </span>
                    <span className="text-[var(--color-text-dim)]">
                      {a.direction === "up" ? "Jumped" : "Dropped"}{" "}
                      <span className="text-[var(--color-text)]">{Math.abs(a.deltaPct).toFixed(1)}%</span> to{" "}
                      {friendlyValue(categoryId, a.to)}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--color-text-muted)]">#{a.block.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <AlertPreview categoryId={categoryId} text={alertText} />
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              Each anomaly is derived from the on-chain AI consensus. In production these stream to
              Telegram / Discord; the card above is a preview of that alert.
            </p>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
