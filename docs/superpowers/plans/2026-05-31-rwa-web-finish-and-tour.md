# RWA Web Finish + Terminal Spotlight Tour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the AI x RWA pivot on the website (USDY category across the terminal + landing reframe + a terminal RWA Strategy panel) and add a first-run spotlight onboarding tour on the leaderboard.

**Architecture:** Pure frontend changes in `frontend/`. USDY flows from one `CATEGORIES` entry in `mockData.ts` through existing category-mapped surfaces. A new terminal-core `RwaStrategyPanel` reads `YieldAllocator`/`RiskManager` (mock fallback). A dependency-free tour (`TourProvider` + `Spotlight` + step registry) mounted in the `(app)` layout uses the CSS box-shadow cutout technique for the "dark scrim + highlighted feature" effect.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, Motion v12 (`motion/react`), wagmi/viem, lucide-react. No test runner exists in `frontend/` — **verification is `pnpm --filter frontend build` (typecheck + compile) + `pnpm --filter frontend lint` + a manual browser check via `pnpm --filter frontend dev`.** Do NOT add jest/vitest; follow the repo's build-as-gate pattern.

**Conventions:**
- All commands run from the repo root `D:\Hackathon\mantle-hackathon`.
- Build/lint commands: `pnpm --filter frontend build`, `pnpm --filter frontend lint`.
- Commit after each task. Branch is already `rwa-web-tour`.
- `Panel` only forwards `children`/`className`/`elevation` — never put `data-tour` on a `Panel`; wrap it in a plain `<div data-tour="…">`.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `frontend/src/lib/mockData.ts` | Add `USDY_APY_24H` category + per-agent reputation + generator branches | Modify |
| `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx` | Tab caption by unit, mount RWA panel, add `data-tour` anchors | Modify |
| `frontend/src/components/app/RwaStrategyPanel.tsx` | Terminal-core yield+risk panel (live + mock fallback) | Create |
| `frontend/src/components/landing/Hero.tsx` | RWA-framed subtitle | Modify |
| `frontend/src/components/landing/CategoriesShowcase.tsx` | Third (USDY) card + RWA header + 3-col grid | Modify |
| `frontend/src/components/landing/HowItWorks.tsx` | One RWA-framed step | Modify |
| `frontend/src/components/landing/FaqAccordion.tsx` | One RWA-framed answer | Modify |
| `frontend/src/components/tour/steps.ts` | `TourStep` type + `LEADERBOARD_STEPS` registry | Create |
| `frontend/src/components/tour/TourProvider.tsx` | Tour state machine + context + first-run/replay | Create |
| `frontend/src/components/tour/Spotlight.tsx` | Box-shadow cutout overlay + callout + a11y | Create |
| `frontend/src/app/(app)/layout.tsx` | Mount `TourProvider` around terminal chrome | Modify |
| `frontend/src/components/app/AppHeader.tsx` | "Guide" replay button | Modify |

---

## Task 1: Add the USDY category to mock data

**Files:**
- Modify: `frontend/src/lib/mockData.ts`

- [ ] **Step 1: Extend the `CategoryId` union and add the USDY `CATEGORIES` entry**

In `frontend/src/lib/mockData.ts`, change the type (line ~3):

```ts
export type CategoryId = "METH_APR_24H" | "USDY_APY_24H" | "AAVE_MANTLE_TVL_24H";
```

Then add a third entry to `CATEGORIES`, inserted **between** `METH_APR_24H` and `AAVE_MANTLE_TVL_24H`:

```ts
  USDY_APY_24H: {
    id: "USDY_APY_24H",
    slug: "usdy-apy-24h",
    label: "USDY 24h APY",
    unit: "bps",
    minStake: 0.05,
    windowBlocks: { start: 300, end: 50_000 },
    description:
      "24-hour trailing USDY (Ondo tokenized US Treasuries) price-per-share APY, in basis points. Resolves via the UsdyApyResolver against the USDY rate oracle (43,200-block lookback ≈ 1 day on Mantle). v1 uses a seeded oracle; v2 reads the live Ondo USDY contract.",
    current: 500,
    unitFormatter: (n) => `${(n / 100).toFixed(2)}%`,
  },
```

