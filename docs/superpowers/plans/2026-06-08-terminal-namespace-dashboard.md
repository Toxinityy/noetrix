# Terminal Namespace Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/terminal` boot route, move the app experience under `/terminal/*`, and add a real-data `/terminal/dashboard` home.

**Architecture:** Keep `/` as the cinematic public landing. Create a new terminal route group at `frontend/src/app/terminal/` that owns the app shell and dashboard. Preserve existing pages by moving/copying them under `/terminal/*` and adding redirects from the old top-level app routes.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Motion, TanStack Query, Wagmi/Viem, Playwright, Vitest.

---

## File Structure

- Modify `frontend/src/components/landing/Nav.tsx`: landing-only nav and CTA to `/terminal`.
- Create `frontend/src/app/terminal/page.tsx`: boot entry route.
- Create `frontend/src/app/terminal/TerminalBootClient.tsx`: client boot animation and redirect/reveal logic.
- Create `frontend/src/app/terminal/layout.tsx`: terminal app shell provider/layout.
- Move/copy current app pages from `frontend/src/app/(app)/*` to `frontend/src/app/terminal/*`.
- Modify `frontend/src/components/app/AppHeader.tsx`: namespace links under `/terminal`, add Dashboard primary nav, brand to `/terminal/dashboard`.
- Create `frontend/src/app/terminal/dashboard/page.tsx`: server route wrapper.
- Create `frontend/src/app/terminal/dashboard/DashboardClient.tsx`: real information dashboard.
- Create old-route redirect files under `frontend/src/app/(app)/*/page.tsx` as needed.
- Modify `frontend/e2e/responsive.spec.ts` and `frontend/e2e/tour.spec.ts`: use `/terminal/*` paths and add boot/dashboard checks.

---

### Task 1: Namespace terminal navigation

**Files:**
- Modify: `frontend/src/components/landing/Nav.tsx`
- Modify: `frontend/src/components/app/AppHeader.tsx`

- [ ] **Step 1: Update landing CTA and remove direct app links**

In `frontend/src/components/landing/Nav.tsx`, replace the nav item array with landing anchors only and change the CTA href:

```tsx
{[
  ["Start", "#start-here"],
  ["Categories", "#categories"],
  ["How", "#how"],
  ["FAQ", "#faq"],
].map(([label, href]) => (
```

Change:

```tsx
href="/leaderboard"
```

to:

```tsx
href="/terminal"
```

- [ ] **Step 2: Update terminal app nav links**

In `frontend/src/components/app/AppHeader.tsx`, change nav constants to:

```tsx
const primaryNav = [
  { href: "/terminal/dashboard", label: "Dashboard" },
  { href: "/terminal/insights", label: "Insights" },
  { href: "/terminal/leaderboard", label: "Leaderboard" },
  { href: "/terminal/try", label: "Try" },
  { href: "/terminal/pricing", label: "Pricing" },
];
const moreNav = [
  { href: "/terminal/simulation", label: "Earn" },
  { href: "/terminal/feed/meth-apr-24h", label: "Feed" },
  { href: "/terminal/demo-consumer", label: "Consumer" },
  { href: "/terminal/submit", label: "Submit" },
  { href: "/terminal/agents", label: "For agents" },
  { href: "/terminal/about", label: "About" },
];
```

Change the brand link from:

```tsx
<Link href="/" className="group flex items-center gap-2.5">
```

to:

```tsx
<Link href="/terminal/dashboard" className="group flex items-center gap-2.5">
```

Add a small home/exit link before the network pill:

```tsx
<Link
  href="/"
  className="hidden rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] lg:inline-flex"
>
  Exit
</Link>
```

- [ ] **Step 3: Verify nav compiles**

Run:

```bash
pnpm --filter frontend lint
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/Nav.tsx frontend/src/components/app/AppHeader.tsx
git commit -m "feat(web): namespace terminal navigation"
```

---

### Task 2: Create terminal route shell and boot animation

**Files:**
- Create: `frontend/src/app/terminal/layout.tsx`
- Create: `frontend/src/app/terminal/page.tsx`
- Create: `frontend/src/app/terminal/TerminalBootClient.tsx`

- [ ] **Step 1: Create terminal layout**

Create `frontend/src/app/terminal/layout.tsx`:

