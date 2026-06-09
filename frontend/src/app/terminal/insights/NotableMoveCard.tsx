"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { notableMove } from "@/lib/insights";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";

export function NotableMoveCard({
  categoryId,
  history,
}: {
  categoryId: CategoryId;
  history: LiveFeedPoint[];
}) {
  const m = notableMove(history, 16, 1);
  const friendly = FRIENDLY_CATEGORY[categoryId];
  const Icon = m.direction === "up" ? ArrowUp : m.direction === "down" ? ArrowDown : Minus;
  const tone =
    m.direction === "up"
      ? "text-[var(--color-up)]"
      : m.direction === "down"
        ? "text-[var(--color-down)]"
        : "text-[var(--color-text-dim)]";

  return (
    <Panel elevation={1}>
      <PanelHeader caption="Last 24 hours" title="Notable move" />
      <PanelBody>
        <div className="flex items-center gap-3">
          <Icon size={22} className={tone} aria-hidden />
          <span className={`font-mono text-3xl tabular ${tone}`}>
            {m.deltaPct >= 0 ? "+" : ""}
            {m.deltaPct.toFixed(1)}%
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-dim)]">
          {m.current == null
            ? "No recent data for this market yet."
            : m.isNotable
              ? `${friendly} ${m.direction === "up" ? "jumped" : "dropped"} ${Math.abs(m.deltaPct).toFixed(1)}% in the last day — from ${friendlyValue(categoryId, m.prior ?? 0)} to ${friendlyValue(categoryId, m.current)}.`
              : `${friendly} has been steady over the last day (now ${friendlyValue(categoryId, m.current)}).`}
        </p>
      </PanelBody>
    </Panel>
  );
}