- [ ] **Step 2: Add a `USDY_APY_24H` reputation block to all 8 agents**

For each agent in `AGENTS`, add a `USDY_APY_24H` key inside its `reputation` object (alongside the existing `METH_APR_24H` / `AAVE_MANTLE_TVL_24H`). Use these exact values per agent `id`:

```ts
// id 1 — claude-reasoner-α
      USDY_APY_24H: {
        accuracyScore: 540_000, calibrationScore: -78_000, resolvedCount: 61, lastUpdatedBlock: 12_488_050,
        bucketAccuracy: E([0.50, 0.56, 0.60, 0.64, 0.68, 0.72, 0.77, 0.82, 0.87, 0.92]),
        bucketCount: E([2, 3, 4, 6, 8, 9, 9, 8, 7, 5]),
      },
// id 2 — arima-baseline
      USDY_APY_24H: {
        accuracyScore: 402_000, calibrationScore: -120_000, resolvedCount: 58, lastUpdatedBlock: 12_487_900,
        bucketAccuracy: E([0.49, 0.52, 0.55, 0.58, 0.61, 0.64, 0.66, 0.69, 0.71, 0.73]),
        bucketCount: E([3, 4, 5, 7, 8, 8, 8, 6, 5, 4]),
      },
// id 3 — quant-grad-momentum
      USDY_APY_24H: {
        accuracyScore: 351_000, calibrationScore: -210_000, resolvedCount: 44, lastUpdatedBlock: 12_487_300,
        bucketAccuracy: E([0.43, 0.47, 0.51, 0.55, 0.60, 0.65, 0.69, 0.73, 0.77, 0.80]),
        bucketCount: E([4, 5, 5, 5, 5, 5, 4, 4, 3, 4]),
      },
// id 4 — claude-reasoner-β
      USDY_APY_24H: {
        accuracyScore: 388_000, calibrationScore: -38_000, resolvedCount: 63, lastUpdatedBlock: 12_488_020,
        bucketAccuracy: E([0.50, 0.54, 0.57, 0.60, 0.63, 0.66, 0.69, 0.71, 0.74, 0.76]),
        bucketCount: E([7, 9, 9, 8, 8, 7, 6, 5, 3, 2]),
      },
// id 5 — ensemble-mean
      USDY_APY_24H: {
        accuracyScore: 471_000, calibrationScore: -102_000, resolvedCount: 52, lastUpdatedBlock: 12_487_850,
        bucketAccuracy: E([0.50, 0.54, 0.58, 0.62, 0.65, 0.69, 0.71, 0.73, 0.75, 0.77]),
        bucketCount: E([4, 5, 6, 7, 7, 7, 6, 5, 3, 2]),
      },
// id 6 — claude-reasoner-γ
      USDY_APY_24H: {
        accuracyScore: 176_000, calibrationScore: -360_000, resolvedCount: 33, lastUpdatedBlock: 12_487_100,
        bucketAccuracy: E([0.30, 0.34, 0.39, 0.44, 0.50, 0.56, 0.63, 0.71, 0.80, 0.87]),
        bucketCount: E([2, 2, 3, 3, 4, 4, 5, 4, 3, 3]),
      },
// id 7 — naive-persistence
      USDY_APY_24H: {
        accuracyScore: 158_000, calibrationScore: -176_000, resolvedCount: 60, lastUpdatedBlock: 12_487_950,
        bucketAccuracy: E([0.44, 0.47, 0.50, 0.52, 0.55, 0.57, 0.59, 0.60, 0.61, 0.62]),
        bucketCount: E([5, 6, 7, 8, 8, 7, 6, 5, 3, 2]),
      },
// id 8 — claude-haiku-fast
      USDY_APY_24H: {
        accuracyScore: 243_000, calibrationScore: -142_000, resolvedCount: 110, lastUpdatedBlock: 12_488_090,
        bucketAccuracy: E([0.47, 0.50, 0.53, 0.56, 0.59, 0.62, 0.64, 0.66, 0.68, 0.70]),
        bucketCount: E([9, 12, 14, 15, 14, 13, 11, 9, 7, 5]),
      },
```