```tsx
import { AppHeader } from "@/components/app/AppHeader";
import { AppFooter } from "@/components/app/AppFooter";
import { TourProvider } from "@/components/tour/TourProvider";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <TourProvider>
      <OnboardingModal />
      <div className="relative flex min-h-svh flex-col overflow-hidden bg-[var(--color-bg)]">
        <div aria-hidden className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(rgba(51,234,179,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(51,234,179,.05)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(51,234,179,.12),transparent_42%)]" />
        <AppHeader />
        <main id="main" tabIndex={-1} className="relative z-10 flex-1 focus:outline-none">
          {children}
        </main>
        <AppFooter />
      </div>
    </TourProvider>
  );
}
```

- [ ] **Step 2: Create boot page wrapper**

Create `frontend/src/app/terminal/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TerminalBootClient } from "./TerminalBootClient";

export const metadata: Metadata = {
  title: "Initializing Terminal — Noetrix",
  description: "Boot into the Noetrix protocol terminal.",
};

export default function TerminalPage() {
  return <TerminalBootClient />;
}
```

- [ ] **Step 3: Create boot animation client**

Create `frontend/src/app/terminal/TerminalBootClient.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

export function TerminalBootClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<"boot" | "boom">("boot");

  React.useEffect(() => {
    const boomDelay = reduceMotion ? 120 : 950;
    const routeDelay = reduceMotion ? 220 : 1350;
    const boomTimer = window.setTimeout(() => setPhase("boom"), boomDelay);
    const routeTimer = window.setTimeout(() => router.replace("/terminal/dashboard"), routeDelay);
    return () => {
      window.clearTimeout(boomTimer);
      window.clearTimeout(routeTimer);
    };
  }, [reduceMotion, router]);

  return (
    <div className="relative grid min-h-[calc(100svh-3.5rem)] place-items-center overflow-hidden px-6">
      <motion.div
        aria-hidden
        animate={phase === "boom" ? { opacity: [0, 1, 0], scale: [0.96, 1.08, 1.24] } : { opacity: 0 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.42, ease: "easeOut" }}
        className="absolute inset-0 bg-[var(--color-accent)] mix-blend-screen"
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={phase === "boom" ? { opacity: 0, y: -18, scale: 1.08 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-bg-elev-1)]/80 p-8 text-center shadow-[0_0_80px_rgba(51,234,179,.16)]"
      >
        <div className="mx-auto mb-6 h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_18px_var(--color-accent)]" />
        <h1 className="font-mono text-sm uppercase tracking-[0.34em] text-[var(--color-accent)]">
          INITIALIZING...
        </h1>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-[var(--color-border)]">
          <motion.div
            className="h-full bg-[var(--color-accent)]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: reduceMotion ? 0.15 : 1.05, ease: "easeInOut" }}
          />
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          Mantle Sepolia · AI forecast protocol
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build sees `/terminal`**

Run:

```bash
pnpm --filter frontend build
```

Expected: build succeeds and includes `/terminal` in routes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/terminal/layout.tsx frontend/src/app/terminal/page.tsx frontend/src/app/terminal/TerminalBootClient.tsx
git commit -m "feat(web): add terminal boot route"
```

---

### Task 3: Move app pages under `/terminal/*` and add redirects

**Files:**
- Create/move: `frontend/src/app/terminal/*`
- Modify/create redirects in `frontend/src/app/(app)/*/page.tsx`

- [ ] **Step 1: Copy current app pages into terminal namespace**

Use file operations to copy each directory from `frontend/src/app/(app)/` into `frontend/src/app/terminal/` except `layout.tsx`:

```text
about -> terminal/about
agent -> terminal/agent
agents -> terminal/agents
category -> terminal/category
demo-consumer -> terminal/demo-consumer
feed -> terminal/feed
insights -> terminal/insights
leaderboard -> terminal/leaderboard
pricing -> terminal/pricing
simulation -> terminal/simulation
submit -> terminal/submit
try -> terminal/try
```

Preserve co-located relative imports such as `./InsightsClient`.

- [ ] **Step 2: Replace old static pages with redirects**

For old non-dynamic page files, replace contents with:

```tsx
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/terminal/REPLACE_ME");
}
```

Concrete replacements:

```text
(app)/about/page.tsx -> /terminal/about
(app)/agents/page.tsx -> /terminal/agents
(app)/demo-consumer/page.tsx -> /terminal/demo-consumer
(app)/insights/page.tsx -> /terminal/insights
(app)/leaderboard/page.tsx -> /terminal/leaderboard
(app)/pricing/page.tsx -> /terminal/pricing
(app)/simulation/page.tsx -> /terminal/simulation
(app)/submit/page.tsx -> /terminal/submit
(app)/try/page.tsx -> /terminal/try
```

- [ ] **Step 3: Replace old dynamic route pages with redirects**

