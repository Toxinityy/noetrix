# Try-It-Live (`/try`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/try` route where a judge connects a wallet, switches to Mantle Sepolia, and fires one `CompositeFeed.refresh(category)` tx, with a read-only live view and an honest no-wallet Preview.

**Architecture:** One client component (`TryClient`) drives a linear state machine (`disconnected → wrong-network → no-gas → ready → success`) using wagmi hooks. State derivation is a pure function (`derivePanelState`) that is unit-tested. No contract/agent/indexer/deploy changes; reuses the existing `compositeFeedAbi`, `categoryHash`, `env`.

**Tech Stack:** Next.js 16 (App Router, route group `(app)`), React, wagmi v2, viem, Tailwind v4 (CSS-var tokens), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-04-try-live-judge-interaction-design.md`

---

## File structure

**Create:**
- `frontend/src/lib/tryState.ts` — pure `derivePanelState` + `PanelState` type (testable core).
- `frontend/src/lib/tryState.test.ts` — vitest unit tests.
- `frontend/src/app/(app)/try/page.tsx` — server shell + metadata.
- `frontend/src/app/(app)/try/TryClient.tsx` — the client state machine + UI.

**Modify:**
- `frontend/src/lib/env.ts` — add `faucetUrl` + `explorerTx()`.
- `frontend/src/components/app/AppHeader.tsx` — add `/try` to `primaryNav`.
- `frontend/src/components/tour/steps.ts` — extend `TourId`, add `TRY_STEPS`, register in `TOURS`/`TOUR_PAGES`.
- `frontend/e2e/responsive.spec.ts` — add `/try` to the routes checked for 375px overflow.

---

## Task 1: Env helpers (faucet URL + tx explorer link)

**Files:**
- Modify: `frontend/src/lib/env.ts`

- [ ] **Step 1: Add `faucetUrl` to the `env` object.** Insert after the `explorerUrl` line (currently line 12), inside the `env` object before `addresses:`:

```ts
  faucetUrl: process.env.NEXT_PUBLIC_FAUCET_URL ?? "https://faucet.sepolia.mantle.xyz",
```

- [ ] **Step 2: Add `explorerTx` helper.** Append after the existing `explorerBlock` function (currently ends line 36):

```ts
export function explorerTx(hash: string): string {
  return `${env.explorerUrl}/tx/${hash}`;
}
```

- [ ] **Step 3: Typecheck.**

Run: `pnpm --filter frontend exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit.**

```bash
git add frontend/src/lib/env.ts
git commit -m "feat(web): add faucetUrl + explorerTx to env config"
```

---

## Task 2: Pure panel-state derivation (TDD)

**Files:**
- Create: `frontend/src/lib/tryState.ts`
- Test: `frontend/src/lib/tryState.test.ts`

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/tryState.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivePanelState } from "./tryState";

const base = { isConnected: true, chainId: 5003, expectedChainId: 5003, balanceWei: 1n };