- [ ] **Step 3: Add USDY branches to the two generators**

In `makeFeedHistory`, replace the `drift`/`noise` lines:

```ts
  const drift = cat.unit === "usd" ? 280_000 : cat.id === "USDY_APY_24H" ? 6 : 8;
  const noise = cat.unit === "usd" ? 480_000 : cat.id === "USDY_APY_24H" ? 18 : 24;
```

In the `PREDICTIONS` IIFE, replace the resolved-row `pointBase`/`halfWidth`:

```ts
        const pointBase =
          cat.id === "METH_APR_24H"
            ? 3800 + (seed - 50) * 4
            : cat.id === "USDY_APY_24H"
              ? 500 + (seed - 50)
              : 142_000_000 + (seed - 50) * 250_000;
        const halfWidth =
          cat.id === "METH_APR_24H"
            ? 90 + (seed % 30)
            : cat.id === "USDY_APY_24H"
              ? 20 + (seed % 15)
              : 1_400_000 + (seed % 31) * 50_000;
```

And replace the pending-`Revealed` block's `pointBase`/`halfWidth`:

```ts
      const pointBase =
        cat.id === "METH_APR_24H" ? 3800 : cat.id === "USDY_APY_24H" ? 500 : 142_500_000;
      const halfWidth =
        cat.id === "METH_APR_24H" ? 110 : cat.id === "USDY_APY_24H" ? 25 : 1_700_000;
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter frontend build`
Expected: build succeeds, no TypeScript errors. (TS will fail the build if any `Record<CategoryId, …>` is missing the new `USDY_APY_24H` key — this is the safety net that confirms Step 2 is complete for every agent and for `CATEGORIES`.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/mockData.ts
git commit -m "feat(web): add USDY_APY_24H category to mock data"
```

---

## Task 2: Surface USDY on the leaderboard (tab caption by unit)

**Files:**
- Modify: `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx`

- [ ] **Step 1: Drive the tab caption off `cat.unit` instead of a hardcoded id check**

Find the `tabs` definition (~line 131):

```ts
  const tabs = Object.values(CATEGORIES).map((c) => ({
    id: c.id,
    label: c.label,
    caption: `min stake ${c.minStake} MNT · ${c.id === "METH_APR_24H" ? "bps" : "USD"}`,
  }));
```

Replace the `caption` line with:

```ts
    caption: `min stake ${c.minStake} MNT · ${c.unit === "usd" ? "USD" : "bps"}`,
```

- [ ] **Step 2: Verify build + behavior**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

Run: `pnpm --filter frontend dev`, open `http://localhost:3000/leaderboard`. Expected: **three** category tabs — `mETH 24h trailing APR`, `USDY 24h APY`, `Aave-on-Mantle 24h TVL`. The USDY tab caption reads `… · bps` (not `USD`). Switching to USDY renders the composite value (~5%), sparkline, KPIs, and the agent table.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx
git commit -m "feat(web): USDY tab caption + leaderboard surfaces three categories"
```

---

## Task 3: Reframe the landing hero to AI x RWA

**Files:**
- Modify: `frontend/src/components/landing/Hero.tsx`

- [ ] **Step 1: Rewrite the subtitle paragraph**

Find the subtitle `<motion.p>` (~line 270) whose text begins "On-chain AI agent forecasting protocol on Mantle." Replace its inner text with:

```tsx
          AI agents forecast and risk-manage yield across Mantle&apos;s real-world assets — mETH
          and USDY. Soulbound identities, commit-reveal predictions, CRPS-scored into a
          rank-weighted consensus feed that powers dynamic yield strategy and automated risk
          controls.
```

- [ ] **Step 2: Update the corner-meta to name an RWA asset (cosmetic)**

Find the left corner-meta block (~line 316) with the lines `chain · mantle` / `scorer · range-crps` / `spec · v2.2`. Replace its three `<span>` children with:

```tsx
        <span>track · ai x rwa</span>
        <span>assets · meth + usdy</span>
        <span>scorer · range-crps</span>
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

Run (if dev server up): open `http://localhost:3000` — hero subtitle now leads with "AI agents forecast and risk-manage yield across Mantle's real-world assets — mETH and USDY."

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/Hero.tsx
git commit -m "feat(web): reframe landing hero to AI x RWA (mETH + USDY yield/risk)"
```

---

## Task 4: Add the USDY card to the landing categories showcase

**Files:**
- Modify: `frontend/src/components/landing/CategoriesShowcase.tsx`

- [ ] **Step 1: Add a third `CategoryCard` for USDY**

In the `CATEGORIES` array, insert this object **between** the `meth-apr-24h` and `aave-mantle-tvl-24h` entries:

```ts
  {
    id: "usdy-apy-24h",
    href: "/feed/usdy-apy-24h",
    slug: "USDY_APY_24H",
    title: "USDY treasury yield",
    subtitle: "Rolling 24-hour APY on Ondo USDY (tokenized US Treasuries)",
    domain: "[0%, 20%] APY",
    cadence: "Resolves every ~24h · 43,200 blocks",
    formula: "apyBps = ((rateNow / ratePrior − 1) × 365 × 10000)",
    unit: "bps",
    sample: {
      actual: 5.02,
      bandLo: 4.7,
      bandHi: 5.3,
      label: "deepseek-reasoner-α · 24h forecast",
    },
    series: [4.6, 4.7, 4.78, 4.83, 4.88, 4.91, 4.94, 4.97, 4.99, 5.0, 5.01, 5.02],
    agents: 2,
  },
```

- [ ] **Step 2: Make the grid hold three cards and reframe the header**

Change the grid wrapper (~line 167):

```tsx
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
```

Change the eyebrow + heading text in the `<header>` (~lines 154-159) to:

```tsx
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
          AI x RWA · three markets shipped
        </div>
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
          Real-world yield, priced by the most calibrated agents.
        </h2>
```

And the supporting `<p>` immediately below it:

```tsx
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-text-dim)]">
          Each RWA market bundles its own resolver, scorer and domain config. Agents commit a
          uniform range over the configured bucket grid; CRPS-distance to the realized on-chain
          outcome decides who gets paid — and whose forecast steers the yield strategy.
        </p>
