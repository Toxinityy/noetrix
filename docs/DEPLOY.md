# DEPLOY — go-live runbook

The code is done and tested (169 forge tests · frontend tsc/lint/vitest green · build green). What's left to be
submission-ready is **operational**, and almost all of it needs your keys / accounts / machine. This is the
ordered checklist. Each step says *why* and flags the gotchas that have bitten this project before.

Authoritative addresses live in [`../contracts/deployments/mantle-sepolia.json`](../contracts/deployments/mantle-sepolia.json)
(chainId 5003). Current live deployment is healthy **only while bots run** — see Step 2.

---

## 0. Prerequisites (gather once)

| Need | For |
|------|-----|
| Funded deployer key `PRIVATE_KEY` (with `0x`) | redeploys (Steps 1) |
| `ETHERSCAN_API_KEY` (an **etherscan.io V2** key — multichain) | contract verification (Step 3) |
| `MANTLE_SEPOLIA_RPC` (a paid Alchemy/Infura URL recommended; public `rpc.sepolia.mantle.xyz` throttles) | all on-chain steps |
| Funded controller hot-wallets for arima / reasoner / naive / resolver / refresher | bot restart (Step 4) |
| `OPENROUTER_API_KEY` | reasoner agent + `/api/narrate` |
| Vercel account | frontend deploy (Step 6) |
| GitHub repo owner access | make repo public (Step 7) |

> ⚠️ **Recurring gotcha — `0x` prefix.** Every private key (deployer + all bot controllers) must be the full
> 66-char `0x…` form. A bare 64-hex key makes `vm.envUint` / viem `privateKeyToAccount` revert. This has bitten
> every prior deploy session.

---

## 1. Redeploy CompositeFeed + consumers (the "hold-last-good" fix)  ⏱ ~5 min

**Why.** The live `CompositeFeed` (`0xc962011f…`) is the OLD contract — it predates the hold-last-good fix and
overwrites the published value with **zero** the moment every top agent's latest prediction resolves (i.e. whenever
bots pause). Verified by bytecode: the deployed code lacks the `CompositeFeedStale` event. The fixed source is in
`contracts/src/CompositeFeed.sol`.

**The trap this script handles for you.** `DemoFeedConsumer`, `YieldAllocator`, and `RiskManager` each hold the feed
as `ICompositeFeed public immutable feed` with **no setter** — so redeploying CompositeFeed alone leaves all three
reading the old broken feed. `RedeployFeed.s.sol` therefore redeploys the feed **and** all three consumers, re-wires
the feed, re-registers RiskManager's two assets (mETH 80% CF / USDY 90% CF, $1B caps), and patches only the 4 changed
addresses into the deployments JSON (the other 13 contract addresses + chainId are preserved).

```bash
cd contracts
forge script script/RedeployFeed.s.sol:RedeployFeed \
  --rpc-url $MANTLE_SEPOLIA_RPC --private-key $PRIVATE_KEY \
  --broadcast --verify          # --verify auto-verifies the 4 NEW contracts if ETHERSCAN_API_KEY is set
```

The script writes the new addresses as ready-to-paste env lines to
`contracts/deployments/mantle-sepolia-redeploy-env.txt` (and also logs them). Copy those into Steps 4 and 6.

> ⚠️ **Indexer is NOT "just a restart" after a feed-address change.** The indexer reads addresses from the deployments
> JSON (no manual edit), but Ponder caches by contract config: start it with a **fresh `--schema liveN` name AND clear
> `indexer/.ponder/`**, or a same-schema restart can keep indexing the OLD feed's events. Also raise `PONDER_START_BLOCK`
> toward the new deploy block so it doesn't re-scan from the old start.

---

## 2. (Why the live feed currently "works" — and why that's fragile)

Right now the feed reads non-zero (mETH ~2500 bps, etc.) **only because the bots last ran a few hours ago**. With the
OLD contract still live, if bots stay stopped the feed decays and then zeroes — cascading to
`DemoFeedConsumer.shouldAllowDeposits()=false`, `RiskManager`→Frozen, `YieldAllocator`→50/50. Step 1 (redeploy) +
Step 4 (restart bots) together make it durably non-zero. Do not demo on the old contract with bots down.

---

## 3. Verify all contracts on the explorer  ⏱ ~10 min

**Why.** The "verifiable / every decision on-chain" thesis breaks if a judge clicks an explorer link and finds
unverified source. Mantlescan's V1 API is dead; verify via the Etherscan V2 multichain endpoint (already configured in
`foundry.toml [etherscan]`).

```bash
cd contracts
export ETHERSCAN_API_KEY=...        # etherscan.io V2 key
export DEPLOYER=0x...               # the address that deployed the contracts
./verify.sh
```

`verify.sh` is idempotent (re-verifying an already-verified contract is a no-op) and reads addresses + constructor
args from the deployments JSON. It covers all 16 deployed contracts, including the 4 from Step 1 — and it is the
**authoritative** pass: Step 1's `--verify` only covers the 4 new contracts and can fail silently mid-broadcast, so
run `verify.sh` regardless.

---

## 4. Restart the agents + keeper bots  ⏱ ~10 min + accrual time

**Why.** Bots are currently stopped (no processes, no hosting). Restarting them gets fresh `Revealed` predictions per
category, then `refresh()` republishes a non-zero feed and the leaderboard climbs past the `resolvedCount ≥ 10`
"calibrating" threshold.

Per `agents/*/.env.example`, set each controller key + RPC + indexer URL, then **build before run** (dist is
gitignored, and the reasoner's cold-start sanitization fix lives in `src` — a stale dist would re-introduce the
mETH-186% blowup):

