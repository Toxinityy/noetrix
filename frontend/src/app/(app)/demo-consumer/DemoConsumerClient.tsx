"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { RefreshCw, Cpu, Zap, ShieldCheck, Plug } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { StatusPill } from "@/components/ui/StatusPill";
import { AddressChip } from "@/components/ui/AddressChip";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { NumberFlow } from "@/components/ui/NumberFlow";
import {
  CATEGORIES,
  type CategoryId,
  makeFeedHistory,
} from "@/lib/mockData";
import { fmtBlock, fmtBps } from "@/lib/format";
import { cn } from "@/lib/cn";

const FEED_ADDRESS = "0xF33D9aA0fEED7c6e21dE4A6B91d2A2c0D8e3F5BA";
const CONSUMER_ADDRESS = "0xC07b2EA34c8E61f3a1b9eF2c7D9aF4B2c5D3E10C";

export function DemoConsumerClient() {
  const reducedMotion = useReducedMotion();
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const cat = CATEGORIES[categoryId];
  const baseHistory = React.useMemo(() => makeFeedHistory(categoryId, 80), [categoryId]);
  const [history, setHistory] = React.useState(baseHistory);
  const [lastReadAt, setLastReadAt] = React.useState<Date>(new Date());
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  React.useEffect(() => {
    setHistory(baseHistory);
  }, [baseHistory]);

  React.useEffect(() => {
    if (!autoRefresh || reducedMotion) return;
    const id = setInterval(() => {
      setHistory((prev) => {
        const last = prev[prev.length - 1];
        const drift = cat.id === "METH_APR_24H" ? 12 : 380_000;
        const v = last.value + (Math.random() - 0.5) * drift;
        return [
          ...prev.slice(1),
          {
            block: last.block + 75,
            value: Math.max(0, v),
            confidence: last.confidence + Math.round((Math.random() - 0.5) * 200),
            contributors: 16 + Math.round(Math.random() * 4),
          },
        ];
      });
      setLastReadAt(new Date());
    }, 5_000);
    return () => clearInterval(id);
  }, [autoRefresh, cat.id, reducedMotion]);

  const refresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 700));
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      const drift = cat.id === "METH_APR_24H" ? 28 : 720_000;
      const v = last.value + (Math.random() - 0.5) * drift;
      return [
        ...prev.slice(1),
        {
          block: last.block + 75,
          value: Math.max(0, v),
          confidence: last.confidence + Math.round((Math.random() - 0.5) * 400),
          contributors: 17 + Math.round(Math.random() * 3),
        },
      ];
    });
    setLastReadAt(new Date());
    setRefreshing(false);
  };

  const latest = history[history.length - 1];
  const prev = history[history.length - 8];
  const delta = latest.value - prev.value;
  const deltaPct = (delta / prev.value) * 100;

  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption: c.unit === "bps" ? "basis points" : "USD",
  }));

  const codeSample = `// DemoFeedConsumer.sol — illustrative
import { ICompositeFeed } from "predictor-index/feed";

contract LeveragedVault {
  ICompositeFeed public immutable feed;
  bytes32 constant CATEGORY = ${JSON.stringify(categoryId)};

  function projectedYieldBps() external view returns (uint256 v, uint256 conf) {
    (v, conf, ) = feed.read(CATEGORY);
  }
}`.trim();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <span>protocol</span>
        <span className="text-[var(--color-accent)]">/</span>
        <span>demo consumer</span>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            A Mantle protocol{" "}
            <span className="text-[var(--color-accent)]">reads the feed.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            This page simulates a downstream contract subscribing to the Predictor Index composite feed. The data,
            confidence, and contributor count are produced by reputation-weighted ensemble of revealed agent forecasts
            — verifiable end-to-end on Mantle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone="up" dot pulse>
            Streaming
          </StatusPill>
          <StatusPill tone="muted">Auto-refresh {autoRefresh ? "ON" : "OFF"}</StatusPill>
        </div>
      </div>

      <div className="mt-8">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as CategoryId)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Live read panel — left */}
        <Panel elevation={2} className="overflow-hidden">
          <PanelHeader
            caption="DemoFeedConsumer.sol"
            title="read(categoryId)"
            right={
              <div className="flex items-center gap-2">
                <StatusPill tone="accent" dot pulse>
                  block #{fmtBlock(latest.block)}
                </StatusPill>
                <button
                  type="button"
                  onClick={refresh}
                  className={cn(
                    "inline-flex items-center gap-2 rounded border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                    refreshing && "opacity-60",
                  )}
                >
                  <RefreshCw
                    size={11}
                    className={cn(refreshing && "animate-spin")}
                  />
                  refresh
                </button>
              </div>
            }
          />
          <PanelBody>
            <div className="flex items-end gap-8">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  return value
                </div>
                <NumberFlow
                  value={latest.value}
                  format={cat.unitFormatter}
                  className={cn(
                    "mt-2 inline-block font-mono text-[44px] leading-none tabular",
                    delta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]",
                  )}
                />
                <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-[var(--color-text-dim)] tabular">
                  <span className={delta >= 0 ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    vs last 8 refresh ticks
                  </span>
                </div>
              </div>
              <div className="hidden flex-1 sm:block">
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={history}
                      margin={{ top: 8, right: 6, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="var(--color-border)"
                        strokeDasharray="2 2"
                        vertical={false}
                      />
                      <XAxis dataKey="block" hide />
                      <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-bg)",
                          border: "1px solid var(--color-border-strong)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                        labelFormatter={(v) => `block #${fmtBlock(Number(v))}`}
                        formatter={(v) => [cat.unitFormatter(Number(v)), "feed"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-accent)"
                        strokeWidth={1.6}
                        dot={false}
                        isAnimationActive={!reducedMotion}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-[var(--color-border)] pt-5 sm:grid-cols-4">
              <Stat
                label="confidence"
                value={fmtBps(latest.confidence, 1)}
                sub="avg per-agent, clamped"
                tone="accent"
              />
              <Stat label="contributors" value={latest.contributors} sub="top-20 quorum" />
              <Stat
                label="last read"
                value={lastReadAt.toLocaleTimeString()}
                sub={refreshing ? "refreshing…" : "auto · 5s"}
              />
              <Stat
                label="gas (sim)"
                value="42,310"
                sub="single SLOAD chain"
              />
            </div>

            <label className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              auto-refresh every 5s
            </label>
          </PanelBody>
        </Panel>

        {/* What is this — right */}
        <Panel elevation={1}>
          <PanelHeader
            caption="for protocols"
            title="What is the composite feed?"
          />
          <PanelBody className="space-y-4 text-sm leading-relaxed text-[var(--color-text-dim)]">
            <p>
              A single number, on-chain, that summarizes the consensus forecast of independent AI agents for a given
              category — weighted by their on-chain reputation. Your contract reads it via one external view call.
            </p>
            <div className="grid grid-cols-1 gap-3">
              <Benefit
                icon={<Zap size={12} />}
                title="Stable interface"
                body="ICompositeFeed.read(bytes32) returns (uint256 value, uint256 confBps, uint256 atBlock). One call, no callbacks."
              />
              <Benefit
                icon={<ShieldCheck size={12} />}
                title="Verifiable inputs"
                body="Every forecast is a commit-reveal on Mantle. Every score is on-chain. You can audit who said what when."
              />
              <Benefit
                icon={<Cpu size={12} />}
                title="Reputation-weighted"
                body="Top-20 qualifying agents (≥10 resolved). Rank-based weights × per-agent calibration multiplier (clamped at −0.5)."
              />
              <Benefit
                icon={<Plug size={12} />}
                title="Subscription (v2)"
                body="$500–$2,000/mo per protocol for the gated feed. v1: open access for hackathon judges."
              />
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* System metadata + code sample */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel elevation={1}>
          <PanelHeader caption="contracts" title="System pointers" />
          <PanelBody className="space-y-4 text-sm">
            <FieldRow label="CompositeFeed">
              <AddressChip
                address={FEED_ADDRESS}
                href={`https://sepolia.mantlescan.xyz/address/${FEED_ADDRESS}`}
              />
            </FieldRow>
            <FieldRow label="This consumer">
              <AddressChip
                address={CONSUMER_ADDRESS}
                href={`https://sepolia.mantlescan.xyz/address/${CONSUMER_ADDRESS}`}
              />
            </FieldRow>
            <FieldRow label="Category">
              <span className="font-mono text-[12px] text-[var(--color-text)]">
                {categoryId}
              </span>
            </FieldRow>
            <FieldRow label="Min stake (writers)">
              <span className="font-mono text-[12px] text-[var(--color-text)]">
                {cat.minStake} MNT
              </span>
            </FieldRow>
            <FieldRow label="Refresh trigger">
              <span className="font-mono text-[12px] text-[var(--color-text-dim)]">
                cron · every 150 blocks (≈ 5 min)
              </span>
            </FieldRow>
            <FieldRow label="Subscription gate">
              <StatusPill tone="warn">v1 · open</StatusPill>
            </FieldRow>
          </PanelBody>
        </Panel>

        <Panel elevation={1}>
          <PanelHeader
            caption="integration"
            title="Solidity"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                contract.t.sol
              </span>
            }
          />
          <PanelBody>
            <pre className="overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4 font-mono text-[12px] leading-relaxed text-[var(--color-text)]">
              {codeSample.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 w-4 select-none text-[var(--color-text-muted)] tabular">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <CalloutCard
                title="Pull, not push"
                body="Subscribers read on demand. No callbacks, no oracle gas overhead."
              />
              <CalloutCard
                title="Atomic confidence"
                body="`confBps` is returned alongside value — your contract can branch on conviction."
              />
            </div>
          </PanelBody>
        </Panel>
      </div>

      {/* Reasoning lineage strip */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6"
      >
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          attribution
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-text)]">
          Every refresh of this feed is fully attributable: which agents contributed, what weight each was given, what
          their per-bucket calibration was at the time, and the raw scored predictions behind it. No black box, no
          off-chain handshake.
        </p>
      </motion.div>
    </div>
  );
}

function Benefit({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium text-[var(--color-text)]">{title}</div>
        <div className="text-[12px] text-[var(--color-text-dim)]">{body}</div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function CalloutCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
        {title}
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-dim)]">
        {body}
      </p>
    </div>
  );
}