```

- [ ] **Step 3: Verify build + responsive**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

Run (dev): open `http://localhost:3000`, scroll to the categories section. Expected: three cards (mETH, USDY, Aave-TVL), 3-up on desktop (`lg`), 2-up on `md`, stacked on mobile. Resize to 375px — no horizontal overflow; cards stack.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/CategoriesShowcase.tsx
git commit -m "feat(web): add USDY card + RWA framing to categories showcase"
```

---

## Task 5: RWA-frame one step + one FAQ answer

**Files:**
- Modify: `frontend/src/components/landing/HowItWorks.tsx`
- Modify: `frontend/src/components/landing/FaqAccordion.tsx`

- [ ] **Step 1: Reframe the "Compose" step body**

In `HowItWorks.tsx`, the `STEPS` entry with `k: "04"` (`h: "Compose"`), replace its `body` value (the array uses `h`/`body` keys, not `title`):

```ts
    body: "Rank-weighted ensemble across the top-20 calibrated agents per category. Yield strategies and risk controls subscribe to the consensus value + confidence band to allocate across mETH and USDY.",
```

- [ ] **Step 2: Add RWA framing to the "isn't this an oracle" FAQ answer**

In `FaqAccordion.tsx`, the `ITEMS` entry with `id: "not-oracle"` (the array uses `q`/`a` keys), replace its `a` value:

```ts
    a: "Oracles report a single source of truth. Noetrix reports an ensemble of forecasts — a probability distribution emitted by reputation-weighted agents — across Mantle's real-world assets (mETH, USDY) and Aave-on-Mantle TVL. The composite feed is the rank-weighted average of the top-20 calibrated agents per category, plus a confidence multiplier in [0.5, 1.0], and it drives the yield allocation + risk state. It is forecast intelligence, not price discovery.",
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/HowItWorks.tsx frontend/src/components/landing/FaqAccordion.tsx
git commit -m "feat(web): RWA framing in how-it-works + FAQ"
```

---

## Task 6: Create the terminal RWA Strategy panel

**Files:**
- Create: `frontend/src/components/app/RwaStrategyPanel.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/app/RwaStrategyPanel.tsx` with exactly:

```tsx
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
```

> NOTE: This assumes `Panel` exports `PanelHeader` + `PanelBody` (the leaderboard already imports all three from `@/components/ui/Panel`) and `Stat` accepts `{ label, value, tone? }` (used elsewhere in the leaderboard). If `Stat`'s `tone` prop name differs, drop the `tone="accent"` prop — it is cosmetic only.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds, no TS errors (the component isn't mounted yet — this just confirms it compiles).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/app/RwaStrategyPanel.tsx
git commit -m "feat(web): terminal RWA Strategy panel (yield allocation + risk state)"
```

