# Proof-first `/insights` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the shipped `/insights` page into an investor/judge-facing proof surface (proof strip, forecast-vs-reality replay, anomaly feed, your-move strip, methodology footer) backed by **real on-chain numbers** captured in a build-time chain snapshot.

**Architecture:** A node script reads the live Mantle Sepolia contracts via viem and writes a committed `public/insights-snapshot.json`. New tested pure fns in `lib/insights.ts` compute the proof metrics. A single `useInsightsData` hook serves the whole page from the snapshot (mock fallback). New section components render the proof narrative; existing cards keep working, now fed from the same snapshot tier.

**Tech Stack:** Next.js 16 / React 19, viem 2.x, TanStack Query 5, Recharts 3, vitest 2, Tailwind v4. Spec: `docs/superpowers/specs/2026-06-02-proof-first-insights-design.md`.

**Honesty constraints (apply to all UI copy):** real-from-chain numbers only; *N-growing* framing on every aggregate (never imply a large sample); outcome oracle is seeded (footer states this); no bps/CRPS/feed acronyms in primary copy.

**⚠️ Next.js note:** `frontend/AGENTS.md` warns this Next.js build differs from training data. Before editing any route/page file, read the relevant guide under `frontend/node_modules/next/dist/docs/`.

---

## File Structure

**Create:**
- `frontend/src/lib/snapshot.ts` — snapshot TypeScript types + pure derive fns (snapshot → `LeaderRow[]`/`LiveFeedPoint[]`/`AgentBand[]`).
- `frontend/src/lib/snapshot.test.ts` — derive-fn unit tests.
- `frontend/scripts/gen-insights-snapshot.ts` — viem chain reader → `public/insights-snapshot.json`.
- `frontend/public/insights-snapshot.json` — generated, committed (real chain data).
- `frontend/src/app/(app)/insights/ProofStrip.tsx` — §1.
- `frontend/src/app/(app)/insights/ReplayCard.tsx` — §2.
- `frontend/src/app/(app)/insights/DisagreementCallout.tsx` — §3 addition.
- `frontend/src/app/(app)/insights/AnomalyFeed.tsx` — §4 (incl. inline AlertPreview).
- `frontend/src/app/(app)/insights/YourMoveStrip.tsx` — §5.

**Modify:**
- `frontend/src/lib/insights.ts` — add `topVsCrowdAccuracy`, `signalTrackRecord`, `anomalyTimeline`, `biggestDisagreement` (+ types).
- `frontend/src/lib/insights.test.ts` — add tests for the new fns.
- `frontend/src/lib/hooks.ts` — add `useInsightsData(categoryId)`.
- `frontend/src/app/(app)/insights/InsightsClient.tsx` — route all cards through `useInsightsData`; add §0 caption, mount §1/§2/§3/§4/§5, expand §6 footer.
- `frontend/package.json` — add `gen:insights` script.
- `CLAUDE.md` — append a §6 session entry (final task).

---

## Task 1: New proof pure fns in `lib/insights.ts` (TDD)

**Files:**
- Modify: `frontend/src/lib/insights.ts`
- Test: `frontend/src/lib/insights.test.ts`

- [ ] **Step 1: Write the failing tests.** Append to `frontend/src/lib/insights.test.ts`:

```ts
import {
  topVsCrowdAccuracy,
  signalTrackRecord,
  anomalyTimeline,
  biggestDisagreement,
} from "@/lib/insights";

describe("topVsCrowdAccuracy", () => {
  const r = (id: number, acc: number, resolved: number): LeaderRow => ({
    id, name: `agent #${id}`, kind: "CLAUDE", accuracyScore: acc, calibrationScore: -1, resolvedCount: resolved, lastUpdatedBlock: 1,
  });
  it("reports top-N as more accurate than the crowd mean", () => {
    const rows = [r(1, 900_000, 20), r(2, 100_000, 20), r(3, -200_000, 20)];
    const t = topVsCrowdAccuracy(rows, 1);
    expect(t.enoughData).toBe(true);
    expect(t.pctMoreAccurate).toBeGreaterThan(0);
  });
  it("needs qualified agents", () => {
    expect(topVsCrowdAccuracy([r(1, 900_000, 5)], 1).enoughData).toBe(false);
  });
});

describe("signalTrackRecord", () => {
  const p = (low: number, high: number, outcome: number | null, status = "Resolved", qualified = true) =>
    ({ low, high, outcome, status, qualified });
  it("counts outcomes that land inside the band as hits", () => {
    const t = signalTrackRecord([p(10, 20, 15), p(10, 20, 25), p(10, 20, 12)]);
    expect(t.total).toBe(3);
    expect(t.hits).toBe(2);
    expect(t.ratePct).toBeCloseTo(66.7, 0);
  });
  it("ignores unresolved, unqualified, and outcome-less rows", () => {
    const t = signalTrackRecord([p(10, 20, 15, "Revealed"), p(10, 20, 15, "Resolved", false), p(10, 20, null)]);
    expect(t.total).toBe(0);
    expect(t.enoughData).toBe(false);
  });
});

describe("anomalyTimeline", () => {
  const pt = (value: number, block: number): LiveFeedPoint => ({ block, value, confidence: 7000, contributors: 5 });
  it("flags moves over threshold across the lookback", () => {
    const hist = [pt(100, 1), pt(100, 2), pt(110, 3)];
    const a = anomalyTimeline(hist, 2, 5);
    expect(a).toHaveLength(1);
    expect(a[0].direction).toBe("up");
    expect(a[0].deltaPct).toBeCloseTo(10, 5);
  });
  it("ignores sub-threshold moves", () => {
    expect(anomalyTimeline([pt(100, 1), pt(101, 2)], 1, 5)).toHaveLength(0);
  });
});

