# Alpha & Data — Insights Lens + Web2 Narration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition the Noetrix/Predictor-Index frontend for the Alpha & Data track by adding a Web2-legible `/insights` findings page (centerpiece: "smart-money vs crowd" divergence) + plain-English AI narration, after clearing prior lint/verification debt.

**Architecture:** All new analytics are **pure functions** (`lib/insights.ts`) over the existing normalized rows from `useLeaderboard`/`useFeedHistory`, plus one new band hook. A new `/insights` route renders findings as Recharts visualizations with Web2 copy. AI narration comes from two sources: the reasoner agent self-narrates (extra fields in its existing OpenRouter→DeepSeek call) and a cached server route `/api/narrate` narrates any agent. Prior debt (lint + tour/375px verification) is cleared first.

**Tech Stack:** Next.js 16.2.6 (App Router, async params, route handlers), React 19 + React Compiler, Recharts 3.8, TanStack Query 5, viem, Tailwind v4, vitest (new), @playwright/test (new). Spec: `docs/superpowers/specs/2026-06-01-alpha-data-insights-and-narration-design.md`.

> **Conventions for every task:**
> - Run all `pnpm` commands from `D:/Hackathon/mantle-hackathon/frontend` unless a path says otherwise. Use `pnpm --filter frontend <script>` from repo root equivalently.
> - **Next 16 caveat:** before editing/adding any route or `params` usage, read `frontend/node_modules/next/dist/docs/` (per `frontend/AGENTS.md`). `params` is a Promise in server pages.
> - Branch is `alpha-data-insights-narration` (already created). Commit after each task. End every commit message body with:
>   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
> - Keep the terminal-core aesthetic + design tokens (`--color-bg`, `--color-accent`, etc.). No new fonts, no re-theme.

---

## Task 1: Clear lint debt (spec §3.1)

Fix all 10 lint **errors** + 6 **warnings** at root cause (no `eslint-disable`). Exact list captured from `pnpm lint` on 2026-06-01.

**Files:**
- Modify: `frontend/src/app/(app)/about/page.tsx` (lines 51, 88, 97)
- Modify: `frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx` (imports + 3 `useMemo` blocks)
- Modify: `frontend/src/components/app/AppHeader.tsx` (line ~104)
- Modify: `frontend/src/components/ui/dithering-shader.tsx` (line 324)
- Modify: `frontend/src/app/(app)/feed/[category]/FeedClient.tsx` (imports)
- Modify: `frontend/src/components/rwa/AllocationBar.tsx` (line 3)

- [ ] **Step 1: Escape apostrophes in `about/page.tsx`**

At lines 51, 88, 97 replace the literal `'` inside JSX text with `&apos;`. Read each line first; e.g. `don't` → `don&apos;t`, `agent's` → `agent&apos;s`.

- [ ] **Step 2: Remove unused imports in `AgentDetailClient.tsx`**

Delete the unused `DataTable`, `Column`, and `AGENTS` imports:
```tsx
// remove this line entirely:
import { DataTable, type Column } from "@/components/ui/DataTable";
// in the mockData import, drop AGENTS:
import {
  CATEGORIES,
  PREDICTIONS,
  type CategoryId,
  type Prediction,
  type Agent,
  getAgentById,
} from "@/lib/mockData";
```

- [ ] **Step 3: Convert the 3 manual `useMemo`s to plain consts in `AgentDetailClient.tsx`**

React Compiler is on and cannot preserve these manual memos (deps flagged as "may be mutated"). The compiler auto-memoizes, so remove the `React.useMemo` wrappers. Replace the `predictions`, `featuredReasoning`, and `radarData` blocks (current lines ~64–94) with:
```tsx
  const predictions = PREDICTIONS.filter(
    (p) => p.agentId === agent.id && p.categoryId === categoryId,
  ).sort((a, b) => b.commitBlock - a.commitBlock);

  // Most recent prediction that carries a reasoning trace — surfaced as the page's visual peak.
  const featuredReasoning =
    predictions.find((p) => p.reasoning) ??
    PREDICTIONS.filter((p) => p.agentId === agent.id && p.reasoning).sort(
      (a, b) => b.commitBlock - a.commitBlock,
    )[0];

  const radarData = RADAR_AXES.map((axis) => ({
    axis: axis.label,
    value: radarValue(agent, categoryId, axis.id),
  }));
```
(Leave the other non-flagged code unchanged. `calibrationData`/`equityData`/`tabs` are already plain consts.)

- [ ] **Step 4: Fix setState-in-effect in `AppHeader.tsx`**

Replace the `mounted` state + effect in `ConnectButton` (lines ~101, ~104) with a hydration-safe external store read (no setState in effect):
```tsx
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  // Hydration-safe "client mounted" flag without setState-in-effect (server snapshot = false).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
```
Delete the now-unused `React.useEffect(() => setMounted(true), [])` and the `const [mounted, setMounted] = React.useState(false)` line.

- [ ] **Step 5: Move the impure `Date.now()` out of render in `dithering-shader.tsx`**

Line 324 `const startTimeRef = useRef<number>(Date.now());` calls an impure fn during render. Initialize to 0 and set it inside the existing `useEffect` (before the animation loop):
```tsx
  const startTimeRef = useRef<number>(0);
```
Then near the top of the `useEffect` body (after `if (!canvas) return;`, before the loop starts), add:
```tsx
    startTimeRef.current = Date.now();
```

- [ ] **Step 6: Remove unused imports in `FeedClient.tsx` and `AllocationBar.tsx`**

In `FeedClient.tsx` remove unused `Line` (line 9) and `Stat` (line 18) from their imports. In `AllocationBar.tsx` remove the unused `usdyBps` (line 3) — read the line and drop the param/destructure (keep the value passed by callers if a prop; if it's a destructured-but-unused prop, prefix with `_` only if required by callers, otherwise remove from the destructure).

- [ ] **Step 7: Verify lint is clean**

Run: `pnpm --filter frontend lint`
Expected: no errors and no warnings (exit 0, empty output).

- [ ] **Step 8: Verify build still green**

Run: `pnpm --filter frontend build`
Expected: compiles; all existing routes generate; only the known benign Recharts SSR width/height warning.

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "fix(web): clear lint debt — escapes, react-compiler memo, setState-in-effect, impure render, unused imports" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add a unit-test runner (vitest)

The repo has no frontend test runner; later tasks TDD pure functions. Add vitest (TS-native, zero-config for node env).

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/lib/__smoke__.test.ts` (temporary smoke, deleted in this task's last step)

- [ ] **Step 1: Install vitest**

Run: `pnpm --filter frontend add -D vitest@^2`
Expected: vitest added to devDependencies.

- [ ] **Step 2: Add the test script**

In `frontend/package.json` `scripts`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Add vitest config**

Create `frontend/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Write a smoke test**

Create `frontend/src/lib/__smoke__.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm --filter frontend test`
Expected: 1 passed.

- [ ] **Step 6: Delete the smoke + commit**

```bash
rm frontend/src/lib/__smoke__.test.ts
git add frontend/package.json frontend/vitest.config.ts frontend/pnpm-lock.yaml
git commit -m "chore(web): add vitest for pure-function unit tests" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `lib/labels.ts` — Web2 jargon translation + formatters (TDD)

Single source for plain-English labels + value formatters used by `/insights`, the teaser, and narration. (Spec §6.)

**Files:**
- Create: `frontend/src/lib/labels.ts`
- Test: `frontend/src/lib/labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/labels.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bpsToPct, usd, friendlyValue, FRIENDLY_CATEGORY } from "@/lib/labels";