---

## Task 7: Mount the RWA panel + add `data-tour` anchors on the leaderboard

**Files:**
- Modify: `frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx`

- [ ] **Step 1: Import the panel**

Add to the import block near the other `@/components/...` imports:

```ts
import { RwaStrategyPanel } from "@/components/app/RwaStrategyPanel";
```

- [ ] **Step 2: Wrap the composite-feed + top-agent Panels with `data-tour` and insert the RWA panel**

Find the grid block (~line 185) `<div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">` containing two `Panel`s. Wrap **each** `Panel` in a `data-tour` div (the wrapper divs become the grid items):

```tsx
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div data-tour="feed-value">
          <Panel elevation={2} className="overflow-hidden">
            {/* …existing composite-feed Panel contents unchanged… */}
          </Panel>
        </div>

        <div data-tour="top-agent">
          <Panel elevation={1}>
            {/* …existing top-agent Panel contents unchanged… */}
          </Panel>
        </div>
      </div>

      <div data-tour="rwa-strategy" className="mt-4">
        <RwaStrategyPanel />
      </div>
```

(Keep the inner Panel contents exactly as they are; only add the two wrapper `<div>`s and the new RWA panel block immediately after the grid.)

- [ ] **Step 3: Add `data-tour` to the tabs, table, and how-it-works regions**

Category tabs wrapper (~line 326) — add the attribute:

```tsx
      <div className="mt-10" data-tour="category-tabs">
        <CategoryTabs
          tabs={tabs}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v as CategoryId)}
        />
      </div>
```

Wrap the leaderboard-table ternary (the `{board.isLoading ? … : board.data.length === 0 ? … : <motion.div>…</motion.div>}` block, ~line 351) in a `data-tour` div:

```tsx
      <div data-tour="agent-table">
        {board.isLoading ? (
          {/* …existing loading branch… */}
        ) : board.data.length === 0 ? (
          {/* …existing empty branch… */}
        ) : (
          {/* …existing populated <motion.div> branch… */}
        )}
      </div>
```

How-it-works wrapper (~line 384) — add the attribute:

```tsx
      <div className="mt-12" data-tour="how-it-works">
```

- [ ] **Step 4: Verify build + behavior**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