For `frontend/src/app/(app)/agent/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  redirect(`/terminal/agent/${id}`);
}
```

For `frontend/src/app/(app)/category/[category]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

type Props = { params: Promise<{ category: string }> };

export default async function Page({ params }: Props) {
  const { category } = await params;
  redirect(`/terminal/category/${category}`);
}
```

For `frontend/src/app/(app)/feed/[category]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

type Props = { params: Promise<{ category: string }> };

export default async function Page({ params }: Props) {
  const { category } = await params;
  redirect(`/terminal/feed/${category}`);
}
```

- [ ] **Step 4: Verify old and new route build**

Run:

```bash
pnpm --filter frontend build
```

Expected: build succeeds; routes include both old redirect routes and new `/terminal/*` routes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app
git commit -m "feat(web): move app pages under terminal namespace"
```

---

### Task 4: Build `/terminal/dashboard` real-information dashboard

**Files:**
- Create: `frontend/src/app/terminal/dashboard/page.tsx`
- Create: `frontend/src/app/terminal/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Create dashboard page wrapper**

Create `frontend/src/app/terminal/dashboard/page.tsx`:

```tsx
import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Noetrix Terminal",
  description: "Noetrix protocol dashboard: feeds, agents, categories, predictions, and system state.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
```

- [ ] **Step 2: Create dashboard client**

Create `frontend/src/app/terminal/dashboard/DashboardClient.tsx` with focused cards and real data only:

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, BarChart3, Database, Radio, ShieldCheck } from "lucide-react";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryTabs } from "@/components/ui/CategoryTabs";
import { CATEGORIES, type CategoryId } from "@/lib/mockData";
import { FRIENDLY_CATEGORY } from "@/lib/labels";
import { useInsightsData, useLeaderboard } from "@/lib/hooks";
import { fmtScore, fmtBps, fmtCompactUsd } from "@/lib/format";
import { env, hasIndexer, hasSubscriptionGate } from "@/lib/env";

function formatCategoryValue(categoryId: CategoryId, value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const meta = CATEGORIES[categoryId];
  if (meta.unit === "bps") return fmtBps(value);
  if (meta.unit === "usd") return fmtCompactUsd(value / 1e8);
  return value.toLocaleString("en-US");
}

