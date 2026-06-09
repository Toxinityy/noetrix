"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { ShieldAlert, ShieldCheck, ShieldX, PieChart, Activity } from "lucide-react";
import { smartMoneyDivergence, notableMove, topFinding } from "@/lib/insights";
import { bpsToPct, FRIENDLY_CATEGORY } from "@/lib/labels";
import type { InsightsData } from "@/lib/hooks";
import type { CategoryId } from "@/lib/mockData";

const RISK_UI = {
  Normal: { tone: "up" as const, label: "Looking healthy", icon: ShieldCheck },
  Caution: { tone: "warn" as const, label: "Cautious", icon: ShieldAlert },
  Frozen: { tone: "down" as const, label: "Paused for safety", icon: ShieldX },
};

const STRESS_UI = {
  Calm: { tone: "up" as const, label: "Calm" },
  Elevated: { tone: "warn" as const, label: "Elevated" },
  Stressed: { tone: "down" as const, label: "Stressed" },
};

function fearGreedLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

export function YourMoveStrip({ categoryId, data }: { categoryId: CategoryId; data: InsightsData }) {
  const crowd = data.crowdValue;
  const div = smartMoneyDivergence(data.bands, crowd);
  const move = notableMove(data.feed, 16, 1);
  const briefing = topFinding(div, move, FRIENDLY_CATEGORY[categoryId]);

  const risk = data.category?.risk ?? null;
  const riskUi = risk ? RISK_UI[risk] : null;
  const RiskIcon = riskUi?.icon ?? ShieldCheck;

  const alloc = data.allocation;

  // Swarm / stress fields from snapshot (optional — null when not yet monitored)
  const swarmAgreementPct = data.category?.swarmAgreementPct ?? null;
  const stress = data.category?.stress ?? null;
  const fearGreed = data.category?.fearGreed ?? null;
  const stressUi = stress ? STRESS_UI[stress] : null;

  return (
    <Panel elevation={2} className="mt-8">
      <PanelHeader caption="What this means for you" title="Your move" />
      <PanelBody>
        <div className="grid gap-5 md:grid-cols-3">
          {/* Daily briefing */}
          <div className="md:col-span-3">
            <div className="rounded-md border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/5 px-4 py-3">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                AI briefing
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--color-text)]">{briefing}</p>
            </div>
          </div>

          {/* Risk monitor */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Risk monitor
            </div>
            {riskUi ? (
              <StatusPill tone={riskUi.tone}>
                <RiskIcon size={12} aria-hidden className="mr-1" />
                {riskUi.label}
              </StatusPill>
            ) : (
              <span className="text-sm text-[var(--color-text-dim)]">Not monitored for this market</span>
            )}
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              Derived on-chain from AI confidence + data freshness.
            </p>
          </div>

          {/* Swarm signal */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <Activity size={11} aria-hidden /> Swarm signal
            </div>

            {/* Swarm agreement */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Agreement
              </span>
              <span className="font-mono text-sm text-[var(--color-text)]">
                {swarmAgreementPct !== null ? `${swarmAgreementPct}%` : "—"}
              </span>
              <span className="sr-only">
                {swarmAgreementPct !== null
                  ? `Swarm agreement is ${swarmAgreementPct} percent`
                  : "Swarm agreement not available"}
              </span>
            </div>

            {/* Stress pill */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Stress
              </span>
              {stressUi ? (
                <StatusPill tone={stressUi.tone}>
                  <span className="sr-only">Market stress level: </span>
                  {stressUi.label}
                </StatusPill>
              ) : (
                <span className="text-sm text-[var(--color-text-dim)]">—</span>
              )}
            </div>

            {/* Fear & Greed */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Fear &amp; Greed
              </span>
              <span className="font-mono text-sm text-[var(--color-text)]">
                {fearGreed !== null ? fearGreed : "—"}
              </span>
              {fearGreed !== null && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  ({fearGreedLabel(fearGreed)})
                </span>
              )}
              <span className="sr-only">
                {fearGreed !== null
                  ? `Fear and greed index: ${fearGreed} — ${fearGreedLabel(fearGreed)}`
                  : "Fear and greed index not available"}
              </span>
            </div>

            {(swarmAgreementPct === null || stress === null || fearGreed === null) && (
              <p className="text-xs leading-relaxed text-[var(--color-text-dim)]">
                Calibrating / not yet monitored.
              </p>
            )}
          </div>

          {/* AI allocation */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              <PieChart size={11} aria-hidden /> AI yield allocation (mETH vs USDY)
            </div>
            {alloc ? (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-sm bg-[var(--color-bg)]">
                  <div className="h-full bg-[color:var(--color-accent)]/60" style={{ width: `${alloc.methBps / 100}%` }} aria-hidden />
                  <div className="h-full bg-[color:var(--color-up)]/50" style={{ width: `${alloc.usdyBps / 100}%` }} aria-hidden />
                </div>
                <div className="flex justify-between font-mono text-xs text-[var(--color-text-dim)]">
                  <span>mETH {bpsToPct(alloc.methBps, 0)}</span>
                  <span>USDY {bpsToPct(alloc.usdyBps, 0)}</span>
                </div>
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  How the AI would split new yield deposits right now, weighted by forecast confidence.
                </p>
              </>
            ) : (
              <span className="text-sm text-[var(--color-text-dim)]">Allocation unavailable.</span>
            )}
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