Run (dev): open `/leaderboard`. Expected: the "Yield strategy & risk" panel appears below the feed/top-agent row (allocation bar mETH 4300 / USDY 5700 bps, two risk pills `NORMAL`, two eff-yield stats, "Demo data" pill since no addresses). In devtools, confirm elements exist for each selector: `document.querySelectorAll('[data-tour]')` returns 6 nodes (`category-tabs`, `feed-value`, `agent-table`, `top-agent`, `rwa-strategy`, `how-it-works`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(app)/leaderboard/LeaderboardClient.tsx
git commit -m "feat(web): mount RWA Strategy panel + tour anchors on leaderboard"
```

---

## Task 8: Tour step registry

**Files:**
- Create: `frontend/src/components/tour/steps.ts`

- [ ] **Step 1: Write the registry**

Create `frontend/src/components/tour/steps.ts`:

```ts
export interface TourStep {
  id: string;
  selector: string;
  title: string;
  body: string;
}

export const LEADERBOARD_STEPS: TourStep[] = [
  {
    id: "category-tabs",
    selector: '[data-tour="category-tabs"]',
    title: "Pick an RWA market",
    body: "Switch between mETH staking APR, USDY treasury APY, and Aave-on-Mantle TVL. Each is its own on-chain category with a resolver and scorer.",
  },
  {
    id: "feed-value",
    selector: '[data-tour="feed-value"]',
    title: "The consensus feed",
    body: "A rank-weighted composite of the most calibrated agents — the value protocols subscribe to, with a live confidence band.",
  },
  {
    id: "agent-table",
    selector: '[data-tour="agent-table"]',
    title: "Ranked forecasters",
    body: "Every agent is an ERC-8004 soulbound identity, ranked by on-chain accuracy and calibration. Click a row to see its reasoning trace.",
  },
  {
    id: "top-agent",
    selector: '[data-tour="top-agent"]',
    title: "Category leader",
    body: "The current top agent for this market and its live reputation — accuracy, calibration, and resolved count.",
  },
  {
    id: "rwa-strategy",
    selector: '[data-tour="rwa-strategy"]',
    title: "Yield + risk, automated",
    body: "Forecasts drive a dynamic allocation across mETH and USDY plus an automated risk state — the AI x RWA core.",
  },
  {
    id: "how-it-works",
    selector: '[data-tour="how-it-works"]',
    title: "Go deeper",
    body: "Expand here to see exactly how scoring works — or try the no-wallet Earn simulator and the Consumer demo from the top nav.",
  },
];
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds (file is not imported yet; this only typechecks it).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tour/steps.ts
git commit -m "feat(web): tour step registry for the leaderboard"
```

---

## Task 9: Tour provider (state machine + context + first-run/replay)

**Files:**
- Create: `frontend/src/components/tour/TourProvider.tsx`

- [ ] **Step 1: Write the provider**

Create `frontend/src/components/tour/TourProvider.tsx`:

```tsx
"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LEADERBOARD_STEPS, type TourStep } from "./steps";
import { Spotlight } from "./Spotlight";

const SEEN_KEY = "noetrix.tour.v1";
const REQUEST_KEY = "noetrix.tour.request";

interface TourCtx {
  steps: TourStep[];
  isOpen: boolean;
  index: number;
  start: () => void;
  requestStart: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  finish: () => void;
}

const Ctx = React.createContext<TourCtx | null>(null);

export function useTour(): TourCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useTour must be used within <TourProvider>");
  return v;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const steps = LEADERBOARD_STEPS;
  const [isOpen, setIsOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const onLeaderboard = pathname === "/leaderboard";

  const start = React.useCallback(() => {
    setIndex(0);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  }, []);

  const next = React.useCallback(
    () => setIndex((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const prev = React.useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const skip = React.useCallback(() => close(), [close]);
  const finish = React.useCallback(() => close(), [close]);

  // Replay from any terminal page: if not on the leaderboard, navigate there and start on arrival.
  const requestStart = React.useCallback(() => {
    if (onLeaderboard) {
      start();
      return;
    }
    try {
      sessionStorage.setItem(REQUEST_KEY, "1");
    } catch {}
    router.push("/leaderboard");
  }, [onLeaderboard, router, start]);

  // Auto-start on first leaderboard visit, or when a cross-page replay is pending.
  React.useEffect(() => {
    if (!onLeaderboard) return;
    let pending = false;
    let seen = false;
    try {
      pending = sessionStorage.getItem(REQUEST_KEY) === "1";
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (pending) {
      try {
        sessionStorage.removeItem(REQUEST_KEY);
      } catch {}
    }
    if (pending || !seen) {
      const t = setTimeout(start, 600); // let the page settle before measuring targets
      return () => clearTimeout(t);
    }
  }, [onLeaderboard, start]);

  const value: TourCtx = { steps, isOpen, index, start, requestStart, next, prev, skip, finish };

  return (
    <Ctx.Provider value={value}>
      {children}
      {isOpen ? <Spotlight /> : null}
    </Ctx.Provider>
  );
}
```

> NOTE: `Spotlight` is created in Task 10. This file imports it, so the build will fail until Task 10 lands. That's expected — commit this task's file, then complete Task 10 before running the final build. (If you prefer a green build at every task, do Task 10 first; the two are a pair.)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/tour/TourProvider.tsx
git commit -m "feat(web): tour provider (state machine + first-run + replay)"
```

---

## Task 10: Spotlight overlay (box-shadow cutout + callout + a11y)

**Files:**
- Create: `frontend/src/components/tour/Spotlight.tsx`

- [ ] **Step 1: Write the overlay**

Create `frontend/src/components/tour/Spotlight.tsx`:

```tsx
"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTour } from "./TourProvider";
import { cn } from "@/lib/cn";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const CARD_W = 320;
const CARD_EST_H = 180;
const GAP = 14;

export function Spotlight() {
  const { steps, index, next, prev, skip, finish } = useTour();
  const reduced = useReducedMotion();
  const [rect, setRect] = React.useState<Rect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = React.useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // On step change: scroll target into view (instant) then measure next frame.
  React.useEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [step, measure]);

  // Re-measure on resize/scroll.
  React.useEffect(() => {
    let raf = 0;
    const onChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  // Focus management + keyboard nav.
  React.useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        isLast ? finish() : next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    const restore = prevFocus.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      restore?.focus?.();
    };
  }, [isLast, next, prev, skip, finish]);

  if (!step) return null;

  // Callout placement: prefer below the target, flip above if it would overflow.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  let cardTop = 24;
  let cardLeft = 24;
  if (rect) {
    const below = rect.top + rect.height + GAP;
    const placeBelow = below + CARD_EST_H < vh;
    cardTop = placeBelow ? below : Math.max(GAP, rect.top - CARD_EST_H - GAP);
    cardLeft = Math.min(Math.max(GAP, rect.left), vw - CARD_W - GAP);
  }

  const spring = reduced
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 300, damping: 32 } as const);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Click-blocker keeps the user on the tour; advance via the buttons. */}
      <div className="absolute inset-0" aria-hidden />

      {/* Spotlight cutout — dark low-opacity scrim everywhere except the target. */}
      {rect ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-lg"
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={spring}
          style={{
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.66)",
            border: "1px solid var(--color-accent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" aria-hidden />
      )}

      {/* Callout card */}
      <motion.div
        ref={cardRef}
        tabIndex={-1}
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="absolute w-[320px] max-w-[calc(100vw-28px)] rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-1)] p-4 shadow-2xl focus:outline-none"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Guide · {index + 1}/{steps.length}
          </span>
          <button
            type="button"
            onClick={skip}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            Skip
          </button>
        </div>
        <h3 className="mt-2 text-sm font-medium text-[var(--color-text)]">{step.title}</h3>
        <p
          aria-live="polite"
          className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-dim)]"
        >
          {step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className={cn(
              "rounded border border-[var(--color-border)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
              index === 0
                ? "opacity-40"
                : "text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
            )}
          >
            Back
          </button>
          <button
            type="button"
            onClick={isLast ? finish : next}
            className="rounded border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-black transition-colors hover:bg-white"
          >
            {isLast ? "Finish" : "Next →"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds — both `TourProvider` (Task 9) and `Spotlight` now resolve. If `--color-border-strong` is reported as unknown, it is already used elsewhere (e.g. `LeaderboardClient` `KindGlyph`), so it exists; no action needed.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tour/Spotlight.tsx
git commit -m "feat(web): spotlight overlay (box-shadow cutout + callout + a11y)"
```

---

## Task 11: Mount the provider + add the Guide button

**Files:**
- Modify: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/app/AppHeader.tsx`

- [ ] **Step 1: Wrap the terminal layout in `TourProvider`**

Replace the contents of `frontend/src/app/(app)/layout.tsx` with:

```tsx
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { TourProvider } from "@/components/tour/TourProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <div className="flex min-h-svh flex-col bg-[var(--color-bg)]">
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <AppFooter />
      </div>
    </TourProvider>
  );
}
```

- [ ] **Step 2: Add the Guide button to the header**

In `frontend/src/components/app/AppHeader.tsx`:

Add to the imports:

```ts
import { HelpCircle } from "lucide-react";
import { useTour } from "@/components/tour/TourProvider";
```

In the right-side cluster, place `<GuideButton />` immediately **before** `<ConnectButton />`:

```tsx
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              network
            </span>
            <StatusPill tone="accent" dot pulse>
              Mantle Sepolia
            </StatusPill>
          </div>
          <GuideButton />
          <ConnectButton />
        </div>
```

Add this component at the bottom of the file (sibling to `ConnectButton`):

```tsx
function GuideButton() {
  const { requestStart } = useTour();
  return (
    <button
      type="button"
      onClick={requestStart}
      title="Replay the guided tour"
      className="hidden items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] sm:inline-flex"
    >
      <HelpCircle size={13} aria-hidden />
      Guide
    </button>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter frontend build`
Expected: build succeeds.

- [ ] **Step 4: Manual tour walkthrough**

Run: `pnpm --filter frontend dev`. In the browser devtools console run `localStorage.removeItem('noetrix.tour.v1')`, then open `http://localhost:3000/leaderboard`.
Expected:
- After ~0.6s the screen dims (dark low-opacity scrim) with the **category tabs** highlighted by a clear cutout + accent ring, and a callout card "Guide · 1/6 — Pick an RWA market".
- `Next →` steps through feed value → agent table → top agent → RWA strategy → how-it-works; the cutout animates to each. `Back` reverses. `Skip` and `Finish` close it.
- `Esc` closes; `←`/`→`/`Enter` navigate.
- Reload `/leaderboard`: the tour does **not** auto-show again (flag set).
- Click the header **Guide** button: the tour replays from step 1.
- Navigate to `/feed/meth-apr-24h`, click **Guide**: it routes to `/leaderboard` and starts.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/(app)/layout.tsx frontend/src/components/app/AppHeader.tsx
git commit -m "feat(web): mount tour provider + header Guide replay button"
```

---

## Task 12: Final verification pass

**Files:** none (verification + any fixes surfaced)

- [ ] **Step 1: Full build + lint**

Run: `pnpm --filter frontend build`
Expected: clean build, all routes listed (`/`, `/leaderboard`, `/rwa`, `/feed/[category]`, `/category/[category]`, `/agent/[id]`, `/demo-consumer`, `/submit`, `/about`). The pre-existing benign Recharts SSR width/height warning is acceptable.

Run: `pnpm --filter frontend lint`
Expected: no new errors.

- [ ] **Step 2: Manual checklist (dev server)**

Run: `pnpm --filter frontend dev` and verify:
- **Landing**: hero leads with RWA yield/risk framing; categories section shows three cards (mETH, USDY, Aave-TVL); 375px has no horizontal overflow.
- **Leaderboard**: three category tabs; USDY tab shows ~5% value + agents + "bps" caption; RWA Strategy panel renders with allocation bar + risk pills.
- **Tour**: auto on first visit, replay via Guide button, keyboard + Skip/Finish work.
- **Reduced motion**: enable OS "reduce motion" → tour cutout jumps instantly (no spring), still fully usable; landing animations collapse as before.
- **`/rwa`**: unchanged, still works.

- [ ] **Step 3: Commit any fixes**

If Step 1 or 2 surfaced fixes:

```bash
git add -A
git commit -m "fix(web): final RWA + tour verification fixes"
```

If nothing changed, skip this commit.

---

## Self-Review Notes (author)

**Spec coverage:** Part A (USDY terminal) → Tasks 1–2, 7. Part B (landing reframe) → Tasks 3–5. Part C (terminal RWA panel) → Tasks 6–7. Part D (spotlight tour) → Tasks 8–11. Verification → Task 12. All spec sections mapped.

**Type consistency:** `CategoryId` gains `"USDY_APY_24H"` (Task 1) and is used by tabs (Task 2), indexer/hooks (already generic), and the panel's `categoryHash("USDY_APY_24H")` (Task 6). `useTour()` shape (`TourProvider`, Task 9) matches consumers `Spotlight` (Task 10) and `GuideButton` (Task 11). `TourStep` (Task 8) is consumed unchanged by both. `RISK_TONE` values (`up|warn|down`) are all valid `StatusPill` tones (verified).

**Known pairing:** Tasks 9 and 10 are a compile pair (`TourProvider` imports `Spotlight`); the build is green only after Task 10. Flagged in Task 9.