describe("biggestDisagreement", () => {
  const b = (id: number, low: number, high: number): AgentBand => ({
    agentId: id, name: `a${id}`, accuracyScore: 500_000, resolvedCount: 20, low, high,
  });
  it("finds the high/low band pair and spread vs crowd", () => {
    const d = biggestDisagreement([b(1, 3000, 3100), b(2, 4500, 4600)], 3800);
    expect(d.enoughData).toBe(true);
    expect(d.highAgent?.agentId).toBe(2);
    expect(d.lowAgent?.agentId).toBe(1);
    expect(d.spreadPct).toBeGreaterThan(0);
  });
  it("needs at least two qualified bands", () => {
    expect(biggestDisagreement([b(1, 3000, 3100)], 3800).enoughData).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd frontend && pnpm test -- insights`
Expected: FAIL — the four new functions are not exported.

- [ ] **Step 3: Implement the functions.** Append to `frontend/src/lib/insights.ts`:

```ts
/** Signed accuracy score (-1e6..1e6) → [0,1]. */
function accNorm(score: number): number {
  return Math.min(1, Math.max(0, (score + 1_000_000) / 2_000_000));
}

export interface TopVsCrowd {
  topMean: number;
  crowdMean: number;
  pctMoreAccurate: number;
  topN: number;
  enoughData: boolean;
}

/** Mean normalized accuracy of the top-N qualified agents vs the whole qualified crowd. */
export function topVsCrowdAccuracy(rows: LeaderRow[], topN = 3): TopVsCrowd {
  const q = rows.filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED);
  if (q.length === 0) {
    return { topMean: 0, crowdMean: 0, pctMoreAccurate: 0, topN, enoughData: false };
  }
  const sorted = [...q].sort((a, b) => b.accuracyScore - a.accuracyScore);
  const top = sorted.slice(0, topN);
  const topMean = top.reduce((s, r) => s + accNorm(r.accuracyScore), 0) / top.length;
  const crowdMean = q.reduce((s, r) => s + accNorm(r.accuracyScore), 0) / q.length;
  const pctMoreAccurate = crowdMean > 0 ? ((topMean - crowdMean) / crowdMean) * 100 : 0;
  return { topMean, crowdMean, pctMoreAccurate, topN, enoughData: true };
}

export interface TrackRecordInput {
  low: number;
  high: number;
  outcome: number | null;
  status: string;
  qualified: boolean;
}
export interface TrackRecord {
  hits: number;
  total: number;
  ratePct: number;
  enoughData: boolean;
}

/** Of resolved forecasts by qualified agents, how many had the real outcome land inside the band. */
export function signalTrackRecord(preds: TrackRecordInput[]): TrackRecord {
  const r = preds.filter((p) => p.status === "Resolved" && p.qualified && p.outcome != null);
  const hits = r.filter((p) => (p.outcome as number) >= p.low && (p.outcome as number) <= p.high).length;
  return { hits, total: r.length, ratePct: r.length ? (hits / r.length) * 100 : 0, enoughData: r.length > 0 };
}

export interface Anomaly {
  block: number;
  direction: "up" | "down";
  deltaPct: number;
  from: number;
  to: number;
}

/** Scan the feed series for moves ≥ thresholdPct across a `lookback` window. Newest last. */
export function anomalyTimeline(history: LiveFeedPoint[], lookback = 16, thresholdPct = 2): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = lookback; i < history.length; i++) {
    const to = history[i].value;
    const from = history[i - lookback].value;
    if (from === 0) continue;
    const deltaPct = ((to - from) / from) * 100;
    if (Math.abs(deltaPct) >= thresholdPct) {
      out.push({ block: history[i].block, direction: deltaPct > 0 ? "up" : "down", deltaPct, from, to });
    }
  }
  return out;
}

export interface Disagreement {
  spreadPct: number;
  highAgent: AgentBand | null;
  lowAgent: AgentBand | null;
  enoughData: boolean;
}

/** The qualified agents whose band midpoints sit farthest apart, as a % of the crowd value. */
export function biggestDisagreement(bands: AgentBand[], crowdValue: number | null): Disagreement {
  const q = bands.filter((b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low);
  if (q.length < 2 || !crowdValue) {
    return { spreadPct: 0, highAgent: null, lowAgent: null, enoughData: false };
  }
  const withMid = q.map((b) => ({ b, mid: (b.low + b.high) / 2 }));
  const hi = withMid.reduce((m, x) => (x.mid > m.mid ? x : m));
  const lo = withMid.reduce((m, x) => (x.mid < m.mid ? x : m));
  const spreadPct = (Math.abs(hi.mid - lo.mid) / crowdValue) * 100;
  return { spreadPct, highAgent: hi.b, lowAgent: lo.b, enoughData: true };
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd frontend && pnpm test -- insights`
Expected: PASS — all new + existing insights tests green.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/lib/insights.ts frontend/src/lib/insights.test.ts
git commit -m "feat(web): proof pure fns — topVsCrowd, trackRecord, anomalyTimeline, disagreement

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Snapshot types + derive fns (`lib/snapshot.ts`, TDD)

**Files:**
- Create: `frontend/src/lib/snapshot.ts`
- Test: `frontend/src/lib/snapshot.test.ts`

- [ ] **Step 1: Write the failing tests.** Create `frontend/src/lib/snapshot.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { leaderRowsFromSnapshot, bandsFromSnapshot, feedFromSnapshot, type SnapCategory } from "@/lib/snapshot";

const cat: SnapCategory = {
  reputations: [
    { agentId: 1, accuracyScore: 900_000, calibrationScore: -10, resolvedCount: 20 },
    { agentId: 2, accuracyScore: 100_000, calibrationScore: -50, resolvedCount: 12 },
  ],
  predictions: [
    { id: 1, agentId: 1, status: "Resolved", low: 3700, high: 3900, confidence: 6000, score: 990000, outcome: 3800, commitBlock: 10, resolutionBlock: 360 },
    { id: 2, agentId: 1, status: "Revealed", low: 3750, high: 3950, confidence: 6000, score: null, outcome: null, commitBlock: 20, resolutionBlock: 370 },
    { id: 3, agentId: 2, status: "Revealed", low: 4000, high: 4200, confidence: 5000, score: null, outcome: null, commitBlock: 15, resolutionBlock: 365 },
  ],
  feedHistory: [
    { block: 100, value: 3800, confidence: 6000, contributors: 2 },
    { block: 200, value: 3820, confidence: 6100, contributors: 2 },
  ],
  risk: "Normal",
};

describe("leaderRowsFromSnapshot", () => {
  it("maps reputations to LeaderRow sorted by accuracy desc", () => {
    const rows = leaderRowsFromSnapshot(cat);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(rows[0].accuracyScore).toBe(900_000);
  });
});

describe("bandsFromSnapshot", () => {
  it("takes each agent's latest revealed/resolved band joined with reputation", () => {
    const bands = bandsFromSnapshot(cat);
    const a1 = bands.find((b) => b.agentId === 1);
    expect(a1?.low).toBe(3750); // latest by commitBlock (pred 2 over pred 1)
    expect(a1?.resolvedCount).toBe(20);
  });
});

describe("feedFromSnapshot", () => {
  it("maps + sorts feed points by block", () => {
    expect(feedFromSnapshot(cat).map((p) => p.block)).toEqual([100, 200]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.**

Run: `cd frontend && pnpm test -- snapshot`
Expected: FAIL — `@/lib/snapshot` does not exist.

- [ ] **Step 3: Implement `frontend/src/lib/snapshot.ts`:**

```ts
import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";
import type { AgentBand } from "@/lib/insights";
import type { AgentKind, CategoryId } from "@/lib/mockData";

// ─── Snapshot shapes (mirror gen-insights-snapshot.ts output) ──────────────────

export interface SnapPrediction {
  id: number;
  agentId: number;
  status: string; // "Committed" | "Revealed" | "Resolved" | "Cancelled" | "Forfeited"
  low: number;
  high: number;
  confidence: number;
  score: number | null;
  outcome: number | null;
  commitBlock: number;
  resolutionBlock: number;
}

export interface SnapReputation {
  agentId: number;
  accuracyScore: number;
  calibrationScore: number;
  resolvedCount: number;
}

export interface SnapCategory {
  reputations: SnapReputation[];
  predictions: SnapPrediction[];
  feedHistory: LiveFeedPoint[];
  risk: "Normal" | "Caution" | "Frozen" | null;
}

export interface InsightsSnapshot {
  generatedAt: string;
  chainId: number;
  block: number;
  source: "chain" | "mock";
  allocation: { methBps: number; usdyBps: number } | null;
  categories: Record<CategoryId, SnapCategory>;
}

function inferKind(name: string): AgentKind {
  const n = name.toLowerCase();
  if (n.includes("claude") || n.includes("haiku") || n.includes("opus") || n.includes("reasoner")) return "CLAUDE";
  if (n.includes("arima")) return "ARIMA";
  if (n.includes("ensemble")) return "ENSEMBLE";
  return "QUANT";
}

/** Reputations → LeaderRow[] (accuracy desc). Live agents are "agent #N" (metadata not fetched). */
export function leaderRowsFromSnapshot(cat: SnapCategory): LeaderRow[] {
  return cat.reputations
    .map((r) => {
      const name = `agent #${r.agentId}`;
      return {
        id: r.agentId,
        name,
        kind: inferKind(name),
        accuracyScore: r.accuracyScore,
        calibrationScore: r.calibrationScore,
        resolvedCount: r.resolvedCount,
        lastUpdatedBlock: 0,
      };
    })
    .sort((a, b) => b.accuracyScore - a.accuracyScore);
}

/** Latest revealed/resolved band per agent, joined with that agent's reputation. */
export function bandsFromSnapshot(cat: SnapCategory): AgentBand[] {
  const repByAgent = new Map(cat.reputations.map((r) => [r.agentId, r]));
  const byAgent = new Map<number, SnapPrediction>();
  for (const p of cat.predictions) {
    if (p.status !== "Revealed" && p.status !== "Resolved") continue;
    const cur = byAgent.get(p.agentId);
    if (!cur || p.commitBlock > cur.commitBlock) byAgent.set(p.agentId, p);
  }
  const out: AgentBand[] = [];
  for (const [agentId, p] of byAgent) {
    const rep = repByAgent.get(agentId);
    out.push({
      agentId,
      name: `agent #${agentId}`,
      accuracyScore: rep?.accuracyScore ?? 0,
      resolvedCount: rep?.resolvedCount ?? 0,
      low: p.low,
      high: p.high,
    });
  }
  return out;
}

/** Feed history → LiveFeedPoint[] sorted ascending by block. */
export function feedFromSnapshot(cat: SnapCategory): LiveFeedPoint[] {
  return [...cat.feedHistory].sort((a, b) => a.block - b.block);
}
```

- [ ] **Step 4: Run tests to verify they pass.**

Run: `cd frontend && pnpm test -- snapshot`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/lib/snapshot.ts frontend/src/lib/snapshot.test.ts
git commit -m "feat(web): insights snapshot types + derive fns (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Chain snapshot script + run + commit JSON

**Files:**
- Create: `frontend/scripts/gen-insights-snapshot.ts`
- Modify: `frontend/package.json` (add `gen:insights` script)
- Create (generated): `frontend/public/insights-snapshot.json`

- [ ] **Step 1: Write the script.** Create `frontend/scripts/gen-insights-snapshot.ts`:

```ts
/**
 * Generate public/insights-snapshot.json — REAL on-chain data for the proof-first /insights page.
 * Reads Mantle Sepolia contracts via viem (no indexer, no hosting). Re-run before the demo.
 *
 * Usage:
 *   tsx scripts/gen-insights-snapshot.ts                          → read chain (public RPC)
 *   SNAPSHOT_RPC_URL=https://… SNAPSHOT_FROM_BLOCK=NNN tsx scripts/gen-insights-snapshot.ts
 *
 * SNAPSHOT_FROM_BLOCK should be the CompositeFeed deploy block for a complete feed history;
 * if getLogs over a huge range fails on the public RPC, feedHistory degrades to [] (script still succeeds).
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http, keccak256, toBytes, decodeAbiParameters, type Hex } from "viem";
import { CATEGORIES, type CategoryId } from "../src/lib/mockData";
import type { InsightsSnapshot, SnapCategory, SnapPrediction, SnapReputation } from "../src/lib/snapshot";

const STATUS = ["Committed", "Revealed", "Resolved", "Cancelled", "Forfeited"] as const;
const categories = Object.keys(CATEGORIES) as CategoryId[];

// USD 8-dec categories must be divided by 1e8 to match the UI's plain-USD formatter.
const USD_8DEC: Record<CategoryId, boolean> = {
  METH_APR_24H: false,
  USDY_APY_24H: false,
  AAVE_MANTLE_TVL_24H: true,
};
const scaleFor = (c: CategoryId) => (USD_8DEC[c] ? 1e8 : 1);

// Category → resolver contract key in deployments JSON.
const RESOLVER_KEY: Record<CategoryId, string> = {
  METH_APR_24H: "MethAprResolver",
  USDY_APY_24H: "UsdyApyResolver",
  AAVE_MANTLE_TVL_24H: "AaveMantleTvlResolver",
};

const catHash = (label: string): Hex => keccak256(toBytes(label));

const predictionMarketAbi = [
  { type: "function", name: "nextPredictionId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getPrediction", stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{
      type: "tuple", components: [
        { name: "agentId", type: "uint256" }, { name: "categoryId", type: "bytes32" },
        { name: "commitHash", type: "bytes32" }, { name: "value", type: "bytes" },
        { name: "confidence", type: "uint16" }, { name: "contentHash", type: "bytes32" },
        { name: "stake", type: "uint256" }, { name: "commitBlock", type: "uint256" },
        { name: "resolutionBlock", type: "uint256" }, { name: "status", type: "uint8" },
        { name: "score", type: "int256" },
      ],
    }],
  },
] as const;

const agentRegistryAbi = [{
  type: "function", name: "getReputation", stateMutability: "view",
  inputs: [{ name: "agentId", type: "uint256" }, { name: "categoryId", type: "bytes32" }],
  outputs: [{
    type: "tuple", components: [
      { name: "accuracyScore", type: "int256" }, { name: "calibrationScore", type: "int256" },
      { name: "resolvedCount", type: "uint256" }, { name: "lastUpdatedBlock", type: "uint256" },
      { name: "bucketAccuracy", type: "int256[10]" }, { name: "bucketCount", type: "uint256[10]" },
    ],
  }],
}] as const;

const resolverAbi = [{
  type: "function", name: "resolve", stateMutability: "view",
  inputs: [{ name: "predictionValue", type: "bytes" }, { name: "resolutionBlock", type: "uint256" }],
  outputs: [{ name: "outcome", type: "bytes" }],
}] as const;

const yieldAllocatorAbi = [{
  type: "function", name: "getAllocation", stateMutability: "view", inputs: [],
  outputs: [
    { name: "allocMethBps", type: "uint256" }, { name: "allocUsdyBps", type: "uint256" },
    { name: "methYield", type: "uint256" }, { name: "usdyYield", type: "uint256" },
  ],
}] as const;

const riskManagerAbi = [{
  type: "function", name: "riskState", stateMutability: "view",
  inputs: [{ name: "categoryId", type: "bytes32" }], outputs: [{ type: "uint8" }],
}] as const;

const compositeFeedRefreshedEvent = {
  type: "event", name: "CompositeFeedRefreshed",
  inputs: [
    { name: "categoryId", type: "bytes32", indexed: true },
    { name: "value", type: "uint256", indexed: false },
    { name: "confidence", type: "uint16", indexed: false },
    { name: "contributorCount", type: "uint256", indexed: false },
    { name: "blockNumber", type: "uint256", indexed: false },
  ],
} as const;

async function main() {
  const rpc = process.env.SNAPSHOT_RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";
  const deployments = JSON.parse(
    readFileSync(resolve(process.cwd(), "../contracts/deployments/mantle-sepolia.json"), "utf8"),
  ) as Record<string, string> & { chainId: number };

  const chain = {
    id: deployments.chainId ?? 5003,
    name: "Mantle Sepolia",
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  } as const;
  const client = createPublicClient({ chain, transport: http(rpc) });

  const pm = deployments.PredictionMarket as Hex;
  const registry = deployments.AgentRegistry as Hex;
  const block = Number(await client.getBlockNumber());

  // ── Predictions: scan 1..nextPredictionId-1 ──────────────────────────────────
  const next = Number(await client.readContract({ address: pm, abi: predictionMarketAbi, functionName: "nextPredictionId" }));
  type Raw = { id: number; agentId: number; categoryId: string; value: Hex; confidence: number; status: number; score: bigint; commitBlock: number; resolutionBlock: number };
  const raws: Raw[] = [];
  for (let id = 1; id < next; id++) {
    const p = (await client.readContract({ address: pm, abi: predictionMarketAbi, functionName: "getPrediction", args: [BigInt(id)] })) as {
      agentId: bigint; categoryId: Hex; value: Hex; confidence: number; stake: bigint; commitBlock: bigint; resolutionBlock: bigint; status: number; score: bigint;
    };
    raws.push({
      id, agentId: Number(p.agentId), categoryId: p.categoryId.toLowerCase(), value: p.value,
      confidence: p.confidence, status: p.status, score: p.score,
      commitBlock: Number(p.commitBlock), resolutionBlock: Number(p.resolutionBlock),
    });
  }

  const out: InsightsSnapshot = {
    generatedAt: new Date().toISOString(),
    chainId: chain.id,
    block,
    source: "chain",
    allocation: null,
    categories: {} as InsightsSnapshot["categories"],
  };

  // ── YieldAllocator (global meth/usdy split) ──────────────────────────────────
  try {
    const a = (await client.readContract({ address: deployments.YieldAllocator as Hex, abi: yieldAllocatorAbi, functionName: "getAllocation" })) as readonly [bigint, bigint, bigint, bigint];
    out.allocation = { methBps: Number(a[0]), usdyBps: Number(a[1]) };
  } catch (e) {
    console.warn("[snapshot] allocation read failed:", (e as Error).message);
  }

  for (const cat of categories) {
    const hash = catHash(cat).toLowerCase();
    const scale = scaleFor(cat);
    const resolverAddr = deployments[RESOLVER_KEY[cat]] as Hex;
    const catRaws = raws.filter((r) => r.categoryId === hash);

    // Predictions for this category (decode band; compute outcome for resolved).
    const predictions: SnapPrediction[] = [];
    for (const r of catRaws) {
      let low = 0, high = 0;
      if (r.value && r.value !== "0x") {
        try {
          const [lo, hi] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], r.value) as [bigint, bigint];
          low = Number(lo) / scale; high = Number(hi) / scale;
        } catch { /* leave 0 */ }
      }
      let outcome: number | null = null;
      if (r.status === 2 /* Resolved */) {
        try {
          const ob = (await client.readContract({
            address: resolverAddr, abi: resolverAbi, functionName: "resolve",
            args: [r.value && r.value !== "0x" ? r.value : "0x", BigInt(r.resolutionBlock)],
          })) as Hex;
          const [ov] = decodeAbiParameters([{ type: "uint256" }], ob) as [bigint];
          outcome = Number(ov) / scale;
        } catch (e) {
          console.warn(`[snapshot] outcome read failed pred ${r.id}:`, (e as Error).message);
        }
      }
      predictions.push({
        id: r.id, agentId: r.agentId, status: STATUS[r.status] ?? `status${r.status}`,
        low, high, confidence: r.confidence, score: r.status === 2 ? Number(r.score) : null,
        outcome, commitBlock: r.commitBlock, resolutionBlock: r.resolutionBlock,
      });
    }

    // Reputations for the agents seen in this category.
    const agentIds = [...new Set(catRaws.map((r) => r.agentId))];
    const reputations: SnapReputation[] = [];
    for (const agentId of agentIds) {
      try {
        const rep = (await client.readContract({ address: registry, abi: agentRegistryAbi, functionName: "getReputation", args: [BigInt(agentId), catHash(cat)] })) as {
          accuracyScore: bigint; calibrationScore: bigint; resolvedCount: bigint;
        };
        reputations.push({
          agentId, accuracyScore: Number(rep.accuracyScore),
          calibrationScore: Number(rep.calibrationScore), resolvedCount: Number(rep.resolvedCount),
        });
      } catch (e) {
        console.warn(`[snapshot] reputation read failed agent ${agentId}/${cat}:`, (e as Error).message);
      }
    }

    // Feed history from CompositeFeedRefreshed logs (best-effort; degrade to []).
    let feedHistory: SnapCategory["feedHistory"] = [];
    try {
      const logs = await client.getLogs({
        address: deployments.CompositeFeed as Hex,
        event: compositeFeedRefreshedEvent,
        args: { categoryId: catHash(cat) },
        fromBlock: process.env.SNAPSHOT_FROM_BLOCK ? BigInt(process.env.SNAPSHOT_FROM_BLOCK) : 0n,
        toBlock: "latest",
      });
      feedHistory = logs.map((l) => ({
        block: Number(l.args.blockNumber ?? l.blockNumber ?? 0),
        value: Number(l.args.value ?? 0n) / scale,
        confidence: Number(l.args.confidence ?? 0),
        contributors: Number(l.args.contributorCount ?? 0n),
      })).sort((a, b) => a.block - b.block);
    } catch (e) {
      console.warn(`[snapshot] feed logs failed ${cat}:`, (e as Error).message);
    }

    // Risk state (best-effort).
    let risk: SnapCategory["risk"] = null;
    try {
      const rs = Number(await client.readContract({ address: deployments.RiskManager as Hex, abi: riskManagerAbi, functionName: "riskState", args: [catHash(cat)] }));
      risk = (["Normal", "Caution", "Frozen"][rs] as SnapCategory["risk"]) ?? null;
    } catch (e) {
      console.warn(`[snapshot] risk read failed ${cat}:`, (e as Error).message);
    }

    out.categories[cat] = { reputations, predictions, feedHistory, risk };
  }

  const dir = resolve(process.cwd(), "public");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "insights-snapshot.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  const totalPreds = Object.values(out.categories).reduce((s, c) => s + c.predictions.length, 0);
  console.log(`[gen-insights-snapshot] wrote ${path} @ block ${block} — ${totalPreds} predictions`);
}

