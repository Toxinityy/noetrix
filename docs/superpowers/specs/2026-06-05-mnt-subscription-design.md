# Paid subscription in testnet MNT (`/pricing` + `SubscriptionGate.subscribe`)

**Date:** 2026-06-05
**Status:** Approved (brainstorming) — ready for implementation plan
**Type:** Contract change (extend + standalone redeploy of `SubscriptionGate`) + frontend pricing page. No full redeploy; existing addresses untouched.

## Goal

Turn the subscription from copy into a **real on-chain action**: a `/pricing` page where anyone (whale/trader or protocol) connects a wallet and **pays testnet MNT to subscribe** to a tier. The payment is recorded on-chain (`Subscribed` event + stored expiry) and the page shows proof (tier, expiry, Mantlescan tx). Feed reads stay **open** in v1, so paying is genuine but does not gate/break existing surfaces.

Broadens the buyer from "Mantle protocols only" to **individuals + protocols**, matching the already-retail-facing `/insights` + `/rwa` surfaces and the Alpha & Data angle.

## Non-goals

- **No feed gating.** `requiresSubscription` stays `false` for all categories; `/rwa`, `/insights`, `/demo-consumer`, `/try` reads are unaffected (avoids the audit L7 advisory-read-revert footgun).
- **No full protocol redeploy.** Only `SubscriptionGate` is redeployed (standalone); all other live addresses unchanged.
- No fiat, no recurring/auto-renew, no off-chain billing, no WalletConnect/RainbowKit (injected only, per the MVP decision).
- No change to `CompositeFeed` wiring required (the new gate need not be re-wired; reads stay open either way).

## Tiers (audience-based)

| Tier | Audience | Price (testnet MNT) | What you get (copy) |
|------|----------|---------------------|---------------------|
| **Pro / Whale** | individual traders, funds, yield farmers | **0.5 MNT** | Live AI forecast feed, all 3 categories, confidence bands, history, anomaly alerts |
| **Protocol / API** | vaults, lending markets, integrators | **2 MNT** | Everything in Pro + on-chain feed read access for contracts + API/SLA framing |

Prices are owner-settable constants kept low so judges can pay from a faucet. Period = **30 days** per `subscribe` (renew extends from current expiry).

## Contract — extend `contracts/src/SubscriptionGate.sol`

Keep all existing members (`requiresSubscription`, `subscriptionExpiry`, `setRequiresSubscription`, `setSubscription`, `hasAccess`, `ISubscriptionGate`). Add:

```solidity
enum Tier { None, Pro, Protocol }

uint64 public constant SUBSCRIPTION_PERIOD = 30 days;
uint256 public proPrice = 0.5 ether;       // testnet MNT
uint256 public protocolPrice = 2 ether;
mapping(address => Tier) public tierOf;

error BadTier();
error InsufficientPayment(uint256 required, uint256 sent);
error WithdrawFailed();

event Subscribed(address indexed subscriber, Tier tier, uint64 expiry, uint256 paid);
event PricesSet(uint256 proPrice, uint256 protocolPrice);
event Withdrawn(address indexed to, uint256 amount);

function priceOf(Tier tier) public view returns (uint256);          // Pro→proPrice, Protocol→protocolPrice, else revert BadTier
function subscribe(Tier tier) external payable;                      // see rules below
function setPrices(uint256 pro, uint256 protocol) external onlyOwner;
function withdraw(address to) external onlyOwner;                    // sends balance, reverts WithdrawFailed on failure
```

`subscribe(tier)` rules:
- `tier` must be `Pro` or `Protocol` (else `BadTier`).
- `msg.value >= priceOf(tier)` (else `InsufficientPayment`). Overpayment is accepted and kept (no refund — documented; keeps it simple and judges send exact via the UI).
- `start = max(block.timestamp, subscriptionExpiry[msg.sender])`; `expiry = start + SUBSCRIPTION_PERIOD` (renew extends).
- Write `subscriptionExpiry[msg.sender] = expiry` (reuses the existing field so `hasAccess` keeps working if a category is ever gated) and `tierOf[msg.sender] = tier`.
- Emit `Subscribed(msg.sender, tier, uint64(expiry), msg.value)`.
- Non-reentrant not required (no external call in subscribe; `withdraw` uses checks-effects + a single `call`).

