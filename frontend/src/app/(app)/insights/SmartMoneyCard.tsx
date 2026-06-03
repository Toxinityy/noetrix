"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { smartMoneyDivergence, type AgentBand } from "@/lib/insights";
import type { CategoryId } from "@/lib/mockData";

export function SmartMoneyCard({
  categoryId,
  bands,
  crowdValue,
}: {
  categoryId: CategoryId;
  bands: AgentBand[];
  crowdValue: number | null;
}) {
  const d = smartMoneyDivergence(bands, crowdValue);
  const friendly = FRIENDLY_CATEGORY[categoryId];

  return (
    <Panel elevation={2} className="lg:col-span-2">
      <PanelHeader
        caption="Smart money vs the crowd"
        title={`Where the best AIs disagree — ${friendly}`}
        right={<StatusPill tone="accent">{d.qualifiedCount} qualified AIs</StatusPill>}
      />
      <PanelBody>
        {!d.enoughData || d.smartMoneyValue == null || d.crowdValue == null ? (
          <EmptyState
            title="Not enough graded forecasts yet"
            body="The smart-money view appears once enough AIs have a track record (10+ graded forecasts) in this market."
          />
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
              The most accurate AIs expect {friendly}{" "}
              <span
                className={
                  d.direction === "higher"
                    ? "text-[var(--color-up)]"
                    : d.direction === "lower"
                      ? "text-[var(--color-down)]"
                      : "text-[var(--color-text-dim)]"
                }
              >
                {d.direction}
              </span>{" "}
              than the crowd
              {d.direction !== "in line"
                ? ` — by about ${Math.abs(d.deltaPct).toFixed(1)}%.`
                : "."}
            </p>

            {/* Bullet: crowd marker vs smart-money bar */}
            <BulletRow
              crowd={d.crowdValue}
              smart={d.smartMoneyValue}
              categoryId={categoryId}
            />

            <div className="grid grid-cols-2 gap-6 border-t border-[var(--color-border)] pt-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  smart-money view
                </div>
                <div className="mt-1 font-mono text-2xl text-[var(--color-accent)] tabular">
                  {friendlyValue(categoryId, d.smartMoneyValue)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  crowd consensus
                </div>
                <div className="mt-1 font-mono text-2xl text-[var(--color-text)] tabular">
                  {friendlyValue(categoryId, d.crowdValue)}
                </div>
              </div>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

function BulletRow({
  crowd,
  smart,
  categoryId,
}: {
  crowd: number;
  smart: number;
  categoryId: CategoryId;
}) {
  const lo = Math.min(crowd, smart);
  const hi = Math.max(crowd, smart);
  const pad = (hi - lo) * 0.8 + Math.abs(hi) * 0.02 + 1;
  const min = lo - pad;
  const max = hi + pad;
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative h-12">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-sm bg-[var(--color-bg)]" />
      {/* smart-money bar from min→smart */}
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm bg-[color:var(--color-accent)]/35"
        style={{ left: 0, width: `${pos(smart)}%` }}
      />
      {/* crowd target marker */}
      <div
        className="absolute top-1/2 h-7 w-0.5 -translate-y-1/2 bg-[var(--color-text)]"
        style={{ left: `${pos(crowd)}%` }}
        aria-hidden
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-accent)]"
        style={{ left: `${pos(smart)}%` }}
        aria-hidden
      />
      <span className="absolute -bottom-1 text-[10px] font-mono text-[var(--color-text)]" style={{ left: `${pos(crowd)}%`, transform: "translateX(-50%)" }}>
        crowd
      </span>
      <span className="absolute -top-1 text-[10px] font-mono text-[var(--color-accent)]" style={{ left: `${pos(smart)}%`, transform: "translateX(-50%)" }}>
        smart money
      </span>
      <span className="sr-only">
        Smart-money view {friendlyValue(categoryId, smart)} versus crowd {friendlyValue(categoryId, crowd)}.
      </span>
    </div>
  );
}
