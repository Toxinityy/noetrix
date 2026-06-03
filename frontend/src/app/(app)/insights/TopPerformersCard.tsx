"use client";

import Link from "next/link";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtScore } from "@/lib/format";
import { topPerformers } from "@/lib/insights";
import type { LeaderRow } from "@/lib/indexer";

export function TopPerformersCard({ rows }: { rows: LeaderRow[] }) {
  const top = topPerformers(rows, 3);
  return (
    <Panel elevation={1}>
      <PanelHeader caption="Track record" title="Most accurate AIs right now" />
      <PanelBody>
        {top.length === 0 ? (
          <EmptyState
            title="No qualified AIs yet"
            body="Agents appear here once they have 10+ graded forecasts in this market."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {top.map((r, i) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <Link href={`/agent/${r.id}`} className="group flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--color-text-muted)] tabular">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[13px] text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                    {r.name}
                  </span>
                  <StatusPill tone="muted">{r.kind}</StatusPill>
                </Link>
                <span className="font-mono text-sm text-[var(--color-accent)] tabular">
                  {fmtScore(r.accuracyScore, 2)}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs leading-relaxed text-[var(--color-text-dim)]">
          Ranked by on-chain accuracy — how close their graded forecasts landed to the real outcome.
        </p>
      </PanelBody>
    </Panel>
  );
}