`withdraw(to)`: owner-only; `to != address(0)`; sends the full contract balance via `call`; `WithdrawFailed` on failure; emits `Withdrawn`.

## Tests (TDD, `contracts/test/SubscriptionGate.t.sol` — extend or create)

1. `subscribe(Pro)` with exact value → `tierOf == Pro`, `subscriptionExpiry == now + 30d`, `Subscribed` emitted, contract balance += value.
2. `subscribe(Protocol)` with exact value → tier/expiry correct.
3. Overpayment accepted (expiry/tier set; full value kept).
4. Underpayment reverts `InsufficientPayment`.
5. `subscribe(None)` reverts `BadTier`.
6. Renew before expiry **extends** from current expiry (not from now).
7. Subscribe after expiry starts from now.
8. `setPrices` (owner) changes required value; non-owner reverts.
9. `withdraw` (owner) transfers balance to `to`; non-owner reverts; zero-address reverts.
10. Existing `hasAccess` / `setRequiresSubscription` / `setSubscription` behavior unchanged (regression).

## Deploy

- New `contracts/script/DeploySubscriptionGate.s.sol` — deploys `SubscriptionGate(deployer)`, logs the address. Run against Mantle Sepolia with the funded deployer key.
- Record the new address in `contracts/deployments/mantle-sepolia.json` (overwrite the `SubscriptionGate` entry).
- Do **not** re-wire `CompositeFeed` (reads stay open). Optional later: `compositeFeed.setSubscriptionGate(newGate)` — out of scope here.

## Frontend

**`frontend/src/lib/contracts.ts`** — add `subscriptionGateAbi` (`subscribe(uint8)` payable, `subscriptionExpiry(address)` view, `tierOf(address)` view, `proPrice`/`protocolPrice` views, `Subscribed` event, errors `BadTier`/`InsufficientPayment`) + a `SUB_TIER = { Pro: 1, Protocol: 2 }` map.

**`frontend/src/lib/env.ts`** — add `subscriptionGate: addr(process.env.NEXT_PUBLIC_ADDR_SUBSCRIPTION_GATE)` + `hasSubscriptionGate`.

**`frontend/src/app/(app)/pricing/page.tsx`** (server) + **`PricingClient.tsx`** (client):
- Two tier cards (Pro / Whale, Protocol / API) with MNT prices read on-chain (`proPrice`/`protocolPrice`) falling back to the spec constants when the gate addr isn't set.
- Each card **Subscribe** button: if disconnected → connect (injected, reuse `/try` pattern); if wrong network → switch; else `writeContractAsync subscribe{value: price}` → wait receipt → show "You're subscribed: <Tier> · expires <date>" (from `subscriptionExpiry`/`tierOf` reads) + "View tx" Mantlescan link.
- Honest banner: "Live on Mantle Sepolia testnet — pay in test MNT (free from the faucet). v1 feed reads are open; this proves the on-chain subscription rail." + faucet link.
- Errors surfaced inline (`InsufficientPayment`, user reject).

**`frontend/src/components/app/AppHeader.tsx`** — add `{ href: "/pricing", label: "Pricing" }` to `moreNav`.

## Verification

- Contracts: `forge test` green (new SubscriptionGate tests + full suite still passes).
- Deploy: `cast call` the new gate — `proPrice`/`protocolPrice` correct; a `cast send subscribe` (Pro, value 0.5 MNT) from a funded key → `subscriptionExpiry`/`tierOf` set, `Subscribed` event in the receipt.
- Frontend: `tsc --noEmit` 0, `lint` 0/0, `vitest run` green, `build` green with `/pricing` route. Add `/pricing` to the responsive e2e route list.

## Risks / honest caveats

- **Redeploying `SubscriptionGate`** gives a new address; the old gate stays wired in `CompositeFeed` (harmless — reads open). Frontend points at the new gate for subscribe.
- **Subscription is symbolic in v1** — reads aren't gated, so a subscription grants no exclusive on-chain capability yet; it's a real payment + on-chain record proving the rail. State this to judges (consistent with "gate open in v1").
- **Wallet write path not browser-verifiable headless** — contract verified by `forge test` + a `cast send`; frontend by build/lint/test + a documented manual walkthrough (same as `/try`).
- Overpayment is kept (no refund) — documented; the UI always sends exact `priceOf(tier)`.