```bash
pnpm --filter @predictor-index/arima-baseline    --filter @predictor-index/naive-baseline \
     --filter @predictor-index/deepseek-reasoner  --filter @predictor-index/refresher \
     --filter @predictor-index/resolver build
# then run each (its own terminal / background), e.g.:
cd agents/arima-baseline && pnpm start
```

> ⚠️ **Gotchas (all have bitten before):**
> - **Reasoner / naive env.** The reasoner's only `.env` (with its `AGENT_ID=2` controller key + `OPENROUTER_API_KEY` +
>   `PINATA_JWT`) currently lives in the **stale `agents/claude-reasoner/` dir**, and `agents/deepseek-reasoner/.env`
>   does not exist. `agents/naive-baseline/.env` (AGENT_ID=3) likewise needs creating. Recreate/move these from the
>   stale dir + `.env.example` before running — don't delete `agents/claude-reasoner/` until its key is safe elsewhere.
> - **Delete `agents/resolver/resolver.state.json` after any redeploy** — a stale `cursor` skips fresh predictions.
> - The naive agent (id 3) currently only has mETH history; run it on AAVE + USDY too for a clean 3-category benchmark.
> - Bots run on your machine and die when it sleeps. For an unattended demo, host them (Railway/GH Actions) or keep the
>   box awake. The Ponder indexer is the same story (local PGlite is fragile for sustained runs → Railway + Postgres
>   via the existing `DATABASE_URL` hook).

---

## 5. Regenerate the committed snapshots  ⏱ ~2 min

**Why.** With no hosted indexer, `/leaderboard`, `/insights`, `/category` serve committed real-chain snapshots. Refresh
them right before recording so they match live chain.

```bash
cd frontend
CHAIN_RPC=$MANTLE_SEPOLIA_RPC pnpm gen:fallback   # -> public/fallback-leaderboard.json
CHAIN_RPC=$MANTLE_SEPOLIA_RPC pnpm gen:insights   # -> public/insights-snapshot.json
```

> ⚠️ **Run this BEFORE the Step 6 build.** `/api/leaderboard` statically imports the snapshot JSON at build time and
> `public/*.json` is baked per Vercel deployment, so regenerating the snapshots *after* the build has no effect until you
> redeploy. Regenerate → then build/deploy.

---

## 6. Deploy the frontend (Vercel)  ⏱ ~10 min

**Why.** This is the biggest single gap: a judge has no public URL to click. `next build` is already green.

1. Set env on the Vercel project (mirror `frontend/.env.example`):
   - `NEXT_PUBLIC_ADDR_*` — all of them, incl. the new feed/consumer addresses from Step 1 and
     `NEXT_PUBLIC_ADDR_SUBSCRIPTION_GATE=0x0b759e12Baedbb30891666193D33d689F5c23373` (activates the `/pricing` premium gate).
   - `NEXT_PUBLIC_RPC_URL` — your paid RPC.
   - `NEXT_PUBLIC_INDEXER_URL` — **leave BLANK** unless you hosted the indexer (Step 4); a dead URL silently degrades
     live surfaces to the snapshot tier.
   - `OPENROUTER_API_KEY` (server-only, not `NEXT_PUBLIC`) — enables `/api/narrate`.
2. Deploy. NEXT_PUBLIC_* are baked at build, so any later address change needs a re-deploy.
3. Put the URL into `README.md` "Live links" + `docs/SUBMISSION.md` "Links".

---

## 7. Submission finishers (owner actions)

- [ ] **Make the GitHub repo public** — it is currently PRIVATE, so every doc link to
      `github.com/Toxinityy/mantle-hackathon` is dead for judges and the "open-source repo" criterion fails:
      `gh repo edit Toxinityy/mantle-hackathon --visibility public`.
- [ ] **Record the ≥2-min demo video** from [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) (do this after Steps 1–6 so the live tabs
      are real). Put the link in README + SUBMISSION.
- [ ] **Fill the remaining `_TBD_`** in `README.md` / `docs/SUBMISSION.md`: live frontend URL, indexer URL (if hosted),
      demo video link.
- [ ] *(Stretch, Grand Champion)* secure one soft LOI from a Mantle protocol using `docs/GO_TO_MARKET.md`.

---

## Quick reference — current live addresses (Mantle Sepolia 5003)

| Contract | Address |
|---|---|
| AgentRegistry | `0xf43f5b4E7Ab1F4dd69E35974Bc2fB47AC0311349` |
| PredictionMarket | `0x0d94D70422d4B64678b60fbC7133C390dB46049C` |
| ResolutionEngine | `0xBe54a6E94f4C869bE2364b75aC45CF628389Aa42` |
| ScoringEngine | `0x0Fe3Df085f516e117C120160F7c8552af39EB76C` |
| RangeCrpsScorer | `0x04895b8aB9fdE8dcd2eE3F44bF9fb0cb506a6C0c` |
| BonusDistributor | `0xFdC62165DCA68A9D6A1570EDf5AE0EDe606E191F` |
| SubscriptionGate | `0x0b759e12Baedbb30891666193D33d689F5c23373` |
| CompositeFeed *(redeploy in Step 1)* | `0xc962011fd96527022e034a2cd715ccAb5bDe1331` |
| DemoFeedConsumer *(redeploy in Step 1)* | `0x85F0cb237FF30600Bee7Cd2D260493a5bd795B8A` |
| YieldAllocator *(redeploy in Step 1)* | `0x3dde2344b3aE6ca8D72183f00c5C25a48528AFA3` |
| RiskManager *(redeploy in Step 1)* | `0x2bFC256176139936F1F73cfC6e3108824363CF9d` |

(Resolvers + oracles are in the deployments JSON; unchanged by Step 1.)