main().catch((err) => {
  console.error("[gen-insights-snapshot] failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script.** In `frontend/package.json`, in `"scripts"`, after the `gen:fallback` line, add:

```json
    "gen:insights": "tsx scripts/gen-insights-snapshot.ts",
```

- [ ] **Step 3: Run the script against chain to produce real data.**

Run: `cd frontend && pnpm gen:insights`
Expected: `[gen-insights-snapshot] wrote …/public/insights-snapshot.json @ block <N> — <K> predictions` with K > 0. Warnings on some best-effort reads are acceptable; a hard failure (exit 1) is not.

- [ ] **Step 4: Sanity-check the output.**

Run: `cd frontend && node -e "const s=require('./public/insights-snapshot.json'); console.log('block',s.block,'source',s.source); for(const c of Object.keys(s.categories)){const k=s.categories[c]; console.log(c, 'preds', k.predictions.length, 'resolved', k.predictions.filter(p=>p.status==='Resolved').length, 'reps', k.reputations.length, 'feed', k.feedHistory.length, 'risk', k.risk)}"`
Expected: at least one category with `resolved > 0` and `reps > 0`. (If the chain genuinely has zero resolved predictions, STOP and report — the proof features need ≥1 resolved; do not fabricate.)

- [ ] **Step 5: Commit the script + generated snapshot.**

```bash
git add frontend/scripts/gen-insights-snapshot.ts frontend/package.json frontend/public/insights-snapshot.json
git commit -m "feat(web): build-time chain snapshot for /insights (real on-chain data)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `useInsightsData` hook (snapshot → mock tiering)

**Files:**
- Modify: `frontend/src/lib/hooks.ts`

- [ ] **Step 1: Add the hook.** Append to `frontend/src/lib/hooks.ts` (after the existing exports, before the final `export { CATEGORIES }` line — place the new code above that line):

```ts
import type { InsightsSnapshot, SnapCategory } from "@/lib/snapshot";
import { leaderRowsFromSnapshot, bandsFromSnapshot, feedFromSnapshot } from "@/lib/snapshot";

export interface InsightsData {
  source: DataSource;
  board: LeaderRow[];
  feed: LiveFeedPoint[];
  bands: AgentBand[];
  category: SnapCategory | null;
  allocation: { methBps: number; usdyBps: number } | null;
  generatedAt: string | null;
  block: number | null;
  isLoading: boolean;
}

/// Loads the committed build-time chain snapshot (public/insights-snapshot.json) once.
function useSnapshotFile() {
  return useQuery({
    queryKey: ["insights-snapshot"],
    queryFn: async (): Promise<InsightsSnapshot | null> => {
      const res = await fetch("/insights-snapshot.json");
      if (!res.ok) return null;
      return (await res.json()) as InsightsSnapshot;
    },
    staleTime: Infinity,
    retry: false,
  });
}

/// Single source for the /insights page. Prefers the real chain snapshot; falls back to curated
/// mock so the page always renders. (The REST indexer does not serve replay/outcome/risk data,
/// so the snapshot — not the indexer — is the live tier here.)
export function useInsightsData(category: CategoryId): InsightsData {
  const snap = useSnapshotFile();
  const cat = snap.data?.categories?.[category] ?? null;
  const hasSnap = !!cat && cat.predictions.length > 0;

  if (snap.isLoading) {
    return { source: "live", board: [], feed: [], bands: [], category: null, allocation: null, generatedAt: null, block: null, isLoading: true };
  }
  if (hasSnap && cat) {
    return {
      source: "live",
      board: leaderRowsFromSnapshot(cat),
      feed: feedFromSnapshot(cat),
      bands: bandsFromSnapshot(cat),
      category: cat,
      allocation: snap.data?.allocation ?? null,
      generatedAt: snap.data?.generatedAt ?? null,
      block: snap.data?.block ?? null,
      isLoading: false,
    };
  }
  // No snapshot → curated mock (demo-shaped).
  return {
    source: "mock",
    board: mockLeaderRows(category),
    feed: mockFeedPoints(category),
    bands: mockBands(category),
    category: null,
    allocation: { methBps: 6000, usdyBps: 4000 },
    generatedAt: null,
    block: null,
    isLoading: false,
  };
}
```

Note: `mockLeaderRows`, `mockFeedPoints`, `mockBands`, `DataSource`, `LeaderRow`, `LiveFeedPoint`, `AgentBand`, `CategoryId`, `useQuery` are all already defined/imported in `hooks.ts` (Task data confirmed). Add the two `import` lines at the top with the other imports rather than mid-file if your linter prefers; mid-file imports are valid TS but `import/first` may warn — move them up to the import block to be safe.

- [ ] **Step 2: Typecheck.**

Run: `cd frontend && pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint.**

Run: `cd frontend && pnpm lint`
Expected: clean (move the new imports to the top import block if `import/first` warns).

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/lib/hooks.ts
git commit -m "feat(web): useInsightsData — snapshot-first data hook for /insights

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Route InsightsClient through the snapshot + §0 caption + §6 footer

**Files:**
- Modify: `frontend/src/app/(app)/insights/InsightsClient.tsx`

- [ ] **Step 1: Swap the data hooks.** In `InsightsClient.tsx`, replace the three hook calls

```tsx
  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);
  const bands = useSmartMoneyBands(categoryId);

  const source = board.source; // representative tier for the page
```

with:

```tsx
  const data = useInsightsData(categoryId);
  const source = data.source;
```

Update the import line `import { useLeaderboard, useFeedHistory, useSmartMoneyBands } from "@/lib/hooks";` to `import { useInsightsData } from "@/lib/hooks";`.

- [ ] **Step 2: Update the loading + card props.** Replace the findings-grid block (`{board.isLoading || feed.isLoading ? (...) : (...)}`) with:

```tsx
      <div id="insights-findings" className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.isLoading ? (
          <div className="lg:col-span-2 space-y-3" aria-busy>
            <Skeleton className="h-40 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        ) : (
          <>
            <SmartMoneyCard
              categoryId={categoryId}
              bands={data.bands}
              crowdValue={data.feed[data.feed.length - 1]?.value ?? null}
            />
            <DisagreementCallout
              categoryId={categoryId}
              bands={data.bands}
              crowdValue={data.feed[data.feed.length - 1]?.value ?? null}
            />
            <ConsensusBandCard categoryId={categoryId} history={data.feed} bands={data.bands} />
            <NotableMoveCard categoryId={categoryId} history={data.feed} />
            <AnomalyFeed categoryId={categoryId} history={data.feed} />
            <TopPerformersCard rows={data.board} />
          </>
        )}
      </div>
```

- [ ] **Step 3: Add the §0 snapshot caption.** Replace the header `StatusPill` block with:

```tsx
        <div className="flex flex-col items-end gap-1">
          <StatusPill tone={source === "live" ? "up" : "muted"} dot pulse={source === "live"}>
            {source === "live" ? "Live on-chain data" : "Demo data"}
          </StatusPill>
          {source === "live" && data.block ? (
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
              snapshot @ block #{data.block.toLocaleString("en-US")}
              {data.generatedAt ? ` · ${new Date(data.generatedAt).toLocaleDateString("en-US")}` : ""}
            </span>
          ) : null}
        </div>
```

- [ ] **Step 4: Mount the new sections.** Directly after the category-tabs `<div className="mt-8">…</div>` block and before the findings grid, add §1 then §2 (proof → replay = the top-of-page peak):

```tsx
      <ProofStrip data={data} categoryId={categoryId} />
      <ReplayCard categoryId={categoryId} predictions={data.category?.predictions ?? []} />
```

After the findings grid `</div>` and before the methodology footer, add §5:

```tsx
      <YourMoveStrip categoryId={categoryId} data={data} />
```

- [ ] **Step 5: Expand §6 methodology footer.** In the footer block, after the existing `<p>…</p>`, add a second paragraph:

```tsx
        <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-dim)]">Honesty note:</span> for this demo the outcome
          oracles (mETH / USDY rates) are seeded with a deterministic curve — the AI forecasts and the
          on-chain grading are fully real, but the &quot;reality&quot; they are graded against is
          demo-seeded until v2 reads the live Ondo / mETH contracts. Track-record sample sizes are small
          and growing. All figures are computed from Mantle Sepolia
          {source === "live" && data.block ? ` at block #${data.block.toLocaleString("en-US")}` : ""}.
        </p>
```

- [ ] **Step 6: Add imports.** At the top of `InsightsClient.tsx`, add:

```tsx
import { ProofStrip } from "./ProofStrip";
import { ReplayCard } from "./ReplayCard";
import { DisagreementCallout } from "./DisagreementCallout";
import { AnomalyFeed } from "./AnomalyFeed";
import { YourMoveStrip } from "./YourMoveStrip";
```

> These components are created in Tasks 6–10. To keep this task independently committable, create thin stubs first if a subagent executes Task 5 before 6–10 (each stub: `export function X(_: any) { return null; }`). The real implementations replace the stubs in their own tasks. If executing in order 6→10→5, no stubs are needed — prefer that order.

- [ ] **Step 7: Build.**

Run: `cd frontend && pnpm build`
Expected: green; `/insights` stays static.

- [ ] **Step 8: Commit.**

```bash
git add frontend/src/app/(app)/insights/InsightsClient.tsx
git commit -m "feat(web): /insights consumes chain snapshot + §0 caption + §6 honesty footer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: §1 ProofStrip

**Files:**
- Create: `frontend/src/app/(app)/insights/ProofStrip.tsx`

- [ ] **Step 1: Implement.** Create `frontend/src/app/(app)/insights/ProofStrip.tsx`:

```tsx
"use client";

import { ShieldCheck } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { topVsCrowdAccuracy, signalTrackRecord, MIN_RESOLVED_QUALIFIED } from "@/lib/insights";
import type { InsightsData } from "@/lib/hooks";
import type { CategoryId } from "@/lib/mockData";
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

export function ProofStrip({ data, categoryId }: { data: InsightsData; categoryId: CategoryId }) {
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
```

- [ ] **Step 2: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green/clean.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/(app)/insights/ProofStrip.tsx
git commit -m "feat(web): §1 ProofStrip — top-vs-crowd, graded count, track record

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: §2 ReplayCard (forecast-vs-reality)

**Files:**
- Create: `frontend/src/app/(app)/insights/ReplayCard.tsx`

- [ ] **Step 1: Implement.** Create `frontend/src/app/(app)/insights/ReplayCard.tsx`:

```tsx
"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
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
    .filter((p) => p.status === "Resolved" && p.outcome != null && p.high >= p.low)
    .sort((a, b) => b.resolutionBlock - a.resolutionBlock)
    .slice(0, 4);

  return (
    <Panel elevation={1} className="mt-4">
      <PanelHeader
        caption="Forecast vs reality"
        title={`How AI forecasts actually landed — ${FRIENDLY_CATEGORY[categoryId]}`}
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
```

- [ ] **Step 2: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green/clean.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/(app)/insights/ReplayCard.tsx
git commit -m "feat(web): §2 ReplayCard — predicted band vs real on-chain outcome

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: §3 DisagreementCallout

**Files:**
- Create: `frontend/src/app/(app)/insights/DisagreementCallout.tsx`

- [ ] **Step 1: Implement.** Create `frontend/src/app/(app)/insights/DisagreementCallout.tsx`:

```tsx
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
```

- [ ] **Step 2: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green/clean.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/(app)/insights/DisagreementCallout.tsx
git commit -m "feat(web): §3 DisagreementCallout — biggest qualified-AI split

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: §4 AnomalyFeed + AlertPreview

**Files:**
- Create: `frontend/src/app/(app)/insights/AnomalyFeed.tsx`

- [ ] **Step 1: Implement.** Create `frontend/src/app/(app)/insights/AnomalyFeed.tsx`:

```tsx
"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Bell, TrendingDown, TrendingUp } from "lucide-react";
import { friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";
import { anomalyTimeline } from "@/lib/insights";
import type { LiveFeedPoint } from "@/lib/indexer";
import type { CategoryId } from "@/lib/mockData";

/** Telegram/Discord-style alert mock — concretizes the productized anomaly bot for integrators. */
function AlertPreview({ categoryId, text }: { categoryId: CategoryId; text: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15 text-[var(--color-accent)]">
          <Bell size={11} aria-hidden />
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text)]">noetrix alerts</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">· bot · now</span>
        <StatusPill tone="muted" className="ml-auto">product preview</StatusPill>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-dim)]">
        🔔 <span className="text-[var(--color-text)]">{FRIENDLY_CATEGORY[categoryId]}</span> — {text}
      </p>
    </div>
  );
}

export function AnomalyFeed({ categoryId, history }: { categoryId: CategoryId; history: LiveFeedPoint[] }) {
  const anomalies = anomalyTimeline(history, 16, 2).slice().reverse().slice(0, 5);
  const latest = anomalies[0];
  const alertText = latest
    ? `unusual ${latest.direction === "up" ? "jump" : "drop"} of ${Math.abs(latest.deltaPct).toFixed(1)}% detected — now ${friendlyValue(categoryId, latest.to)}.`
    : "no unusual moves right now — all quiet.";

  return (
    <Panel elevation={1} className="lg:col-span-2">
      <PanelHeader
        caption="What's unusual"
        title={`Anomaly watch — ${FRIENDLY_CATEGORY[categoryId]}`}
        right={<StatusPill tone={anomalies.length ? "warn" : "up"}>{anomalies.length} flagged</StatusPill>}
      />
      <PanelBody className="pt-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            {anomalies.length === 0 ? (
              <EmptyState title="No anomalies detected" body="Sharp 24h moves in the AI consensus get flagged here automatically." />
            ) : (
              <ul className="flex flex-col gap-2">
                {anomalies.map((a) => (
                  <li key={a.block} className="flex items-center gap-3 rounded border border-[var(--color-border)] px-3 py-2 text-sm">
                    <span className={a.direction === "up" ? "text-[var(--color-up)]" : "text-[var(--color-down)]"}>
                      {a.direction === "up" ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                    </span>
                    <span className="text-[var(--color-text-dim)]">
                      {a.direction === "up" ? "Jumped" : "Dropped"}{" "}
                      <span className="text-[var(--color-text)]">{Math.abs(a.deltaPct).toFixed(1)}%</span> to{" "}
                      {friendlyValue(categoryId, a.to)}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-[var(--color-text-muted)]">#{a.block.toLocaleString("en-US")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <AlertPreview categoryId={categoryId} text={alertText} />
            <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
              Each anomaly is derived from the on-chain AI consensus. In production these stream to
              Telegram / Discord — the card above is a preview of that alert.
            </p>
          </div>
        </div>
      </PanelBody>
    </Panel>
  );
}
```

- [ ] **Step 2: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green/clean.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/(app)/insights/AnomalyFeed.tsx
git commit -m "feat(web): §4 AnomalyFeed + Telegram/Discord alert preview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: §5 YourMoveStrip

**Files:**
- Create: `frontend/src/app/(app)/insights/YourMoveStrip.tsx`

- [ ] **Step 1: Implement.** Create `frontend/src/app/(app)/insights/YourMoveStrip.tsx`:

```tsx
"use client";

import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { ShieldAlert, ShieldCheck, ShieldX, PieChart } from "lucide-react";
import { smartMoneyDivergence, notableMove, topFinding } from "@/lib/insights";
import { bpsToPct, FRIENDLY_CATEGORY } from "@/lib/labels";
import type { InsightsData } from "@/lib/hooks";
import type { CategoryId } from "@/lib/mockData";

const RISK_UI = {
  Normal: { tone: "up" as const, label: "Looking healthy", icon: ShieldCheck },
  Caution: { tone: "warn" as const, label: "Cautious", icon: ShieldAlert },
  Frozen: { tone: "down" as const, label: "Paused for safety", icon: ShieldX },
};

export function YourMoveStrip({ categoryId, data }: { categoryId: CategoryId; data: InsightsData }) {
  const crowd = data.feed[data.feed.length - 1]?.value ?? null;
  const div = smartMoneyDivergence(data.bands, crowd);
  const move = notableMove(data.feed, 16, 1);
  const briefing = topFinding(div, move, FRIENDLY_CATEGORY[categoryId]);

  const risk = data.category?.risk ?? null;
  const riskUi = risk ? RISK_UI[risk] : null;
  const RiskIcon = riskUi?.icon ?? ShieldCheck;

  const alloc = data.allocation;

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

          {/* AI allocation */}
          <div className="flex flex-col gap-2 md:col-span-2">
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
```

- [ ] **Step 2: Build + lint.**

Run: `cd frontend && pnpm build && pnpm lint`
Expected: green/clean.

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/app/(app)/insights/YourMoveStrip.tsx
git commit -m "feat(web): §5 YourMoveStrip — briefing + risk monitor + AI allocation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Verification gate + CLAUDE.md session entry

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Full verification sweep.**

Run each, confirm the expected result:
- `cd frontend && pnpm lint` → clean (0 errors / 0 warnings).
- `cd frontend && pnpm test` → all pass (insights + snapshot + existing labels/narrate suites).
- `cd frontend && pnpm exec tsc --noEmit` → exit 0.
- `cd frontend && pnpm build` → green; route list includes `/insights` (static) + `/api/narrate` (ƒ).
- `cd frontend && pnpm test:e2e` → Playwright 375px smoke for `/insights` passes (no horizontal overflow). If Chromium isn't installed, run `pnpm exec playwright install chromium` first; if install is blocked, record a manual 375px check instead and note it.

STOP and report if any command fails — do not paper over a red result.

- [ ] **Step 2: Re-run the snapshot so the committed JSON is current.**

Run: `cd frontend && pnpm gen:insights` then re-verify with the Task 3 Step 4 sanity check. If it changed, `git add frontend/public/insights-snapshot.json` and include it in the final commit.

- [ ] **Step 3: Append a session entry to `CLAUDE.md` §6.** Add a new dated entry (do not edit prior entries) summarizing: proof-first `/insights` extension (proof strip, replay, disagreement, anomaly feed + alert preview, your-move strip, honesty footer); build-time chain snapshot (`gen-insights-snapshot.ts` → `public/insights-snapshot.json`, real on-chain data, AAVE 8-dec normalization); new pure fns + derive fns (TDD); `useInsightsData` snapshot-first tiering; verification results; and the honest caveats (data-thin/N-growing, seeded oracle, snapshot is static until re-run, deployment still postponed).

- [ ] **Step 4: Commit.**

```bash
git add CLAUDE.md frontend/public/insights-snapshot.json
git commit -m "docs: session — proof-first /insights investor surface + chain snapshot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Offer branch finish.** Invoke superpowers:finishing-a-development-branch (local FF-merge to master vs PR — user decides). Deployment stays postponed.

---

## Self-Review notes (for the executor)
- **Order dependency:** Task 5 imports components from Tasks 6–10. Execute 1→2→3→4 then **6→7→8→9→10→5→11**, or create null stubs in Task 5 Step 6. Prefer the 6–10-before-5 order.
- **Data gate:** if Task 3 Step 4 shows zero resolved predictions on-chain, the proof features have nothing real to show. STOP and report rather than fabricate — the user chose "wire real data first."
- **AAVE scale:** the snapshot divides USD 8-dec values by 1e8 so `friendlyValue` renders plain dollars. Do not double-scale in components.
- **No new deps:** everything uses already-installed packages (viem, recharts, lucide-react, tanstack-query, vitest).
