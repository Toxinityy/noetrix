"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { Gauge } from "lucide-react";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { uncertaintyLevel, type AgentBand } from "@/lib/insights";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";

export function ConsensusBandCard({
  categoryId,
  history,
  bands,
}: {
  categoryId: CategoryId;
  history: LiveFeedPoint[];
  bands: AgentBand[];
}) {
  const last = history[history.length - 1]?.value ?? null;
  const u = uncertaintyLevel(bands, last);
  const tone = u.level === "Low" ? "up" : u.level === "Medium" ? "warn" : "down";

  // Build a band around the consensus from the dispersion (visual confidence range).
  const mids = bands.map((b) => (b.low + b.high) / 2);
  const halfBand =
    mids.length > 1 ? (Math.max(...mids) - Math.min(...mids)) / 2 : (last ?? 0) * 0.01;
  const data = history.map((p) => ({
    block: p.block,
    value: p.value,
    lo: Math.max(0, p.value - halfBand),
    hi: p.value + halfBand,
  }));

  return (
    <Panel elevation={1}>
      <PanelHeader
        caption="AI consensus over time"
        title={FRIENDLY_CATEGORY[categoryId]}
        right={
          <StatusPill tone={tone}>
            <Gauge size={11} aria-hidden className="mr-1" />
            {u.level} certainty
          </StatusPill>
        }
      />
      <PanelBody className="pb-3 pt-2">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 4, bottom: 8 }}>
              <defs>
                <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
              <XAxis
                dataKey="block"
                tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickFormatter={(v) => `#${(v / 1_000_000).toFixed(2)}m`}
                stroke="var(--color-border-strong)"
              />
              <YAxis
                tick={{ fill: "var(--color-text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickFormatter={(v) => friendlyValue(categoryId, Number(v))}
                stroke="var(--color-border-strong)"
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border-strong)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
                labelFormatter={(v) => `block #${Number(v).toLocaleString("en-US")}`}
                formatter={(val, name) =>
                  name === "value"
                    ? [friendlyValue(categoryId, Number(val)), "AI consensus"]
                    : [friendlyValue(categoryId, Number(val)), name === "hi" ? "upper" : "lower"]
                }
              />
              <Area dataKey="hi" stroke="none" fill="url(#bandFill)" isAnimationActive={false} />
              <Area dataKey="lo" stroke="none" fill="var(--color-bg)" isAnimationActive={false} />
              <Line dataKey="value" type="monotone" stroke="var(--color-accent)" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-dim)]">
          The line is the combined AI view; the shaded band shows how much the AIs currently disagree.
          Wider band = less certainty.
        </p>
      </PanelBody>
    </Panel>
  );
}