describe("derivePanelState", () => {
  it("disconnected when no wallet connected", () => {
    expect(derivePanelState({ ...base, isConnected: false })).toBe("disconnected");
  });
  it("wrong-network when chainId mismatches", () => {
    expect(derivePanelState({ ...base, chainId: 1 })).toBe("wrong-network");
  });
  it("wrong-network when chainId is undefined", () => {
    expect(derivePanelState({ ...base, chainId: undefined })).toBe("wrong-network");
  });
  it("no-gas when balance is exactly zero", () => {
    expect(derivePanelState({ ...base, balanceWei: 0n })).toBe("no-gas");
  });
  it("ready when connected, right network, positive balance", () => {
    expect(derivePanelState(base)).toBe("ready");
  });
  it("ready when balance is unknown (advisory, never hard-block)", () => {
    expect(derivePanelState({ ...base, balanceWei: undefined })).toBe("ready");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails.**

Run: `pnpm --filter frontend exec vitest run src/lib/tryState.test.ts`
Expected: FAIL — `Cannot find module './tryState'` or `derivePanelState is not a function`.

- [ ] **Step 3: Write the minimal implementation.** Create `frontend/src/lib/tryState.ts`:

```ts
/// Linear states for the /try guided panel. Exactly one primary action is shown per state.
export type PanelState = "disconnected" | "wrong-network" | "no-gas" | "ready";

export interface PanelInput {
  isConnected: boolean;
  chainId: number | undefined;
  expectedChainId: number;
  /// Native MNT balance in wei. `undefined` = unknown/loading — treated as ready (advisory, never hard-block).
  balanceWei: bigint | undefined;
}

export function derivePanelState(i: PanelInput): PanelState {
  if (!i.isConnected) return "disconnected";
  if (i.chainId !== i.expectedChainId) return "wrong-network";
  if (i.balanceWei !== undefined && i.balanceWei === 0n) return "no-gas";
  return "ready";
}
```

- [ ] **Step 4: Run the test, verify it passes.**

Run: `pnpm --filter frontend exec vitest run src/lib/tryState.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/lib/tryState.ts frontend/src/lib/tryState.test.ts
git commit -m "feat(web): pure derivePanelState for /try state machine (TDD)"
```

---

## Task 3: The `/try` route + TryClient state machine

**Files:**
- Create: `frontend/src/app/(app)/try/page.tsx`
- Create: `frontend/src/app/(app)/try/TryClient.tsx`

- [ ] **Step 1: Create the server shell.** Create `frontend/src/app/(app)/try/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TryClient } from "./TryClient";

export const metadata: Metadata = {
  title: "Try it live — Noetrix",
  description: "Connect a wallet and write to the live on-chain AI feed on Mantle Sepolia.",
};

export default function TryPage() {
  return <TryClient />;
}
```

- [ ] **Step 2: Create the client component.** Create `frontend/src/app/(app)/try/TryClient.tsx` with the full content below. It covers every state (disconnected, wrong-network, no-gas, ready, success), the read-only snapshot, the refresh write + receipt wait + before/after proof, RateLimited handling, and the no-wallet Preview.

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  useAccount,
  useBalance,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { decodeAbiParameters } from "viem";
import { compositeFeedAbi, categoryHash } from "@/lib/contracts";
import { env, hasFeed, explorerTx } from "@/lib/env";
import { derivePanelState } from "@/lib/tryState";

const CATEGORY_OPTIONS = [
  { id: "METH_APR_24H", name: "mETH staking APR" },
  { id: "USDY_APY_24H", name: "USDY treasury APY" },
  { id: "AAVE_MANTLE_TVL_24H", name: "Aave-Mantle TVL" },
] as const;
type CatId = (typeof CATEGORY_OPTIONS)[number]["id"];

interface FeedRead {
  value: bigint;
  confidence: number;
  contributors: number;
  block: number;
}

function decodeFeed(data: unknown): FeedRead | null {
  if (!data) return null;
  const f = data as { value: `0x${string}`; confidence: number; contributingAgents: bigint; lastUpdatedBlock: bigint };
  let value = 0n;
  try {
    value = decodeAbiParameters([{ type: "uint256" }], f.value)[0] as bigint;
  } catch {
    value = 0n;
  }
  return {
    value,
    confidence: Number(f.confidence),
    contributors: Number(f.contributingAgents),
    block: Number(f.lastUpdatedBlock),
  };
}

export function TryClient() {
  const [selected, setSelected] = React.useState<CatId>("METH_APR_24H");
  const [preview, setPreview] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [txHash, setTxHash] = React.useState<`0x${string}` | undefined>(undefined);
  const [beforeBlock, setBeforeBlock] = React.useState<number | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending: connecting } = useConnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: balance } = useBalance({ address, query: { enabled: !!address } });
  const { writeContractAsync, isPending: writing } = useWriteContract();

  // Hydration-safe mounted flag (wallet state is client-only).
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const hasInjectedWallet = mounted && typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);

  const read = useReadContract({
    address: env.addresses.compositeFeed as `0x${string}`,
    abi: compositeFeedAbi,
    functionName: "read",
    args: [categoryHash(selected)],
    query: { enabled: hasFeed, refetchInterval: 15_000 },
  });
  const feed = decodeFeed(read.data);

  const receipt = useWaitForTransactionReceipt({ hash: txHash, query: { enabled: !!txHash } });
  React.useEffect(() => {
    if (receipt.isSuccess) read.refetch();
  }, [receipt.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = mounted
    ? derivePanelState({ isConnected, chainId, expectedChainId: env.chainId, balanceWei: balance?.value })
    : "disconnected";

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
  };

  const handleRefresh = async () => {
    setError(null);
    setTxHash(undefined);
    setBeforeBlock(feed?.block ?? 0);
    try {
      const hash = await writeContractAsync({
        address: env.addresses.compositeFeed as `0x${string}`,
        abi: compositeFeedAbi,
        functionName: "refresh",
        args: [categoryHash(selected)],
      });
      setTxHash(hash);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      setError(
        msg.includes("RateLimited")
          ? "This feed was just refreshed — wait ~100 blocks or pick another category."
          : "Transaction rejected or reverted.",
      );
    }
  };

  const catName = CATEGORY_OPTIONS.find((c) => c.id === selected)!.name;

  return (
    <div className="mx-auto max-w-2xl px-5 py-12" data-tour="try-refresh">
      <h1 className="text-3xl font-semibold text-white">Try it live</h1>
      <p className="mt-3 text-white/60">
        Connect a wallet and write to the live on-chain AI feed on Mantle Sepolia — one transaction, fully
        permissionless. No subscription, no signup.
      </p>

      {/* Category picker */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Category">
        {CATEGORY_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected === c.id}
            onClick={() => {
              setSelected(c.id);
              setTxHash(undefined);
              setBeforeBlock(null);
              setError(null);
            }}
            className={
              "rounded border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors " +
              (selected === c.id
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]")
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Live read-only snapshot — renders in every state */}
      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          live on-chain feed · {catName}
        </div>
        {!hasFeed ? (
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">
            Feed address not configured in this build (set NEXT_PUBLIC_ADDR_COMPOSITE_FEED).
          </p>
        ) : feed ? (
          <div className="mt-3 grid grid-cols-3 gap-3 font-mono text-sm">
            <div>
              <div className="text-[var(--color-text-muted)] text-[10px] uppercase">value</div>
              <div className="text-white">{feed.value.toString()}</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)] text-[10px] uppercase">confidence</div>
              <div className="text-white">{feed.confidence}</div>
            </div>
            <div>
              <div className="text-[var(--color-text-muted)] text-[10px] uppercase">contributors</div>
              <div className="text-white">{feed.contributors}</div>
            </div>
            <div className="col-span-3">
              <div className="text-[var(--color-text-muted)] text-[10px] uppercase">last updated block</div>
              <div className="text-white">{feed.block}</div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-text-dim)]">Reading feed…</p>
        )}
      </div>

      {/* The guided action panel */}
      <div className="mt-4 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-5">
        {!mounted ? (
          <p className="text-sm text-[var(--color-text-dim)]">Loading wallet…</p>
        ) : preview || (!hasInjectedWallet && state === "disconnected") ? (
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warn)]">
              Preview — not an on-chain transaction
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-dim)]">
              A real refresh re-aggregates the top-20 agents&apos; latest forecasts into a fresh consensus value and
              updates the block above. {hasInjectedWallet ? "" : "No wallet detected — install MetaMask to do it for real."}
            </p>
            {hasInjectedWallet && (
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="mt-4 rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"
              >
                Do it for real
              </button>
            )}
          </div>
        ) : state === "disconnected" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">Step 1 — connect your wallet to interact on-chain.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting || !connectors[0]}
                className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
              >
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className="rounded border border-[var(--color-border)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              >
                Preview (no wallet)
              </button>
            </div>
          </div>
        ) : state === "wrong-network" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">Step 2 — switch your wallet to Mantle Sepolia.</p>
            <button
              type="button"
              onClick={() => switchChain({ chainId: env.chainId })}
              disabled={switching}
              className="mt-4 rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
            >
              {switching ? "Switching…" : "Switch to Mantle Sepolia"}
            </button>
          </div>
        ) : state === "no-gas" ? (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">
              Step 3 — you need a little testnet MNT for gas. Grab some, then re-check.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href={env.faucetUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-[var(--color-accent)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]"
              >
                Open faucet
              </a>
              <button
                type="button"
                onClick={() => read.refetch()}
                className="rounded border border-[var(--color-border)] px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              >
                I&apos;ve funded it — re-check
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-[var(--color-text-dim)]">
              Step 4 — refresh the {catName} feed. One signature writes a fresh consensus on-chain.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={writing || receipt.isLoading}
              className="mt-4 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)] disabled:opacity-60"
            >
              {writing ? "Confirm in wallet…" : receipt.isLoading ? "Mining…" : "Refresh the live AI feed"}
            </button>

            {receipt.isSuccess && txHash && (
              <div className="mt-4 rounded border border-[var(--color-up)]/40 bg-[var(--color-up)]/5 p-3 text-sm">
                <p className="text-[var(--color-up)]">You just updated the on-chain AI feed.</p>
                {beforeBlock != null && feed && (
                  <p className="mt-1 font-mono text-xs text-[var(--color-text-dim)]">
                    lastUpdatedBlock {beforeBlock} → {feed.block}
                  </p>
                )}
                <a
                  href={explorerTx(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-[var(--color-accent)] hover:underline"
                >
                  View your transaction ↗
                </a>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-[var(--color-warn)]">{error}</p>}
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/leaderboard" className="text-sm text-[var(--color-accent)] hover:underline">
          See the agents behind this feed → leaderboard
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint.**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend lint`
Expected: exit 0, 0 warnings/errors in the new files. If lint flags the `react-hooks/exhaustive-deps` line, the inline `eslint-disable-line` already handles it; if any unused import remains, remove it.

- [ ] **Step 4: Build, verify `/try` is a route.**

Run: `pnpm --filter frontend build`
Expected: green; route list includes `/try`.

- [ ] **Step 5: Commit.**

```bash
git add "frontend/src/app/(app)/try/page.tsx" "frontend/src/app/(app)/try/TryClient.tsx"
git commit -m "feat(web): /try route — connect, switch, faucet, refresh, proof, preview"
```

---

## Task 4: Nav link + tour wiring

**Files:**
- Modify: `frontend/src/components/app/AppHeader.tsx:13-17` (the `primaryNav` array)
- Modify: `frontend/src/components/tour/steps.ts`

- [ ] **Step 1: Add `/try` to the primary nav.** In `frontend/src/components/app/AppHeader.tsx`, change the `primaryNav` array to include a "Try" entry:

```ts
const primaryNav = [
  { href: "/rwa", label: "Earn" },
  { href: "/insights", label: "Insights" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/try", label: "Try" },
];
```

- [ ] **Step 2: Extend the `TourId` union.** In `frontend/src/components/tour/steps.ts`, change the `TourId` type (currently line 47):

```ts
export type TourId = "leaderboard" | "earn" | "alpha" | "build" | "try";
```

- [ ] **Step 3: Add `TRY_STEPS`.** In the same file, add after `BUILD_STEPS` (before the `TOURS` declaration):

```ts
export const TRY_STEPS: TourStep[] = [
  {
    id: "try-refresh",
    selector: '[data-tour="try-refresh"]',
    title: "Write to the live protocol",
    body: "Connect a wallet, switch to Mantle Sepolia, and refresh the on-chain AI feed yourself — one permissionless transaction. No wallet? Use the Preview.",
  },
];
```

- [ ] **Step 4: Register it in `TOURS` and `TOUR_PAGES`.** Update both records:

```ts
export const TOURS: Record<TourId, TourStep[]> = {
  leaderboard: LEADERBOARD_STEPS,
  earn: EARN_STEPS,
  alpha: ALPHA_STEPS,
  build: BUILD_STEPS,
  try: TRY_STEPS,
};

export const TOUR_PAGES: Record<TourId, string> = {
  leaderboard: "/leaderboard",
  earn: "/rwa",
  alpha: "/insights",
  build: "/submit",
  try: "/try",
};
```

- [ ] **Step 5: Typecheck + run the persona test (must still pass — it does not enumerate all TourIds).**

Run: `pnpm --filter frontend exec tsc --noEmit && pnpm --filter frontend exec vitest run src/lib/personaPaths.test.ts`
Expected: exit 0; persona test PASS (it asserts only earn/alpha/build).

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/components/app/AppHeader.tsx frontend/src/components/tour/steps.ts
git commit -m "feat(web): surface /try in nav + add try tour"
```

---

## Task 5: Responsive e2e coverage + full verification gate

**Files:**
- Modify: `frontend/e2e/responsive.spec.ts`

- [ ] **Step 1: Find the routes list in the responsive spec.**

Run: `grep -nE '/leaderboard|/insights|routes|for \(|\[' frontend/e2e/responsive.spec.ts`
Expected: a list/array of route paths the 375px-overflow test iterates.

- [ ] **Step 2: Add `/try` to that list.** Edit the array of routes in `frontend/e2e/responsive.spec.ts` to include `"/try"` alongside the existing entries (e.g. `/leaderboard`, `/insights`, `/agent/1`). Match the existing string style exactly.

- [ ] **Step 3: Run the full frontend gate.**

Run:
```bash
pnpm --filter frontend exec tsc --noEmit
pnpm --filter frontend lint
pnpm --filter frontend exec vitest run
pnpm --filter frontend build
```
Expected: tsc exit 0; lint 0/0; vitest all green (incl. `tryState` 6 + `personaPaths`); build green with `/try` in the route list.

- [ ] **Step 4: Run Playwright responsive (best-effort; needs the dev/preview server per repo convention).**

Run: `pnpm --filter frontend test:e2e`
Expected: responsive test passes for `/try` (no horizontal overflow at 375px). If the e2e harness can't start in this environment, note it and rely on the build + the static panel markup (single-column, `max-w-2xl`, flex-wrap picker — no fixed-width grid).

- [ ] **Step 5: Commit.**

```bash
git add frontend/e2e/responsive.spec.ts
git commit -m "test(e2e): cover /try at 375px"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** route + nav/tour (Tasks 3,4); state machine disconnected/wrong-network/no-gas/ready/success (Task 3); read-only snapshot (Task 3); refresh write + receipt + before/after proof + RateLimited (Task 3); no-wallet Preview that does NOT fabricate a value (Task 3); faucet (Tasks 1,3); edge cases — no injected wallet, rejected tx, wrong network (Task 3); verification (Task 5). All covered.
- **No new contract/agent code** — reuses `compositeFeedAbi`/`categoryHash`/`env`.
- **Type consistency:** `derivePanelState`/`PanelState`/`PanelInput` (Task 2) match their use in Task 3; `TourId`/`TRY_STEPS`/`TOURS`/`TOUR_PAGES` consistent (Task 4); `explorerTx`/`faucetUrl` defined in Task 1, used in Task 3.
- **Out of scope (unchanged):** submit-prediction flow, subscription/pay, WalletConnect/mobile connectors, any redeploy.
```
