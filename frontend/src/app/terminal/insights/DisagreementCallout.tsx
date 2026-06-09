"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Split } from "lucide-react";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { biggestDisagreement, type AgentBand } from "@/lib/insights";
import type { CategoryId } from "@/lib/mockData";

export function DisagreementCallout({
  categoryId,
  bands,
  crowdValue,
}: {
  categoryId: CategoryId;
  bands: AgentBand[];
  crowdValue: number | null;
}) {
  const d = biggestDisagreement(bands, crowdValue);
  const tone = d.spreadPct > 6 ? "down" : d.spreadPct > 2 ? "warn" : "up";

  return (
    <Panel elevation={1}>
      <PanelHeader
        caption="Where the edge is"
        title={`Biggest split — ${FRIENDLY_CATEGORY[categoryId]}`}
        right={
          <StatusPill tone={tone}>
            <Split size={11} aria-hidden className="mr-1" />
            {d.enoughData ? `${d.spreadPct.toFixed(1)}% apart` : "—"}
          </StatusPill>
        }
      />
      <PanelBody>
        {!d.enoughData || !d.highAgent || !d.lowAgent ? (
          <EmptyState
            title="Not enough qualified AIs to compare"
            body="A disagreement appears once at least two AIs with a track record forecast this market."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
              The qualified AIs disagree most here — about{" "}
              <span className="text-[var(--color-accent)]">{d.spreadPct.toFixed(1)}%</span> apart. Large
              gaps flag the highest-opportunity (and highest-risk) markets.
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  most bullish (agent #{d.highAgent.agentId})
                </div>
                <div className="mt-1 font-mono text-[var(--color-up)] tabular">
                  {friendlyValue(categoryId, (d.highAgent.low + d.highAgent.high) / 2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  most bearish (agent #{d.lowAgent.agentId})
                </div>
                <div className="mt-1 font-mono text-[var(--color-down)] tabular">
                  {friendlyValue(categoryId, (d.lowAgent.low + d.lowAgent.high) / 2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
