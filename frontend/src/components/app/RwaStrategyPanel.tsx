"use client";

import { useReadContract } from "wagmi";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { StatusPill } from "@/components/ui/StatusPill";
import { categoryHash, yieldAllocatorAbi, riskManagerAbi } from "@/lib/contracts";
import { env, hasYieldAllocator, hasRiskManager } from "@/lib/env";

const METH_ID = categoryHash("METH_APR_24H");
const USDY_ID = categoryHash("USDY_APY_24H");

const RISK_LABELS = ["NORMAL", "CAUTION", "FROZEN"] as const;
const RISK_TONE = ["up", "warn", "down"] as const; // valid StatusPill tones

// Demo fallback mirrors /rwa's constants when addresses aren't wired.
const DEMO = { methBps: 4300, usdyBps: 5700, methYield: 380, usdyYield: 500, methRisk: 0, usdyRisk: 0 };

export function RwaStrategyPanel() {
  const allocation = useReadContract({
    address: env.addresses.yieldAllocator as `0x${string}`,
    abi: yieldAllocatorAbi,
    functionName: "getAllocation",
    query: { enabled: hasYieldAllocator, refetchInterval: 30_000 },
  });
  const methRisk = useReadContract({
    address: env.addresses.riskManager as `0x${string}`,
    abi: riskManagerAbi,
    functionName: "riskState",
    args: [METH_ID],
    query: { enabled: hasRiskManager, refetchInterval: 30_000 },
  });
  const usdyRisk = useReadContract({
    address: env.addresses.riskManager as `0x${string}`,
    abi: riskManagerAbi,
    functionName: "riskState",
    args: [USDY_ID],
    query: { enabled: hasRiskManager, refetchInterval: 30_000 },
  });

  const alloc = allocation.data as readonly [bigint, bigint, bigint, bigint] | undefined;
  const methBps = alloc ? Number(alloc[0]) : DEMO.methBps;
  const usdyBps = alloc ? Number(alloc[1]) : DEMO.usdyBps;
  const methYield = alloc ? Number(alloc[2]) : DEMO.methYield;
  const usdyYield = alloc ? Number(alloc[3]) : DEMO.usdyYield;
  const methR = (methRisk.data != null ? Number(methRisk.data) : DEMO.methRisk) as 0 | 1 | 2;
  const usdyR = (usdyRisk.data != null ? Number(usdyRisk.data) : DEMO.usdyRisk) as 0 | 1 | 2;
  const live = hasYieldAllocator || hasRiskManager;

  const total = Math.max(1, methBps + usdyBps);
  const methPct = (methBps / total) * 100;

  return (
    <Panel elevation={1} className="overflow-hidden">
      <PanelHeader
        caption="AI x RWA"
        title="Yield strategy & risk"
        right={
          <StatusPill tone={live ? "up" : "muted"} dot pulse={live}>
            {live ? "Live" : "Demo data"}
          </StatusPill>
        }
      />
      <PanelBody>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          dynamic allocation
        </div>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-sm border border-[var(--color-border)]">
          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${methPct}%` }} />
          <div className="h-full bg-[#9DC8FF]" style={{ width: `${100 - methPct}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular text-[var(--color-text-dim)]">
          <span>
            <span className="text-[var(--color-accent)]">mETH</span> {methBps} bps
          </span>
          <span>
            <span className="text-[#9DC8FF]">USDY</span> {usdyBps} bps
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border)] pt-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              mETH risk
            </div>
            <div className="mt-1">
              <StatusPill tone={RISK_TONE[methR]}>{RISK_LABELS[methR]}</StatusPill>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              USDY risk
            </div>
            <div className="mt-1">
              <StatusPill tone={RISK_TONE[usdyR]}>{RISK_LABELS[usdyR]}</StatusPill>
            </div>
          </div>
          <Stat label="mETH eff. yield" value={`${(methYield / 100).toFixed(2)}%`} />
          <Stat label="USDY eff. yield" value={`${(usdyYield / 100).toFixed(2)}%`} tone="accent" />
        </div>
      </PanelBody>
    </Panel>
  );
}