export function DashboardClient() {
  const [categoryId, setCategoryId] = React.useState<CategoryId>("METH_APR_24H");
  const insights = useInsightsData(categoryId);
  const leaderboard = useLeaderboard(categoryId);
  const categories = Object.values(CATEGORIES);
  const topAgents = leaderboard.data
    .slice()
    .sort((a, b) => b.accuracyScore - a.accuracyScore)
    .slice(0, 5);
  const latestFeed = insights.feed[insights.feed.length - 1] ?? null;
  const resolved = insights.category?.predictions.filter((p) => p.status === "Resolved") ?? [];
  const latestResolved = resolved.slice(-5).reverse();
  const totalResolved = resolved.length;
  const qualifiedAgents = leaderboard.data.filter((row) => row.resolvedCount >= 10).length;

  const tabs = categories.map((c) => ({
    id: c.id,
    label: FRIENDLY_CATEGORY[c.id],
    caption: c.unit === "usd" ? "USD" : "yield",
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
            noetrix / terminal / dashboard
          </div>
          <h1 className="mt-2 text-[clamp(30px,4vw,48px)] font-medium tracking-tight text-[var(--color-text)]">
            Protocol dashboard
          </h1>
        </div>
        <StatusPill tone={insights.source === "live" ? "up" : insights.source === "snapshot" ? "accent" : "muted"} dot>
          {insights.source === "live" ? "Live snapshot" : insights.source === "snapshot" ? "Committed snapshot" : "Demo data"}
        </StatusPill>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Radio size={16} />} label="Feed value" value={formatCategoryValue(categoryId, latestFeed?.value ?? insights.crowdValue)} caption={FRIENDLY_CATEGORY[categoryId]} />
        <MetricCard icon={<ShieldCheck size={16} />} label="Confidence" value={latestFeed ? `${(latestFeed.confidence / 100).toFixed(1)}%` : "—"} caption={latestFeed ? `${latestFeed.contributors} contributors` : "No feed point"} />
        <MetricCard icon={<Database size={16} />} label="Resolved forecasts" value={totalResolved.toLocaleString("en-US")} caption={insights.block ? `block #${insights.block.toLocaleString("en-US")}` : "snapshot block unavailable"} />
        <MetricCard icon={<Activity size={16} />} label="Qualified agents" value={qualifiedAgents.toLocaleString("en-US")} caption={`${leaderboard.data.length} listed agents`} />
      </div>

      <div className="mt-8">
        <CategoryTabs tabs={tabs} value={categoryId} onValueChange={(v) => setCategoryId(v as CategoryId)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Panel>
          <PanelHeader eyebrow="feeds" title="Category feed status" />
          <PanelBody>
            <div className="grid gap-3 md:grid-cols-3">
              {categories.map((category) => (
                <CategoryFeedCard key={category.id} categoryId={category.id} />
              ))}
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="network" title="System status" />
          <PanelBody>
            <dl className="space-y-3 text-sm">
              <StatusRow label="Network" value="Mantle Sepolia" />
              <StatusRow label="Indexer" value={hasIndexer ? "Configured" : "No live indexer configured"} />
              <StatusRow label="Snapshot" value={insights.generatedAt ? new Date(insights.generatedAt).toLocaleString("en-US") : "Snapshot unavailable"} />
              <StatusRow label="Subscription gate" value={hasSubscriptionGate ? env.addresses.subscriptionGate : "Not configured"} mono />
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow="agents" title="Top agents" />
          <PanelBody>
            {topAgents.length > 0 ? (
              <div className="space-y-3">
                {topAgents.map((agent, index) => (
                  <Link key={agent.id} href={`/terminal/agent/${agent.id}`} className="flex items-center justify-between rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-4 py-3 transition-colors hover:border-[var(--color-accent-soft)]">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">#{index + 1} · agent {agent.id}</div>
                      <div className="mt-1 text-sm text-[var(--color-text)]">{agent.name}</div>
                    </div>
                    <div className="text-right font-mono text-xs text-[var(--color-accent)]">{fmtScore(agent.accuracyScore)}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No agents available" body="No leaderboard rows are available for this category." />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader eyebrow="predictions" title="Latest resolved predictions" />
          <PanelBody>
            {latestResolved.length > 0 ? (
              <div className="space-y-3">
                {latestResolved.map((prediction) => (
                  <div key={prediction.id} className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">prediction {prediction.id}</div>
                      <div className="font-mono text-xs text-[var(--color-accent)]">{prediction.score !== null ? fmtScore(prediction.score) : "—"}</div>
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-text-dim)]">
                      agent {prediction.agentId} · block {prediction.resolutionBlock?.toLocaleString("en-US") ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No resolved predictions yet" body="Snapshot has no resolved predictions for this category." />
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: string; caption: string }) {
  return (
    <Panel>
      <PanelBody>
        <div className="flex items-center justify-between text-[var(--color-text-muted)]">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
          <span className="text-[var(--color-accent)]">{icon}</span>
        </div>
        <div className="mt-4 font-mono text-2xl text-[var(--color-text)]">{value}</div>
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">{caption}</div>
      </PanelBody>
    </Panel>
  );
}

function CategoryFeedCard({ categoryId }: { categoryId: CategoryId }) {
  const data = useInsightsData(categoryId);
  const latest = data.feed[data.feed.length - 1] ?? null;
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{FRIENDLY_CATEGORY[categoryId]}</div>
      <div className="mt-3 font-mono text-xl text-[var(--color-text)]">{formatCategoryValue(categoryId, latest?.value ?? data.crowdValue)}</div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{latest ? `${(latest.confidence / 100).toFixed(1)}% conf` : "No feed point"}</span>
        <span>{data.source}</span>
      </div>
    </div>
  );
}

function StatusRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className={mono ? "max-w-[260px] truncate font-mono text-xs text-[var(--color-text)]" : "text-right text-[var(--color-text)]"}>{value}</dd>
    </div>
  );
}
```

- [ ] **Step 3: Fix imports if actual utility names differ**

Run:

```bash
pnpm --filter frontend lint
```

If imports fail, inspect the named exports in the referenced files and update only the import names, not the dashboard scope.

- [ ] **Step 4: Build**

Run:

```bash
pnpm --filter frontend build
```

Expected: build succeeds and includes `/terminal/dashboard`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/terminal/dashboard
git commit -m "feat(web): add terminal dashboard"
```

---

### Task 5: Update internal links for terminal namespace

**Files:**
- Modify likely files under `frontend/src/app/terminal/**` and `frontend/src/components/**` that link to app routes.

- [ ] **Step 1: Search for old app links**

Run:

```bash
rg 'href="/(insights|leaderboard|try|pricing|simulation|feed|demo-consumer|submit|agents|about|agent|category)' frontend/src
```

- [ ] **Step 2: Replace old app links with terminal links**

Examples:

```tsx
href="/leaderboard" -> href="/terminal/leaderboard"
href="/insights" -> href="/terminal/insights"
href="/agent/1" -> href="/terminal/agent/1"
href={`/agent/${id}`} -> href={`/terminal/agent/${id}`}
href={`/feed/${slug}`} -> href={`/terminal/feed/${slug}`}
```

Do not change landing section anchors such as `#faq`, `#categories`, `#how`, or the public root `/`.

- [ ] **Step 3: Verify no app-link leftovers where terminal should be used**

Run:

```bash
rg 'href="/(insights|leaderboard|try|pricing|simulation|feed|demo-consumer|submit|agents|about|agent|category)' frontend/src
```

Expected: only intentional redirect pages or public landing CTA leftovers remain. Landing terminal CTA should be `/terminal`.

- [ ] **Step 4: Run lint/build**

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "fix(web): update terminal namespace links"
```

---

### Task 6: Update e2e route coverage

**Files:**
- Modify: `frontend/e2e/responsive.spec.ts`
- Modify: `frontend/e2e/tour.spec.ts`
- Optional create: `frontend/e2e/terminal.spec.ts`

- [ ] **Step 1: Update responsive pages**

In `frontend/e2e/responsive.spec.ts`, change:

```ts
const pages = ["/leaderboard", "/insights", "/agent/1", "/try", "/pricing"];
```

to:

```ts
const pages = [
  "/terminal/dashboard",
  "/terminal/leaderboard",
  "/terminal/insights",
  "/terminal/agent/1",
  "/terminal/try",
  "/terminal/pricing",
];
```

Change onboarding test route:

```ts
await page.goto("/terminal/leaderboard");
```

- [ ] **Step 2: Add terminal boot and redirect tests**

Create `frontend/e2e/terminal.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("terminal boot shows initializing then opens dashboard", async ({ page }) => {
  await page.goto("/terminal", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("INITIALIZING...")).toBeVisible();
  await page.waitForURL("**/terminal/dashboard", { timeout: 5000 });
  await expect(page.getByRole("heading", { name: "Protocol dashboard" })).toBeVisible();
});

test("old leaderboard route redirects to terminal namespace", async ({ page }) => {
  await page.goto("/leaderboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/terminal/leaderboard", { timeout: 5000 });
});
```

- [ ] **Step 3: Update tour test paths**

Open `frontend/e2e/tour.spec.ts` and replace `/leaderboard` with `/terminal/leaderboard`. Replace other app route paths with `/terminal/*` equivalents.

- [ ] **Step 4: Run e2e**

Run:

```bash
pnpm --filter frontend test:e2e
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/e2e
git commit -m "test(web): cover terminal namespace routes"
```

---

### Task 7: Final verification and docs update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run final frontend checks**

```bash
pnpm --filter frontend lint
pnpm --filter frontend test
pnpm --filter frontend build
pnpm --filter frontend test:e2e
```

Expected: all pass. Note: do not use direct `tsc --noEmit` unless Next typegen is run first; baseline direct tsc fails on `PageProps`.

- [ ] **Step 2: Append session history**

Append a new dated entry at the top of `CLAUDE.md` §6 with:

```md
### 2026-06-08 — Terminal namespace + dashboard (branch `terminal-entry-nav`)
**Type:** Build (frontend routing + terminal shell).
- Added `/terminal` boot route with `INITIALIZING...` animation and dashboard entry.
- Moved app surfaces under `/terminal/*`; old routes redirect.
- Added `/terminal/dashboard` with real protocol information only.
- Updated landing nav and terminal nav separation.
- Verification: lint/test/build/e2e results.
```

- [ ] **Step 3: Check git status**

```bash
git status --short
```

Expected: only intended files changed.

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-06-08-terminal-namespace-dashboard-design.md docs/superpowers/plans/2026-06-08-terminal-namespace-dashboard.md
git commit -m "docs: record terminal namespace implementation"
```

---

## Self-review

- Spec coverage: covers landing nav separation, `/terminal` boot, `/terminal/dashboard`, app route namespace, redirects, real-data dashboard only, and tests.
- Placeholder scan: no TBD/TODO placeholders are left; `REPLACE_ME` appears only inside a template instruction with concrete replacements immediately below.
- Type consistency: all introduced route paths use `/terminal/*`; dashboard uses existing `useInsightsData`, `useLeaderboard`, `CATEGORIES`, `FRIENDLY_CATEGORY`, `Panel`, `StatusPill`, and `EmptyState` patterns.
