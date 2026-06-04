# Try-It-Live — judge wallet interaction (`/try`)

**Date:** 2026-06-04
**Status:** Approved (brainstorming) — ready for implementation plan
**Type:** Frontend feature. No contract, agent, or indexer changes; nothing redeployed.

## Goal

Give a hackathon judge one clear place to **connect a wallet and write to the live protocol**, then see on-chain proof. The single write is `CompositeFeed.refresh(categoryId)` — permissionless (no role, one tx, cheap), already wired elsewhere. A read-only live feed view serves the majority who won't connect, and a clearly-labeled no-wallet "Preview" gives the payoff to judges who won't fund a testnet wallet.

This makes the "judges can interact with the platform" claim concrete while keeping the SubscriptionGate **open** (no paywall) per CLAUDE.md §3 invariant 14.

## Non-goals (explicitly out of scope)

- Submit-prediction / register-agent flow from the browser — too heavy for a live judging window (0.1 MNT register + commit + ~10-min reveal + later resolve). Framed instead as "our agents do this autonomously; here's the trace."
- Subscription / payment / pricing UI — gate stays open in v1.
- WalletConnect / Coinbase / mobile-QR connectors — `injected()` only (needs no projectId; most judges have MetaMask).
- Any contract, agent, indexer, or deployment change.

## Resolved decisions

1. **Shape:** a dedicated guided "Try it live" panel (not scattered affordances, not just polishing the existing demo-consumer button).
2. **Home:** a new route `frontend/src/app/(app)/try/page.tsx` + `TryClient.tsx`, linked from primary nav and the onboarding tour.
3. **Action granularity:** judge picks **one** category (mETH / USDY / AAVE) and fires **one** `refresh` tx. No "refresh all" (3 signatures is clunky; partial rate-limiting is confusing).
4. **Faucet:** `https://faucet.sepolia.mantle.xyz`, held as a configurable const in `lib/env.ts`.
5. **No-MNT fallback:** include a clearly-labeled **"Preview (no wallet)"** that shows the *current* live feed read plus a plain-English explanation of what a real refresh does (re-aggregate the top-20 agents' latest forecasts and bump `lastUpdatedBlock`). It does **not** fabricate a post-refresh value — the client cannot replicate on-chain top-20 aggregation, and inventing a number would be dishonest. Never mislabeled as a real on-chain refresh.

## UX — linear state machine

The panel always shows exactly one primary next action, derived from wallet/network/balance state. Below the panel, a read-only live snapshot of the selected category's feed (`value`, `confidence`, `contributingAgents`, `lastUpdatedBlock`) renders in every state so the page is never empty.

| State | Condition | Primary action |
|-------|-----------|----------------|
| 1. Disconnected | no account | **Connect wallet** (injected). Also: "Preview (no wallet)" secondary action. |
| 2. Wrong network | connected, `chainId != 5003` | **Switch to Mantle Sepolia** (`useSwitchChain`; if the chain is unknown to the wallet, trigger `wallet_addEthereumChain` first). |
| 3. No gas | right network, balance == 0 | "You need a little testnet MNT" + **faucet link** + **Re-check balance** (`useBalance`). |
| 4. Ready | right network, balance > 0 | category tabs + **Refresh the live AI feed** → one `writeContract` signature. |
| 5. Success | receipt mined | before→after `lastUpdatedBlock` + `contributingAgents` diff, **View your transaction** (Mantlescan link), **Refresh again** reset. |

"Preview (no wallet)" (available from state 1, or for judges with no injected wallet): shows the current `CompositeFeed.read` snapshot plus a plain-English note — "a real refresh re-aggregates the top-20 agents' latest forecasts and updates the block" — under an explicit **"Preview — not an on-chain transaction"** label. It never calls `writeContract` and never invents a post-refresh value.

## On-chain interaction

- **Read:** `CompositeFeed.read(categoryId)` (existing `compositeFeedAbi`, `categoryHash`, `env.addresses.compositeFeed`) — drives the live snapshot and the before/after diff. Re-read after a successful tx.
- **Write:** `CompositeFeed.refresh(categoryId)` via `useWriteContract` → `waitForTransactionReceipt` → re-read.
- No new ABI or contract surface; reuse `frontend/src/lib/contracts.ts`.

## Edge cases — each is an explicit inline state, never a dead end

- **No injected wallet:** show "Install MetaMask" guidance; keep the read-only view + "Preview (no wallet)". No crash.
- **`RateLimited` revert** (refresh is rate-limited ~100 blocks/category): decode it (the codebase already decodes this custom error) and show "This feed was just refreshed — wait ~N blocks or pick another category." Do not present as a failure.
- **User rejects the signature / tx reverts:** friendly retry message; state returns to Ready.
- **Wrong network after connect:** the Refresh button is disabled/replaced by the Switch action until `chainId == 5003`.
- **Balance check is advisory:** if `useBalance` is momentarily unavailable, allow the attempt and let the revert/UX handle it (don't hard-block on a flaky read).

## Files

**New**
- `frontend/src/app/(app)/try/page.tsx` — server shell + metadata.
- `frontend/src/app/(app)/try/TryClient.tsx` — client state machine.
- `frontend/src/components/try/RefreshPanel.tsx` — the guided panel (may be inlined in TryClient if small).

**Edited**
- `frontend/src/components/app/AppHeader.tsx` — add "Try it live" nav entry + `data-tour` anchor.
- tour registry / `components/tour/steps.ts` — one step pointing at the `/try` anchor.
- `frontend/src/lib/env.ts` — add `faucetUrl` const.

## Verification criteria

- `pnpm --filter frontend lint` clean, `tsc --noEmit` exit 0, `pnpm --filter frontend build` green with `/try` in the route list.
- `pnpm --filter frontend test` green (add a small unit test for any non-trivial pure helper, e.g. the wallet/network/balance → panel-state derivation).
- Playwright: `/try` renders at 375px with no horizontal overflow; the disconnected state shows Connect + the read-only snapshot.
- Manual (documented, since headless can't drive a wallet): connect → switch → refresh → tx link is the runtime path; logic verified by build/lint/test + state-machine review.

## Risks / honest caveats

- **Real refresh still needs testnet MNT + gas**, so the faucet step is load-bearing; the "Preview (no wallet)" path is the mitigation for the median unfunded judge.
- **Refresh rate-limit** means two judges in quick succession on the same category will see the rate-limited state — handled, but worth knowing during a live demo (pick different categories).
- **Wallet flows are not browser-verifiable in this headless environment** — verification is build/lint/test + state-machine review + a documented manual walkthrough, consistent with prior frontend sessions.
- Feed freshness decays now that the burst bots are stopped; a judge's refresh re-populates `lastUpdatedBlock` but the underlying ensemble only changes if agents have new revealed predictions.
