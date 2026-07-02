"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { isUsableBand } from "@/lib/insights";
import type { SnapPrediction } from "@/lib/snapshot";
import type { CategoryId } from "@/lib/mockData";

/** One resolved forecast: predicted band rail + where the real outcome landed. */
function ReplayRow({ categoryId, p }: { categoryId: CategoryId; p: SnapPrediction }) {
  const outcome = p.outcome as number;
  const inRange = outcome >= p.low && outcome <= p.high;
  const lo = Math.min(p.low, outcome);
  const hi = Math.max(p.high, outcome);
  const pad = (hi - lo) * 0.25 + Math.abs(hi) * 0.02 + 1;
  const min = lo - pad;
  const max = hi + pad;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] py-4 first:border-t-0">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-dim)]">agent #{p.agentId}</span>
        <StatusPill tone={inRange ? "up" : "warn"}>{inRange ? "landed in range" : "near miss"}</StatusPill>
      </div>
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--color-bg)]" />
        {/* predicted band */}
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm bg-[color:var(--color-accent)]/30"
          style={{ left: `${pos(p.low)}%`, width: `${Math.max(0, pos(p.high) - pos(p.low))}%` }}
          aria-hidden
        />
        {/* actual outcome marker */}
        <div
          className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-[var(--color-text)]"
          style={{ left: `${pos(outcome)}%` }}
          aria-hidden
        />
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
        AI predicted{" "}
        <span className="text-[var(--color-accent)]">
          {friendlyValue(categoryId, p.low)}–{friendlyValue(categoryId, p.high)}
        </span>
        ; the real value landed at{" "}
        <span className="text-[var(--color-text)]">{friendlyValue(categoryId, outcome)}</span>.
      </p>
    </div>
  );
}

export function ReplayCard({ categoryId, predictions }: { categoryId: CategoryId; predictions: SnapPrediction[] }) {
  const resolved = predictions
    .filter((p) => p.status === "Resolved" && p.outcome != null && isUsableBand(p.low, p.high))
    .sort((a, b) => b.resolutionBlock - a.resolutionBlock)
    .slice(0, 4);

  return (
    <Panel elevation={1} className="mt-4">
      <PanelHeader
        caption="Forecast vs reality"
        title={`How AI forecasts actually landed: ${FRIENDLY_CATEGORY[categoryId]}`}
        right={<StatusPill tone="accent">graded on-chain</StatusPill>}
      />
      <PanelBody className="pt-2">
        {resolved.length === 0 ? (
          <EmptyState
            title="No graded forecasts yet for this market"
            body="Once forecasts in this market resolve against the real outcome, the side-by-side replay appears here."
          />
        ) : (
          <div className="flex flex-col">
            {resolved.map((p) => (
              <ReplayRow key={p.id} categoryId={categoryId} p={p} />
            ))}
            <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
              Accent band = what the AI predicted. White line = the real on-chain outcome it was graded against.
            </p>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