describe("labels", () => {
  it("bpsToPct converts basis points to percent", () => {
    expect(bpsToPct(3812)).toBe("38.12%");
    expect(bpsToPct(500, 1)).toBe("5.0%");
  });
  it("usd formats with $ and thousands", () => {
    expect(usd(142_000_000)).toBe("$142,000,000");
  });
  it("friendlyValue uses % for bps categories and $ for usd categories", () => {
    expect(friendlyValue("METH_APR_24H", 3812)).toBe("38.12%");
    expect(friendlyValue("AAVE_MANTLE_TVL_24H", 142_000_000)).toBe("$142,000,000");
  });
  it("FRIENDLY_CATEGORY has plain-English names with no jargon", () => {
    expect(FRIENDLY_CATEGORY.USDY_APY_24H).toBe("USDY yield");
    expect(FRIENDLY_CATEGORY.METH_APR_24H).toBe("mETH staking yield");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter frontend test`
Expected: FAIL — cannot resolve `@/lib/labels`.

- [ ] **Step 3: Implement `lib/labels.ts`**

```ts
import { CATEGORIES, type CategoryId } from "@/lib/mockData";

/** Basis points (1/100 of a percent) → human percent string. 3812 → "38.12%". */
export function bpsToPct(bps: number, dp = 2): string {
  return `${(bps / 100).toFixed(dp)}%`;
}

/** USD with $ and thousands; no decimals by default. */
export function usd(value: number, dp = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

/** Format a category's value in its own unit, Web2-friendly (% or $). */
export function friendlyValue(category: CategoryId, value: number): string {
  return CATEGORIES[category].unit === "usd" ? usd(value) : bpsToPct(value);
}

/** Plain-English metric name per category — no APR/APY/bps/feed jargon. */
export const FRIENDLY_CATEGORY: Record<CategoryId, string> = {
  METH_APR_24H: "mETH staking yield",
  USDY_APY_24H: "USDY yield",
  AAVE_MANTLE_TVL_24H: "Aave-on-Mantle deposits",
};

/** Web2 glossary for tooltips/disclosure copy. */
export const GLOSSARY = {
  consensus:
    "The combined view of every qualifying AI forecaster — what we call the 'AI consensus'.",
  smartMoney:
    "The forecasters with the best on-chain track record — most accurate and honest about their confidence.",
  accuracyScore:
    "How close an AI's past forecasts landed to the real outcome, graded automatically on-chain.",
  range: "The band an AI is confident the value will fall within.",
  uncertainty:
    "How much the AIs disagree right now. More disagreement = less certainty.",
} as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter frontend test`
Expected: PASS (labels suite green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/labels.ts frontend/src/lib/labels.test.ts
git commit -m "feat(web): lib/labels — Web2 jargon translation + value formatters" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/insights.ts` — pure findings (TDD)

Pure functions that derive the findings. No I/O. (Spec §4.3.)

> **Note vs spec:** the spec's "rising agents" finding needs a per-agent accuracy time series we don't have from a single leaderboard snapshot. To stay honest, this is implemented as **`topPerformers`** (accuracy leaders right now), not momentum. Documented in the final CLAUDE.md entry.

**Files:**
- Create: `frontend/src/lib/insights.ts`
- Test: `frontend/src/lib/insights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/insights.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  smartMoneyDivergence,
  uncertaintyLevel,
  notableMove,
  topPerformers,
  topFinding,
  type AgentBand,
} from "@/lib/insights";
import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";

const band = (o: Partial<AgentBand>): AgentBand => ({
  agentId: 1, name: "a", accuracyScore: 500_000, resolvedCount: 20, low: 3700, high: 3900, ...o,
});

describe("smartMoneyDivergence", () => {
  it("flags 'higher' when accuracy-weighted smart-money midpoint exceeds the crowd", () => {
    const bands = [band({ agentId: 1, low: 4000, high: 4200, accuracyScore: 900_000 })];
    const d = smartMoneyDivergence(bands, 3800);
    expect(d.enoughData).toBe(true);
    expect(d.direction).toBe("higher");
    expect(d.smartMoneyValue).toBeGreaterThan(3800);
  });
  it("ignores agents below the qualified threshold", () => {
    const d = smartMoneyDivergence([band({ resolvedCount: 5 })], 3800);
    expect(d.enoughData).toBe(false);
    expect(d.smartMoneyValue).toBeNull();
  });
  it("returns enoughData=false when crowd value is null", () => {
    expect(smartMoneyDivergence([band({})], null).enoughData).toBe(false);
  });
});

describe("uncertaintyLevel", () => {
  it("is Low when qualified bands cluster tightly", () => {
    const bands = [band({ agentId: 1, low: 3790, high: 3810 }), band({ agentId: 2, low: 3795, high: 3805 })];
    expect(uncertaintyLevel(bands, 3800).level).toBe("Low");
  });
  it("is High when midpoints are far apart", () => {
    const bands = [band({ agentId: 1, low: 3000, high: 3100 }), band({ agentId: 2, low: 4500, high: 4600 })];
    expect(uncertaintyLevel(bands, 3800).level).toBe("High");
  });
});

describe("notableMove", () => {
  const pt = (value: number, block: number): LiveFeedPoint => ({ block, value, confidence: 7000, contributors: 5 });
  it("flags a move above threshold", () => {
    const hist = [pt(3800, 1), pt(3800, 2), pt(3990, 3)];
    const m = notableMove(hist, 2, 1);
    expect(m.isNotable).toBe(true);
    expect(m.direction).toBe("up");
  });
  it("is not notable for a tiny move", () => {
    const hist = [pt(3800, 1), pt(3801, 2)];
    expect(notableMove(hist, 1, 1).isNotable).toBe(false);
  });
});

describe("topPerformers", () => {
  const row = (id: number, acc: number, resolved: number): LeaderRow => ({
    id, name: `agent #${id}`, kind: "CLAUDE", accuracyScore: acc, calibrationScore: -1, resolvedCount: resolved, lastUpdatedBlock: 1,
  });
  it("filters below-threshold and sorts by accuracy desc", () => {
    const rows = [row(1, 100, 5), row(2, 800, 20), row(3, 500, 15)];
    const top = topPerformers(rows, 2);
    expect(top.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("topFinding", () => {
  it("prefers a notable move headline", () => {
    const div = smartMoneyDivergence([], null);
    const m = { deltaPct: 2.4, isNotable: true, direction: "up" as const, current: 100, prior: 97 };
    expect(topFinding(div, m, "mETH staking yield")).toContain("jumped");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter frontend test`
Expected: FAIL — cannot resolve `@/lib/insights`.

- [ ] **Step 3: Implement `lib/insights.ts`**

```ts
import type { LeaderRow, LiveFeedPoint } from "@/lib/indexer";

export const MIN_RESOLVED_QUALIFIED = 10;
export const SMART_MONEY_TOP_N = 8;

export type Direction = "higher" | "lower" | "in line";
export type UncertaintyLevel = "Low" | "Medium" | "High";

export interface AgentBand {
  agentId: number;
  name: string;
  accuracyScore: number; // -1e6..1e6
  resolvedCount: number;
  low: number;
  high: number;
}

export interface SmartMoneyDivergence {
  qualifiedCount: number;
  smartMoneyValue: number | null;
  crowdValue: number | null;
  delta: number;
  deltaPct: number;
  direction: Direction;
  enoughData: boolean;
}

/** Map a signed accuracy score (-1e6..1e6) to a positive weight in ~[0.01, 1]. */
function accuracyWeight(score: number): number {
  return Math.max(0.01, score / 1_000_000 / 2 + 0.5);
}

/** Accuracy-weighted midpoint of the top-N qualified agents' bands vs the crowd composite value. */
export function smartMoneyDivergence(
  bands: AgentBand[],
  crowdValue: number | null,
): SmartMoneyDivergence {
  const qualified = bands.filter(
    (b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low,
  );
  const ranked = [...qualified]
    .sort((a, b) => b.accuracyScore - a.accuracyScore)
    .slice(0, SMART_MONEY_TOP_N);
  if (ranked.length === 0 || crowdValue == null) {
    return {
      qualifiedCount: qualified.length,
      smartMoneyValue: null,
      crowdValue,
      delta: 0,
      deltaPct: 0,
      direction: "in line",
      enoughData: false,
    };
  }
  let acc = 0;
  let wsum = 0;
  for (const b of ranked) {
    const w = accuracyWeight(b.accuracyScore);
    acc += w * ((b.low + b.high) / 2);
    wsum += w;
  }
  const smartMoneyValue = acc / wsum;
  const delta = smartMoneyValue - crowdValue;
  const deltaPct = crowdValue !== 0 ? (delta / crowdValue) * 100 : 0;
  const direction: Direction =
    Math.abs(deltaPct) < 0.5 ? "in line" : delta > 0 ? "higher" : "lower";
  return {
    qualifiedCount: qualified.length,
    smartMoneyValue,
    crowdValue,
    delta,
    deltaPct,
    direction,
    enoughData: true,
  };
}

export interface UncertaintySignal {
  level: UncertaintyLevel;
  spreadPct: number;
  enoughData: boolean;
}

/** Dispersion of qualified band midpoints, as a % of the crowd value → an uncertainty level. */
export function uncertaintyLevel(
  bands: AgentBand[],
  crowdValue: number | null,
): UncertaintySignal {
  const q = bands.filter(
    (b) => b.resolvedCount >= MIN_RESOLVED_QUALIFIED && b.high >= b.low,
  );
  if (q.length === 0 || !crowdValue) {
    return { level: "Medium", spreadPct: 0, enoughData: false };
  }
  const mids = q.map((b) => (b.low + b.high) / 2);
  const spreadPct = ((Math.max(...mids) - Math.min(...mids)) / crowdValue) * 100;
  const level: UncertaintyLevel =
    spreadPct < 2 ? "Low" : spreadPct < 6 ? "Medium" : "High";
  return { level, spreadPct, enoughData: true };
}

export interface NotableMove {
  deltaPct: number;
  isNotable: boolean;
  direction: "up" | "down" | "flat";
  current: number | null;
  prior: number | null;
}

/** Compare the latest composite value to one ~lookback points earlier (≈ 24h ago). */
export function notableMove(
  history: LiveFeedPoint[],
  lookback = 16,
  thresholdPct = 1,
): NotableMove {
  if (history.length === 0) {
    return { deltaPct: 0, isNotable: false, direction: "flat", current: null, prior: null };
  }
  const current = history[history.length - 1].value;
  const prior = history[Math.max(0, history.length - 1 - lookback)].value;
  const deltaPct = prior !== 0 ? ((current - prior) / prior) * 100 : 0;
  const direction = Math.abs(deltaPct) < 0.1 ? "flat" : deltaPct > 0 ? "up" : "down";
  return { deltaPct, isNotable: Math.abs(deltaPct) >= thresholdPct, direction, current, prior };
}

/** Accuracy leaders among qualified agents (snapshot; momentum needs history → v-next). */
export function topPerformers(rows: LeaderRow[], n = 3): LeaderRow[] {
  return rows
    .filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED)
    .sort((a, b) => b.accuracyScore - a.accuracyScore)
    .slice(0, n);
}

/** Pick the most newsworthy one-line headline for the landing teaser. `categoryFriendly` is plain English. */
export function topFinding(
  div: SmartMoneyDivergence,
  move: NotableMove,
  categoryFriendly: string,
): string {
  if (move.isNotable) {
    const verb = move.direction === "up" ? "jumped" : "dropped";
    return `${categoryFriendly} ${verb} ${Math.abs(move.deltaPct).toFixed(1)}% in the last day.`;
  }
  if (div.enoughData && div.direction !== "in line") {
    return `The most accurate AIs expect ${categoryFriendly} ${div.direction} than the crowd.`;
  }
  return `AI consensus for ${categoryFriendly} is holding steady.`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter frontend test`
Expected: PASS (insights + labels suites green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/insights.ts frontend/src/lib/insights.test.ts
git commit -m "feat(web): lib/insights — smart-money divergence, uncertainty, notable-move, top performers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `useSmartMoneyBands` hook — per-agent latest bands

The centerpiece needs each qualified agent's latest band midpoint, which `LeaderRow` lacks. Add a hook: mock path derives from `PREDICTIONS`; live path fetches the top-8 agents' latest revealed prediction in the category.

**Files:**
- Modify: `frontend/src/lib/hooks.ts`
- Read first: `frontend/src/lib/contracts.ts` (confirm `categoryHash(label)` signature — it exists)

- [ ] **Step 1: Add the mock + live band hook to `hooks.ts`**

Add these imports at the top of `hooks.ts` (merge with existing import lines):
```ts
import { getLeaderboard, getFeedHistory, getAgentPredictions, type LeaderRow, type LiveFeedPoint } from "@/lib/indexer";
import { AGENTS, CATEGORIES, PREDICTIONS, makeFeedHistory, type CategoryId } from "@/lib/mockData";
import { categoryHash } from "@/lib/contracts";
import type { AgentBand } from "@/lib/insights";
import { MIN_RESOLVED_QUALIFIED, SMART_MONEY_TOP_N } from "@/lib/insights";
```
(The `getAgentPredictions` and `PREDICTIONS`/`categoryHash`/insights imports are the additions.)

Add the mock builder + hook at the end of the file (before the final `export { CATEGORIES };`):
```ts
function mockBands(category: CategoryId): AgentBand[] {
  const out: AgentBand[] = [];
  for (const a of AGENTS) {
    const latest = PREDICTIONS.filter(
      (p) => p.agentId === a.id && p.categoryId === category && p.status === "Revealed",
    ).sort((p, q) => q.commitBlock - p.commitBlock)[0];
    if (!latest) continue;
    out.push({
      agentId: a.id,
      name: a.name,
      accuracyScore: a.reputation[category].accuracyScore,
      resolvedCount: a.reputation[category].resolvedCount,
      low: latest.value.low,
      high: latest.value.high,
    });
  }
  return out;
}

/// Latest revealed band per qualified agent in a category, for the smart-money centerpiece.
/// Mock path uses curated PREDICTIONS; live path fetches the top-8 leaderboard agents' predictions.
export function useSmartMoneyBands(category: CategoryId): QueryView<AgentBand[]> {
  const q = useQuery({
    queryKey: ["smart-money-bands", category],
    enabled: hasIndexer,
    refetchInterval: REFRESH_MS,
    queryFn: async (): Promise<AgentBand[]> => {
      const board = await getLeaderboard(category, 50);
      const top = board
        .filter((r) => r.resolvedCount >= MIN_RESOLVED_QUALIFIED)
        .sort((a, b) => b.accuracyScore - a.accuracyScore)
        .slice(0, SMART_MONEY_TOP_N);
      const wantHash = categoryHash(category).toLowerCase();
      const perAgent = await Promise.all(
        top.map(async (r) => {
          const preds = await getAgentPredictions(r.id, 50);
          const latest = preds
            .filter(
              (p) =>
                p.value !== undefined &&
                String(p.categoryId).toLowerCase() === wantHash &&
                (p.status === "Revealed" || p.status === "Resolved"),
            )
            .sort((a, b) => b.commitBlock - a.commitBlock)[0];
          if (!latest || !latest.value) return null;
          const band: AgentBand = {
            agentId: r.id,
            name: r.name,
            accuracyScore: r.accuracyScore,
            resolvedCount: r.resolvedCount,
            low: latest.value.low,
            high: latest.value.high,
          };
          return band;
        }),
      );
      return perAgent.filter((b): b is AgentBand => b !== null);
    },
  });

  if (!hasIndexer) {
    return { data: mockBands(category), source: "mock", isLoading: false, isError: false };
  }
  if (q.data && q.data.length > 0) {
    return { data: q.data, source: "live", isLoading: false, isError: false };
  }
  if (q.isLoading) {
    return { data: [], source: "live", isLoading: true, isError: false };
  }
  // Live empty/failed → mock so the centerpiece still renders (demo-shaped, per spec §8).
  return { data: mockBands(category), source: "mock", isLoading: false, isError: q.isError };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter frontend build`
Expected: compiles (build runs `tsc` via next). If `getAgentPredictions` import path differs, fix to match `lib/indexer.ts` exports.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/hooks.ts
git commit -m "feat(web): useSmartMoneyBands — latest qualified-agent bands (mock + live top-8)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `/insights` route skeleton — page, nav, intro, tabs, source pill

Create the route shell with category tabs, a Web2 "what is this" intro, a source pill, and wire the three data hooks. Findings cards land in Tasks 7–8.

**Files:**
- Create: `frontend/src/app/(app)/insights/page.tsx`
- Create: `frontend/src/app/(app)/insights/InsightsClient.tsx`
- Modify: `frontend/src/components/app/AppHeader.tsx` (add nav item)

- [ ] **Step 1: Add the nav link**

In `AppHeader.tsx`, add to `navItems` after the `/leaderboard` entry:
```tsx
  { href: "/insights", label: "Insights" },
```

- [ ] **Step 2: Create the server page**

Create `frontend/src/app/(app)/insights/page.tsx`:
```tsx
import type { Metadata } from "next";
import { InsightsClient } from "./InsightsClient";

export const metadata: Metadata = {
  title: "AI Insights — Noetrix",
  description:
    "Plain-English findings from on-chain AI forecasters on Mantle: smart-money vs the crowd, consensus trends, and uncertainty — built on verifiable on-chain data.",
};

export default function InsightsPage() {
  return <InsightsClient />;
}
```

- [ ] **Step 3: Create the client shell**

Create `frontend/src/app/(app)/insights/InsightsClient.tsx`:
```tsx
"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { StatusPill } from "@/components/ui/StatusPill";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { useLeaderboard, useFeedHistory, useSmartMoneyBands } from "@/lib/hooks";
import { FRIENDLY_CATEGORY } from "@/lib/labels";

export function InsightsClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const board = useLeaderboard(categoryId);
  const feed = useFeedHistory(categoryId);
  const bands = useSmartMoneyBands(categoryId);

  const source = board.source; // representative tier for the page
  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: FRIENDLY_CATEGORY[c.id],
    caption: c.unit === "usd" ? "in US$" : "annual yield %",
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            <span>noetrix</span>
            <span className="text-[var(--color-accent)]">/</span>
            <span>ai insights</span>
          </div>
          <h1 className="mt-2 text-[clamp(28px,3.6vw,40px)] font-medium leading-tight tracking-tight text-[var(--color-text)]">
            What the AIs are seeing,{" "}
            <span className="text-[var(--color-accent)]">in plain English.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-dim)]">
            Findings pulled from on-chain AI forecasters on Mantle — no crypto jargon required.
          </p>
        </div>
        <StatusPill tone={source === "live" ? "up" : "muted"} dot pulse={source === "live"}>
          {source === "live" ? "Live data" : "Demo data"}
        </StatusPill>
      </div>

      {/* What is this — skippable Web2 intro */}
      <details className="group mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-5 py-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-dim)] [&::-webkit-details-marker]:hidden">
          <Info size={14} className="text-[var(--color-accent)]" aria-hidden />
          New here? What this page shows
        </summary>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-text-dim)]">
          <p>
            Independent AI agents publish forecasts for real yields on Mantle (like mETH and USDY).
            Every forecast is graded against the real outcome on-chain, so each AI builds a public,
            tamper-proof track record.
          </p>
          <p>
            Below, the <span className="text-[var(--color-text)]">most accurate AIs</span> (the
            &quot;smart money&quot;) are compared against the whole crowd, so you can see where the
            best forecasters disagree with the average — and how confident they are.
          </p>
        </div>
      </details>

      {/* Cached banner */}
      {source === "cached" ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-center gap-2.5 rounded-md border border-[var(--color-warn)]/40 bg-[color:color-mix(in_srgb,var(--color-warn)_8%,var(--color-bg-elev-1))] px-4 py-2.5"
        >
          <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-[var(--color-warn)] shadow-[0_0_8px_var(--color-warn)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-warn)]">Showing cached data</span>
          <span className="text-xs text-[var(--color-text-dim)]">Live indexer unreachable — retrying automatically.</span>
        </div>
      ) : null}

      {/* Category tabs */}
      <div className="mt-8">
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      {/* Findings grid — cards added in Tasks 7–8 */}
      <div id="insights-findings" className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* placeholder filled by next tasks */}
        <FindingsContext board={board} feed={feed} bands={bands} categoryId={categoryId} />
      </div>

      {/* "Tell us in your submission" — judge + Web2 facing */}
      <div className="mt-12 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-6 text-sm leading-relaxed text-[var(--color-text-dim)]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">how this works</div>
        <p>
          <span className="text-[var(--color-text)]">Data source:</span> live Mantle on-chain data — the
          mETH exchange-rate oracle, USDY rate oracle, and Aave-on-Mantle reserves, plus each agent&apos;s
          on-chain forecast history and accuracy.{" "}
          <span className="text-[var(--color-text)]">AI&apos;s role:</span> independent agents (a Claude/DeepSeek
          reasoner and an ARIMA baseline) forecast each metric; their accuracy is scored on-chain via CRPS.{" "}
          <span className="text-[var(--color-text)]">Verifiable value:</span> every forecast, grade, and the
          resulting &quot;smart-money&quot; view is recorded on Mantle and independently checkable.
        </p>
      </div>
    </div>
  );
}

// Temporary holder so the file compiles before Tasks 7–8 add real cards.
function FindingsContext(_: {
  board: ReturnType<typeof useLeaderboard>;
  feed: ReturnType<typeof useFeedHistory>;
  bands: ReturnType<typeof useSmartMoneyBands>;
  categoryId: CategoryId;
}) {
  return null;
}
```

- [ ] **Step 4: Verify build + route**

Run: `pnpm --filter frontend build`
Expected: compiles; route list now includes `/insights`.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)/insights" frontend/src/components/app/AppHeader.tsx
git commit -m "feat(web): /insights route shell — tabs, Web2 intro, source pill, nav link" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Smart-money centerpiece + consensus band chart

Add the two primary findings: the smart-money-vs-crowd bullet card (centerpiece) and the consensus + uncertainty line/band chart. (Spec §4.3 rows 1–2, 5.)

**Files:**
- Create: `frontend/src/app/(app)/insights/SmartMoneyCard.tsx`
- Create: `frontend/src/app/(app)/insights/ConsensusBandCard.tsx`
- Modify: `frontend/src/app/(app)/insights/InsightsClient.tsx` (replace `FindingsContext` placeholder)

- [ ] **Step 1: Create `SmartMoneyCard.tsx` (bullet-style centerpiece)**

```tsx
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
```

- [ ] **Step 2: Create `ConsensusBandCard.tsx` (line + uncertainty badge)**

```tsx
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
```

- [ ] **Step 3: Wire both cards into `InsightsClient.tsx`**

Replace the `FindingsContext` placeholder usage and function with real cards. Update the findings grid:
```tsx
      {/* Findings grid */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SmartMoneyCard
          categoryId={categoryId}
          bands={bands.data}
          crowdValue={feed.data[feed.data.length - 1]?.value ?? null}
        />
        <ConsensusBandCard categoryId={categoryId} history={feed.data} bands={bands.data} />
        {/* NotableMoveCard + TopPerformersCard added in Task 8 */}
      </div>
```
Add imports at the top:
```tsx
import { SmartMoneyCard } from "./SmartMoneyCard";
import { ConsensusBandCard } from "./ConsensusBandCard";
```
Delete the temporary `FindingsContext` function and its usage.

- [ ] **Step 4: Verify build + lint**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint`
Expected: compiles, lint clean.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)/insights"
git commit -m "feat(web): insights — smart-money centerpiece + consensus band chart" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Notable-move + top-performers cards + data-table fallback + a11y

Add the remaining findings and the accessibility fallbacks (data table per chart, loading skeleton, empty states). (Spec §4.3 rows 3–4, §4.6.)

**Files:**
- Create: `frontend/src/app/(app)/insights/NotableMoveCard.tsx`
- Create: `frontend/src/app/(app)/insights/TopPerformersCard.tsx`
- Modify: `frontend/src/app/(app)/insights/InsightsClient.tsx`
- Modify: `frontend/src/app/(app)/insights/ConsensusBandCard.tsx` (add data-table toggle)

- [ ] **Step 1: Create `NotableMoveCard.tsx`**

```tsx
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
    m.direction === "up" ? "text-[var(--color-up)]" : m.direction === "down" ? "text-[var(--color-down)]" : "text-[var(--color-text-dim)]";

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
```

- [ ] **Step 2: Create `TopPerformersCard.tsx`**

```tsx
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
```

- [ ] **Step 3: Add a data-table fallback toggle to `ConsensusBandCard.tsx`**

Add a `<details>` table below the chart's caption paragraph (accessibility: chart alone isn't screen-reader friendly):
```tsx
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
            View as data table
          </summary>
          <div className="mt-2 max-h-48 overflow-auto rounded border border-[var(--color-border)]">
            <table className="w-full text-left font-mono text-[11px] tabular">
              <thead className="text-[var(--color-text-muted)]">
                <tr>
                  <th scope="col" className="px-3 py-1.5">block</th>
                  <th scope="col" className="px-3 py-1.5">AI consensus</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(-12).map((d) => (
                  <tr key={d.block} className="border-t border-[var(--color-border)] text-[var(--color-text-dim)]">
                    <td className="px-3 py-1">#{d.block.toLocaleString("en-US")}</td>
                    <td className="px-3 py-1">{friendlyValue(categoryId, d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
```

- [ ] **Step 4: Wire both new cards + loading/empty into `InsightsClient.tsx`**

Update the findings grid to include a loading skeleton and the two new cards:
```tsx
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {board.isLoading || feed.isLoading ? (
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
              bands={bands.data}
              crowdValue={feed.data[feed.data.length - 1]?.value ?? null}
            />
            <ConsensusBandCard categoryId={categoryId} history={feed.data} bands={bands.data} />
            <NotableMoveCard categoryId={categoryId} history={feed.data} />
            <TopPerformersCard rows={board.data} />
          </>
        )}
      </div>
```
Add imports:
```tsx
import { Skeleton } from "@/components/ui/Skeleton";
import { NotableMoveCard } from "./NotableMoveCard";
import { TopPerformersCard } from "./TopPerformersCard";
```

- [ ] **Step 5: Verify build + lint**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint`
Expected: compiles, lint clean.

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/(app)/insights"
git commit -m "feat(web): insights — notable-move + top-performers cards, data-table fallback, loading/empty states" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Landing teaser

A one-line auto-generated "insight of the moment" on the landing, linking to `/insights`. Doubles as Community-Voting shareable copy. (Spec §4.4.)

**Files:**
- Create: `frontend/src/components/landing/InsightTeaser.tsx`
- Modify: `frontend/src/app/page.tsx` (add a `StoryFrame`)

- [ ] **Step 1: Create `InsightTeaser.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useLeaderboard, useFeedHistory, useSmartMoneyBands } from "@/lib/hooks";
import { smartMoneyDivergence, notableMove, topFinding } from "@/lib/insights";
import { FRIENDLY_CATEGORY } from "@/lib/labels";

export function InsightTeaser() {
  const category = "METH_APR_24H" as const;
  const feed = useFeedHistory(category);
  const bands = useSmartMoneyBands(category);
  useLeaderboard(category); // warms the same query cache used on /insights

  const crowd = feed.data[feed.data.length - 1]?.value ?? null;
  const div = smartMoneyDivergence(bands.data, crowd);
  const move = notableMove(feed.data, 16, 1);
  const headline = topFinding(div, move, FRIENDLY_CATEGORY[category]);

  return (
    <section className="flex min-h-screen flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        <Sparkles size={12} className="text-[var(--color-accent)]" aria-hidden />
        insight of the moment
      </div>
      <p className="max-w-3xl text-[clamp(22px,3.4vw,38px)] font-medium leading-snug tracking-tight text-[var(--color-text)]">
        {headline}
      </p>
      <Link
        href="/insights"
        className="mt-8 inline-flex items-center gap-2 rounded border border-[var(--color-accent)]/40 bg-[color:var(--color-accent)]/8 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[color:var(--color-accent)]/15"
      >
        See all AI insights <ArrowUpRight size={14} aria-hidden />
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Mount it in the landing FlowArt**

In `frontend/src/app/page.tsx`, add the import and insert a `StoryFrame` after the `LeaderboardPreview` frame:
```tsx
import { InsightTeaser } from "@/components/landing/InsightTeaser";
```
```tsx
        <StoryFrame label="Leaderboard preview">
          <LeaderboardPreview />
        </StoryFrame>
        <StoryFrame label="Insight of the moment">
          <InsightTeaser />
        </StoryFrame>
```

- [ ] **Step 3: Verify build + lint**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint`
Expected: compiles, lint clean. (Hooks work on landing because `Providers` is mounted in the root `app/layout.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/InsightTeaser.tsx frontend/src/app/page.tsx
git commit -m "feat(web): landing insight-of-the-moment teaser → /insights" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Reasoner self-narration (agents) — TDD

Extend the reasoner's existing OpenRouter→DeepSeek output contract to also return a Web2 `summary` + `confidence_rationale`. Parse defensively (optional for back-compat). (Spec §5.1.)

**Files:**
- Modify: `agents/claude-reasoner/src/forecast.ts`
- Modify: `agents/claude-reasoner/src/prompt.ts`
- Modify: `agents/claude-reasoner/fewshot/*.json` (6 files — add the two fields)
- Test: `agents/claude-reasoner/src/forecast.test.ts` (new) — run with vitest via the workspace

> The agents workspace typechecks with `tsc`. For this test, run vitest through `npx` so we don't restructure the agent's build. If the agent package lacks vitest, install it as a dev dep there.

- [ ] **Step 1: Install vitest in the reasoner package**

Run: `pnpm --filter @predictor-index/claude-reasoner add -D vitest@^2`
(If the package name differs, use the `name` from `agents/claude-reasoner/package.json`.)

- [ ] **Step 2: Write the failing test**

Create `agents/claude-reasoner/src/forecast.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseForecastText } from "./forecast.js";

describe("parseForecastText", () => {
  it("parses summary + confidence_rationale when present", () => {
    const txt = JSON.stringify({
      predicted_value: { lower: 3700, upper: 3900 },
      confidence: 6000,
      reasoning: "calm market",
      summary: "I expect mETH yield around 37–39% — calm market.",
      confidence_rationale: "Tight band because recent days were stable.",
    });
    const p = parseForecastText(txt);
    expect(p.predicted_value.lower).toBe(3700);
    expect(p.summary).toContain("mETH");
    expect(p.confidence_rationale).toContain("stable");
  });
  it("tolerates absence of the new fields (back-compat)", () => {
    const txt = JSON.stringify({
      predicted_value: { lower: 1, upper: 2 },
      confidence: 5000,
      reasoning: "x",
    });
    const p = parseForecastText(txt);
    expect(p.summary).toBeUndefined();
    expect(p.confidence_rationale).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd agents/claude-reasoner && npx vitest run src/forecast.test.ts`
Expected: FAIL — `parseForecastText` not exported.

- [ ] **Step 4: Refactor `forecast.ts` to expose a pure parser + add the fields**

In `agents/claude-reasoner/src/forecast.ts`, extend the interface and extract a pure `parseForecastText`:
```ts
export interface ParsedForecast {
  predicted_value: { lower: number; upper: number };
  confidence: number;
  reasoning: string;
  summary?: string;             // ≤140 char plain-English, Web2 reader
  confidence_rationale?: string; // one sentence on band width
}
```
Replace `validate` usage so a pure exported function parses raw text:
```ts
export function parseForecastText(rawText: string): ParsedForecast {
  return validate(JSON.parse(extractJson(rawText)));
}
```
And extend `validate` to read the optional fields (after the existing checks, before `return`):
```ts
  const summary =
    typeof o.summary === "string" && o.summary.trim().length > 0
      ? o.summary.trim().slice(0, 200)
      : undefined;
  const confidence_rationale =
    typeof o.confidence_rationale === "string" && o.confidence_rationale.trim().length > 0
      ? o.confidence_rationale.trim()
      : undefined;
  return {
    predicted_value: { lower: pv.lower, upper: pv.upper },
    confidence: Math.round(o.confidence),
    reasoning: o.reasoning,
    summary,
    confidence_rationale,
  };
```
In `getForecast`, replace the final parse line with the new helper:
```ts
  const parsed = parseForecastText(rawText);
  return { parsed, rawText };
```

- [ ] **Step 5: Update the output contract + system prompt in `prompt.ts`**

In `SYSTEM_PROMPT`, append a sentence:
```
" Also include a one-line plain-English summary a non-crypto reader can understand (no jargon like bps, CRPS, or 'composite feed')."
```
In `buildUserPrompt`, extend the output-contract JSON shape to:
```ts
      "{\n" +
      '  "predicted_value": { "lower": <integer in domain units>, "upper": <integer in domain units> },\n' +
      '  "confidence": <integer 0-10000 basis points, your honest probability the outcome lands in the band>,\n' +
      '  "reasoning": "<concise technical justification>",\n' +
      '  "summary": "<one sentence, plain English for someone new to crypto: what you expect and why. No jargon (no bps, CRPS, composite feed). Use % or $ in plain terms>",\n' +
      '  "confidence_rationale": "<one sentence on why your range is wide or narrow>"\n' +
      "}\n" +
```

- [ ] **Step 6: Add the two fields to the few-shot examples**

For each of the 6 files in `agents/claude-reasoner/fewshot/*.json`, add `summary` and `confidence_rationale` keys (read each file, keep the existing fields). Example values (adapt numbers to each file's existing forecast):
```json
  "summary": "I expect mETH staking yield to stay around 30%, since the last few days have been calm.",
  "confidence_rationale": "I kept the range moderate because day-to-day swings have been small but not zero."
```
Note: `FewShotExample` in `prompt.ts` does not need these fields typed (they're only rendered in the example response JSON). If `buildUserPrompt` serializes a fixed shape (it does — it only picks `predicted_value`/`confidence`/`reasoning`), also include `summary`/`confidence_rationale` in that serialized object so the model sees them:
```ts
      const response = JSON.stringify(
        {
          predicted_value: ex.predicted_value,
          confidence: ex.confidence,
          reasoning: ex.reasoning,
          summary: (ex as { summary?: string }).summary,
          confidence_rationale: (ex as { confidence_rationale?: string }).confidence_rationale,
        },
        null,
        2,
      );
```

- [ ] **Step 7: Run the test + typecheck**

Run: `cd agents/claude-reasoner && npx vitest run src/forecast.test.ts && pnpm exec tsc --noEmit`
Expected: test PASS; tsc clean.

- [ ] **Step 8: Commit**

```bash
git add agents/claude-reasoner
git commit -m "feat(agent): reasoner emits Web2 summary + confidence_rationale (same DeepSeek call)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: `/api/narrate` route — cached server narration (TDD)

A Next.js route handler that narrates any agent's forecast in plain English via OpenRouter→DeepSeek, cached by predictionId, server-only key. (Spec §5.2.)

**Files:**
- Create: `frontend/src/lib/narrate.ts` (pure: prompt builder + cache map + a `narrateWith` fn that takes an injected fetcher — testable)
- Create: `frontend/src/app/api/narrate/route.ts` (thin handler)
- Test: `frontend/src/lib/narrate.test.ts`
- Modify: `frontend/.env.example` (document `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`)

> Read `frontend/node_modules/next/dist/docs/` for the current route-handler API before writing `route.ts`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/narrate.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { buildNarrationPrompt, narrateWith, type NarrateInput, _clearCache } from "@/lib/narrate";

const input: NarrateInput = {
  predictionId: 1001,
  agentKind: "ARIMA",
  category: "METH_APR_24H",
  low: 3700,
  high: 3900,
  confidence: 6000,
  accuracyScore: 380_000,
};

describe("narrate", () => {
  it("prompt is jargon-banning and includes the band", () => {
    const p = buildNarrationPrompt(input);
    expect(p).toContain("plain English");
    expect(p.toLowerCase()).toContain("no jargon");
  });

  it("calls the model once then serves cache for the same predictionId", async () => {
    _clearCache();
    const fetcher = vi.fn().mockResolvedValue("mETH yield should sit near 38%, fairly steady.");
    const a = await narrateWith(input, fetcher);
    const b = await narrateWith(input, fetcher);
    expect(a).toBe(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns a graceful fallback when the model call throws", async () => {
    _clearCache();
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const out = await narrateWith({ ...input, predictionId: 2002 }, fetcher);
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toContain("forecast");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter frontend test`
Expected: FAIL — cannot resolve `@/lib/narrate`.

- [ ] **Step 3: Implement `lib/narrate.ts`**

```ts
import { FRIENDLY_CATEGORY, friendlyValue } from "@/lib/labels";
import type { CategoryId } from "@/lib/mockData";

export interface NarrateInput {
  predictionId: number;
  agentKind: "ARIMA" | "CLAUDE" | "QUANT" | "ENSEMBLE";
  category: CategoryId;
  low: number;
  high: number;
  confidence: number; // bps
  accuracyScore: number; // -1e6..1e6
}

const cache = new Map<number, string>();

/** Test-only cache reset. */
export function _clearCache(): void {
  cache.clear();
}

/** Build the plain-English narration prompt for a single forecast. */
export function buildNarrationPrompt(i: NarrateInput): string {
  const friendly = FRIENDLY_CATEGORY[i.category];
  return [
    `An AI forecaster (${i.agentKind}) predicts ${friendly} will be between ` +
      `${friendlyValue(i.category, i.low)} and ${friendlyValue(i.category, i.high)} next day, ` +
      `with ${(i.confidence / 100).toFixed(0)}% confidence.`,
    `Explain this forecast to someone new to crypto in 1–2 short sentences, in plain English.`,
    `No jargon (do not say bps, CRPS, composite feed, calibration). Use % or $ naturally.`,
    `Reply with the explanation only.`,
  ].join(" ");
}

/** Deterministic fallback if the model is unavailable. */
export function fallbackNarration(i: NarrateInput): string {
  const friendly = FRIENDLY_CATEGORY[i.category];
  return `This AI's forecast expects ${friendly} between ${friendlyValue(i.category, i.low)} and ${friendlyValue(i.category, i.high)} next day.`;
}

/** Narrate with an injected model fetcher (prompt → text). Caches by predictionId; never throws. */
export async function narrateWith(
  i: NarrateInput,
  fetcher: (prompt: string) => Promise<string>,
): Promise<string> {
  const hit = cache.get(i.predictionId);
  if (hit) return hit;
  let out: string;
  try {
    out = (await fetcher(buildNarrationPrompt(i))).trim() || fallbackNarration(i);
  } catch {
    out = fallbackNarration(i);
  }
  cache.set(i.predictionId, out);
  return out;
}

/** Real OpenRouter→DeepSeek fetcher (server-side only). */
export function openRouterFetcher(): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    const model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Noetrix Insights",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.5,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter frontend test`
Expected: PASS (narrate suite green).

- [ ] **Step 5: Implement the route handler**

Create `frontend/src/app/api/narrate/route.ts`:
```ts
import { NextResponse } from "next/server";
import { narrateWith, openRouterFetcher, fallbackNarration, type NarrateInput } from "@/lib/narrate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<NarrateInput>;
  try {
    body = (await req.json()) as Partial<NarrateInput>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (
    typeof body.predictionId !== "number" ||
    typeof body.low !== "number" ||
    typeof body.high !== "number" ||
    !body.category ||
    !body.agentKind
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const input = body as NarrateInput;
  // If no key configured, return the deterministic fallback (still useful, no 500).
  const summary = process.env.OPENROUTER_API_KEY
    ? await narrateWith(input, openRouterFetcher())
    : fallbackNarration(input);
  return NextResponse.json({ summary });
}
```

- [ ] **Step 6: Document env**

Add to `frontend/.env.example`:
```
# Server-only (NOT NEXT_PUBLIC) — used by /api/narrate for plain-English forecast summaries.
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-chat-v3.1
```

- [ ] **Step 7: Verify build + lint + test**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint && pnpm --filter frontend test`
Expected: all green; route `/api/narrate` appears in the build output.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/narrate.ts frontend/src/lib/narrate.test.ts "frontend/src/app/api/narrate/route.ts" frontend/.env.example
git commit -m "feat(web): /api/narrate — cached server-side plain-English forecast narration" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Render friendly narration on `/agent/[id]`

Surface the plain-English summary above the dense trace (progressive disclosure), and narrate ARIMA (non-reasoning) rows via `/api/narrate`. (Spec §5.3.)

**Files:**
- Modify: `frontend/src/lib/mockData.ts` (add optional `summary`/`confidenceRationale` to `ReasoningTrace` + populate in `baseReasoning`)
- Create: `frontend/src/components/app/ForecastSummary.tsx` (client component: prefers a passed summary, else fetches `/api/narrate`)
- Modify: `frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx` (render `ForecastSummary` in `FeaturedReasoning` + each prediction row)

- [ ] **Step 1: Extend the mock `ReasoningTrace` + populate a Web2 summary**

In `mockData.ts`, extend the type:
```ts
export type ReasoningTrace = {
  steps: { kind: "frame" | "search" | "infer" | "forecast"; text: string }[];
  citations: { label: string; href: string }[];
  rawJSON: string;
  summary?: string;
  confidenceRationale?: string;
};
```
In `baseReasoning`, add to the returned object:
```ts
  summary: `In plain terms: this AI expects ${label} near ${value}, and is about ${(conf / 100).toFixed(0)}% sure it lands in its range.`,
  confidenceRationale: `The range reflects normal day-to-day movement — not too tight, not too wide.`,
```

- [ ] **Step 2: Create `ForecastSummary.tsx`**

```tsx
"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";

type Props = {
  /** Pre-baked summary (from reasoner field / mock). If absent, fetches /api/narrate. */
  summary?: string;
  confidenceRationale?: string;
  // narrate inputs (used only when summary is absent)
  predictionId: number;
  agentKind: "ARIMA" | "CLAUDE" | "QUANT" | "ENSEMBLE";
  category: string;
  low: number;
  high: number;
  confidence: number;
  accuracyScore: number;
};

export function ForecastSummary(p: Props) {
  const [fetched, setFetched] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const text = p.summary ?? fetched;

  React.useEffect(() => {
    if (p.summary || fetched || loading) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        predictionId: p.predictionId,
        agentKind: p.agentKind,
        category: p.category,
        low: p.low,
        high: p.high,
        confidence: p.confidence,
        accuracyScore: p.accuracyScore,
      }),
    })
      .then((r) => r.json())
      .then((j) => !cancelled && setFetched(typeof j.summary === "string" ? j.summary : null))
      .catch(() => !cancelled && setFetched(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [p, fetched, loading]);

  return (
    <div
      className="rounded-md border border-[var(--color-accent)]/25 bg-[color:var(--color-accent)]/6 px-4 py-3"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
        <MessageSquareText size={12} aria-hidden />
        In plain English
      </div>
      {loading && !text ? (
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[var(--color-bg-elev-2)]" />
      ) : (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">
          {text ?? "Summary unavailable."}
        </p>
      )}
      {p.confidenceRationale ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-dim)]">{p.confidenceRationale}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Render it in `FeaturedReasoning` (above the trace timeline)**

In `AgentDetailClient.tsx`, inside `FeaturedReasoning`, add the import at the top of the file:
```tsx
import { ForecastSummary } from "@/components/app/ForecastSummary";
```
Then in the `FeaturedReasoning` body, just before the `<ol ...>` trace list (inside the left `<div>`), add:
```tsx
          <div className="mb-5">
            <ForecastSummary
              summary={r.summary}
              confidenceRationale={r.confidenceRationale}
              predictionId={prediction.id}
              agentKind="CLAUDE"
              category={prediction.categoryId}
              low={prediction.value.low}
              high={prediction.value.high}
              confidence={prediction.confidence}
              accuracyScore={0}
            />
          </div>
```

- [ ] **Step 4: Render a summary for every row in `PredictionsTable` (incl. ARIMA)**

In `PredictionsTable`, the expandable section currently only renders when `p.reasoning`. Add a summary line for ALL rows by inserting, inside the `<li>` after the toggle `<button>` block and before the existing `{isOpen && p.reasoning ...}`, a compact summary that uses the baked summary if present else fetches narrate:
```tsx
              {isOpen ? (
                <div className="bg-[var(--color-bg)] px-5 pt-4">
                  <ForecastSummary
                    summary={p.reasoning?.summary}
                    confidenceRationale={p.reasoning?.confidenceRationale}
                    predictionId={p.id}
                    agentKind={agent.kind}
                    category={p.categoryId}
                    low={p.value.low}
                    high={p.value.high}
                    confidence={p.confidence}
                    accuracyScore={agent.reputation[p.categoryId].accuracyScore}
                  />
                </div>
              ) : null}
```
Then make the row expandable even without a reasoning trace: change `disabled={!hasReasoning}` to `disabled={false}` and `onClick={() => hasReasoning && toggle(p.id)}` to `onClick={() => toggle(p.id)}`, and update the chevron color logic so non-reasoning rows still show an enabled chevron. (Keep the dense `ReasoningTrace` block gated on `p.reasoning` as before — ARIMA rows show only the friendly summary.)

- [ ] **Step 5: Verify build + lint + test**

Run: `pnpm --filter frontend build && pnpm --filter frontend lint && pnpm --filter frontend test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/mockData.ts frontend/src/components/app/ForecastSummary.tsx "frontend/src/app/(app)/agent/[id]/AgentDetailClient.tsx"
git commit -m "feat(web): plain-English forecast summary on agent page (reasoner field + /api/narrate for ARIMA)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Playwright smoke — tour + 375px verification (spec §3.2)

Add runtime verification for the spotlight tour and capture 375px screenshots (incl. `/insights`).

**Files:**
- Modify: `frontend/package.json` (scripts)
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/tour.spec.ts`
- Create: `frontend/e2e/responsive.spec.ts`

> Browser download can be heavy/blocked in some environments. Attempt the automated path first; if `npx playwright install` fails, document the manual checklist (Step 7) as the fallback and skip Steps 5–6.

- [ ] **Step 1: Install Playwright**

Run: `pnpm --filter frontend add -D @playwright/test@^1` then `cd frontend && npx playwright install chromium`
Expected: chromium installed.

- [ ] **Step 2: Add scripts**

In `frontend/package.json` scripts:
```json
    "test:e2e": "playwright test"
```

- [ ] **Step 3: Playwright config (auto-starts dev server)**

Create `frontend/playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 4: Tour smoke spec**

Create `frontend/e2e/tour.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("first-visit tour auto-starts on /leaderboard and advances", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/leaderboard");
  // Spotlight callout should appear (data-tour anchors exist: category-tabs, feed-value, ...).
  const callout = page.getByRole("dialog").or(page.locator("[data-tour-callout]")).first();
  // Fallback: assert at least one data-tour anchor is present.
  await expect(page.locator("[data-tour]").first()).toBeVisible();
  // Advance with keyboard; tour should not throw.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/leaderboard/);
});

test("Guide button replays the tour", async ({ page }) => {
  await page.goto("/leaderboard");
  const guide = page.getByRole("button", { name: /guide/i });
  if (await guide.count()) {
    await guide.first().click();
    await expect(page.locator("[data-tour]").first()).toBeVisible();
  }
});
```
(Adjust the callout selector after reading `frontend/src/components/tour/Spotlight.tsx` — use whatever role/test-id it renders. If none, the `[data-tour]` assertions still verify the anchors render.)

- [ ] **Step 5: 375px screenshot spec**

Create `frontend/e2e/responsive.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

const pages = ["/leaderboard", "/insights", "/agent/1"];

for (const path of pages) {
  test(`375px renders without horizontal overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2); // allow rounding
    await page.screenshot({ path: `e2e/__screenshots__${path.replace(/\//g, "_")}_375.png`, fullPage: true });
  });
}
```

- [ ] **Step 6: Run the e2e smoke**

Run: `cd frontend && npx playwright test`
Expected: tour specs pass; responsive specs pass (no horizontal overflow) and write screenshots under `frontend/e2e/__screenshots__/`. Review the screenshots for obvious layout breakage.

- [ ] **Step 7: (Fallback if browsers can't install) document a manual checklist**

If Step 1's browser install fails, create `frontend/e2e/MANUAL_CHECKLIST.md` listing: run `pnpm dev`; clear localStorage; load `/leaderboard` → tour auto-starts; `→`/`←`/`Esc`/`Enter` work; Guide button replays; reduced-motion jumps without animation; check `/leaderboard`, `/insights`, `/agent/1` at 375px for overflow. Mark the automated path as blocked in the commit message.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/playwright.config.ts frontend/e2e frontend/pnpm-lock.yaml
git commit -m "test(web): Playwright smoke — spotlight tour + 375px overflow/screenshots" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Final verification gate + CLAUDE.md session entry

- [ ] **Step 1: Full verification sweep**

Run each and confirm green:
```bash
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
cd agents/claude-reasoner && npx vitest run && pnpm exec tsc --noEmit
```
Expected: lint clean (0 errors, 0 warnings); vitest suites pass (labels, insights, narrate, reasoner forecast); `next build` green with all routes incl. `/insights` and `/api/narrate`; reasoner tsc clean.

- [ ] **Step 2: (If Playwright installed) run e2e + eyeball screenshots**

Run: `cd frontend && npx playwright test`
Confirm tour + 375px specs pass; open the screenshots and sanity-check `/insights`, `/leaderboard`, `/agent/1`.

- [ ] **Step 3: Append a CLAUDE.md session entry**

Add a dated `### 2026-06-01 — Alpha & Data repositioning: /insights + Web2 narration` entry to `CLAUDE.md` §6 documenting: the strategy pivot (Alpha & Data primary), the new `/insights` page + findings, the smart-money centerpiece, the reasoner summary fields + `/api/narrate` route, the lint/tour debt cleared, vitest + Playwright added, and the honest caveats (demo-shaped numbers until live indexer; "top performers" used instead of momentum-based "rising agents"; Playwright browser-install dependency; narrate cache is in-memory per server instance).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: session — Alpha & Data /insights + Web2 narration; verification gate" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Offer to finish the branch**

Per the user's policy (commit local, master is ahead of origin), surface options: fast-forward merge `alpha-data-insights-narration` → `master` locally, or open a PR. Do not merge without the user's choice. (The deployment/verification/video work remains a deferred, separate conversation.)

---

## Self-Review (completed by author)

- **Spec coverage:** §3.1 lint → Task 1. §3.2 tour/375px → Task 13. §4.2 architecture (pure fns + existing hooks) → Tasks 4–5. §4.3 findings: smart-money → Task 7; consensus+uncertainty → Task 7; notable move → Task 8; top performers (reframed from "rising") → Task 8; uncertainty badge → Task 7. §4.4 teaser → Task 9. §4.5 Web2-legibility (labels, intro, friendly copy) → Tasks 3,6,7,8. §4.6 a11y (data-table fallback, skeleton, empty, aria-live, source pill) → Tasks 6,8,12. §5.1 reasoner self-narration → Task 10. §5.2 /api/narrate (server key, cache) → Task 11. §5.3 render + fallback chain → Task 12. §6 jargon table → Task 3 (`lib/labels.ts`, reusing `RWA_LABELS` names). §9 verification → Task 14.
- **Placeholder scan:** the only intentional temporary is `FindingsContext` in Task 6, explicitly removed in Task 7 Step 3. No TBDs.
- **Type consistency:** `AgentBand`, `SmartMoneyDivergence`, `NarrateInput`, `ParsedForecast.summary?`, `ReasoningTrace.summary?` are defined once and reused consistently across tasks. `useSmartMoneyBands` returns `QueryView<AgentBand[]>` matching the existing `QueryView<T>` shape. Card props match the pure-fn signatures (`bands`, `crowdValue`, `history`, `rows`).
- **Known risks documented:** smart-money live path depends on `categoryHash` + per-agent prediction category matching (Task 5 reads `lib/contracts.ts` to confirm); narrate cache is per-instance in-memory (acceptable for demo, noted); Playwright browser install may be blocked (fallback checklist in Task 13 Step 7).
