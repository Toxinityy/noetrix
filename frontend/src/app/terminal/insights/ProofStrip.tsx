"use client";

import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { topVsCrowdAccuracy, signalTrackRecord, MIN_RESOLVED_QUALIFIED } from "@/lib/insights";
import type { InsightsData } from "@/lib/hooks";
import { env } from "@/lib/env";

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{label}</div>
      <div className="font-mono text-2xl text-[var(--color-accent)] tabular">{value}</div>
      <div className="text-xs leading-relaxed text-[var(--color-text-dim)]">{sub}</div>
    </div>
  );
}

export function ProofStrip({ data }: { data: InsightsData }) {
  const tvc = topVsCrowdAccuracy(data.board, 3);
  const qualified = new Set(
    data.board.filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED).map((r) => r.id),
  );
  const preds = data.category?.predictions ?? [];
  const tr = signalTrackRecord(
    preds.map((p) => ({ low: p.low, high: p.high, outcome: p.outcome, status: p.status, qualified: qualified.has(p.agentId) })),
  );
  const resolvedCount = preds.filter((p) => p.status === "Resolved").length;

  return (
    <Panel elevation={2} className="mt-6">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
        <ShieldCheck size={14} className="text-[var(--color-accent)]" aria-hidden />
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Why you can trust this signal
        </span>
      </div>
      <div className="grid divide-y divide-[var(--color-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Tile
          label="Top AIs vs the crowd"
          value={tvc.enoughData ? `+${tvc.pctMoreAccurate.toFixed(0)}%` : "—"}
          sub={tvc.enoughData ? "more accurate than the average forecaster, by track record" : "needs more graded forecasts"}
        />
        <Tile
          label="Forecasts graded on-chain"
          value={`${resolvedCount}`}
          sub="every forecast auto-graded against the real outcome — independently verifiable"
        />
        <Tile
          label="Landed in range"
          value={tr.enoughData ? `${tr.hits} of ${tr.total}` : "—"}
          sub={tr.enoughData ? "top-AI forecasts where the real value fell inside the predicted band (sample growing)" : "track record builds as forecasts resolve"}
        />
      </div>
      <div className="border-t border-[var(--color-border)] px-5 py-2.5">
        <a
          href={env.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[10px] text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-accent)] hover:underline"
        >
          Computed from Mantle Sepolia{data.block ? ` @ block #${data.block.toLocaleString("en-US")}` : ""} · view contracts on the explorer ↗
        </a>
      </div>
    </Panel>
  );
}
