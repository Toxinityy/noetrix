# Go-to-market — first integrations (for the "demand signal" the panel flagged)

The judges/investors ding "no customer / no LOI". You don't need revenue — you need **one credible
integration or letter of intent**. This is a 15-minute conversation, not a sales cycle. Below: who to
ask, what to say, and a copy-paste LOI.

## First 5 targets (most tractable first)

1. **Mantle Foundation / ecosystem team** — present at the hackathon. They care about mETH APR + USDY
   APY (the exact metrics we forecast). Ask for a *data partnership MOU*, not cash. Unlocks credibility
   for everyone below. **Highest tractability.**
2. **Ondo / USDY vault team** — USDY is literally one of our 3 categories. Pitch: `RiskManager` +
   `YieldAllocator` read our confidence-weighted signal in one Solidity call.
3. **INIT Capital** (CDP/risk on Mantle) — risk committee is the buyer; `RiskManager.riskState` →
   collateral factor is the exact use case.
4. **Lendle / LayerBank** (lending) — deposit caps / risk params driven by the feed.
5. **mETH Protocol team** — we forecast their APR; public leaderboard endorsement + helps grow agents.

## Cold outreach message (Discord/Telegram/X DM)

> Hi — we built **Noetrix** at the Turing Test Hackathon: an on-chain benchmark that scores AI
> forecasters on Mantle (mETH APR, USDY APY, Aave TVL) — every prediction is committed *before* the
> outcome and graded on-chain, so the track record can't be faked. The top agents combine into a
> calibration-weighted **composite feed** a contract can read in one call (`CompositeFeed.read`).
>
> We'd love **[Protocol]** as a reference integration: read our feed to inform a risk parameter or
> yield allocation. Free during the hackathon + a 6-month trial. In return, a public "we're exploring
> this" / a short letter of intent. 15 min to show you the `DemoFeedConsumer`?

## Letter of intent (template — fill the brackets)

> **Letter of Intent — Noetrix feed integration**
>
> [Protocol Name] has reviewed Noetrix, an on-chain AI-forecasting benchmark on Mantle, and intends to
> evaluate integrating its composite feed (`CompositeFeed.read`) to inform [risk parameters / yield
> allocation / treasury decisions]. We will run a no-cost pilot for up to 6 months; on a demonstrated
> track record we will discuss a paid subscription.
>
> Non-binding. — [Name], [Title], [Protocol], [date]

## What to show in the 15 minutes

1. `/leaderboard` — the on-chain track record (3 agents, real scores).
2. `/agent/<id>` reasoning trace + `/try` (write to the live feed in one tx).
3. `DemoFeedConsumer.sol` — "this is the one-line read; here's where your param plugs in."
4. The two-sided model: they *consume* (subscribe later), they never stake.

## Why this is enough for the award
The panel's bar wasn't revenue — it was *evidence someone will use it*. One MOU/LOI converts
"feature" → "infrastructure someone depends on" and directly answers the investor's "no demand" pass.
