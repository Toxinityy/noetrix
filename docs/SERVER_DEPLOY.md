# SERVER_DEPLOY — contracts → agents → own server (Cloudflare Tunnel) → Vercel

The end-to-end go-live runbook for the chosen topology: **contracts on Mantle Sepolia,
DB on Supabase, frontend on Vercel, indexer + all 9 bots on your own server with only the
indexer exposed via a Cloudflare Tunnel.** Complements `docs/GOING_LIVE.md` (protocol detail)
— this doc is the operator path. Phases 0–3 run on your **laptop**, 4 on the **server**, 5–6 back
on the laptop.

> **The one rule that breaks everything if skipped:** NEVER run `forge script` for
> Deploy/SeedFromReal/RedeployFeed as a dry-run — even simulation overwrites
> `contracts/deployments/mantle-sepolia.json` with chainId-31337 sim addresses.
> Always pass `--broadcast`, and `git checkout -- contracts/deployments` if you slip.

---

## Phase 0 — Before anything (laptop, ~15 min)

All wallets are already funded (deployer ~1220 MNT; arima/deepseek/resolver/refresher 245+;
naive + 4 swarm wallets 2 MNT each) and all `.env` files exist in this tree. Remaining setup:

1. **Supabase**: create a project → Settings → Database → copy the **session-mode / direct
   connection string (port 5432, NOT the 6543 transaction pooler** — Ponder's migrations and
   advisory locks break under transaction pooling).
2. **Cloudflare**: have a domain on Cloudflare (free plan). You'll create the tunnel in Phase 4.
3. **Sanity gates** (all should already pass):
   ```bash
   cd contracts && forge test            # 191/191
   pnpm install && pnpm -r build         # all agent packages emit dist/
   ```

---

## Phase 1 — Deploy contracts (laptop)

```bash
cd contracts
set -a; source .env; set +a    # PRIVATE_KEY, MANTLE_SEPOLIA_RPC, ETHERSCAN_API_KEY

# Deploys all 19 contracts (incl. SentimentOracle + MarketStressMonitor), configures the
# 3 categories from config/swarm-calibration.json, seeds oracles + F&G(22), and writes
# deployments/mantle-sepolia.json (19 addresses + chainId).
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$MANTLE_SEPOLIA_RPC" --private-key "$PRIVATE_KEY" --broadcast

# Refine oracle curves + Fear&Greed from committed real data (uses ffi/curl):
forge script script/SeedFromReal.s.sol:SeedFromReal \
  --rpc-url "$MANTLE_SEPOLIA_RPC" --private-key "$PRIVATE_KEY" --broadcast --ffi

# Verify all 19 on the explorer (idempotent, safe to re-run):
export DEPLOYER=0x23015eEb4CDDBF71be80ea4259B5a32Cf1b60e60
./verify.sh
```

Record the **AgentRegistry deploy block** — you need it for the indexer:
```bash
jq -r '.receipts[0].blockNumber' broadcast/Deploy.s.sol/5003/run-latest.json
```

---

## Phase 2 — Register the 7 agents (laptop)

Each registration mints an ERC-8004 soulbound NFT (0.1 MNT fee + gas, paid by that agent's
own controller wallet) and **auto-writes the minted `AGENT_ID` back into the agent's env file**.

**Register in EXACTLY this order** — `frontend/src/lib/mockData.ts` `KNOWN_AGENTS` maps
ids 1–7 to names assuming it:

```bash
# from the repo root (the fresh deployments JSON must already be in contracts/deployments/)
pnpm --filter @predictor-index/arima-baseline   register   # → agentId 1
pnpm --filter @predictor-index/deepseek-reasoner register   # → agentId 2
pnpm --filter @predictor-index/naive-baseline    register   # → agentId 3

cd agents/swarm-runner
./run-strategy.sh mean-reversion register                   # → agentId 4
./run-strategy.sh momentum       register                   # → agentId 5
./run-strategy.sh ewma-vol       register                   # → agentId 6
./run-strategy.sh sentiment      register                   # → agentId 7
cd ../..
```

**Verify** (expect `8` = seven agents minted, and each controller bound):
```bash
REG=$(jq -r .AgentRegistry contracts/deployments/mantle-sepolia.json)
cast call "$REG" "nextAgentId()(uint256)" --rpc-url "$MANTLE_SEPOLIA_RPC"
cast call "$REG" "tokenURI(uint256)(string)" 4 --rpc-url "$MANTLE_SEPOLIA_RPC"  # spot-check a name
```
If anything minted out of order, fix the id→name map in `KNOWN_AGENTS` to match `tokenURI`.

**Gotchas (all hit before, all encoded here):**
- Register scripts run via `tsx` (no build needed), but `start` runs from `dist/` — keep
  `pnpm -r build` current.
- A failed registration mid-sequence shifts every later id — verify before moving on.
- The swarm register writes `AGENT_ID` into BOTH the shared `agents/swarm-runner/.env`
  (last-write-wins, ignored at runtime) and the authoritative `.env.<strategy>.local`
  (via `run-strategy.sh`) — the `.local` files are what pm2 reads.

---

## Phase 3 — Commit + push the deploy artifacts (laptop)

The server (and Vercel snapshot scripts) read the deployments JSON **from the repo**:

```bash
git add contracts/deployments/mantle-sepolia.json
git commit -m "chore(deploy): fresh Mantle Sepolia deployment (19 contracts, swarm live)"
git push
```

---

## Phase 4 — Server: bots + indexer + tunnel

### 4.1 Install prerequisites
```bash
# Node 22 + pnpm + pm2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs jq
npm i -g pnpm pm2
# foundry (cast, for the keeper)
curl -L https://foundry.paradigm.xyz | bash && ~/.foundry/bin/foundryup
# cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cf.deb && sudo dpkg -i cf.deb
```

### 4.2 Clone + build
```bash
git clone https://github.com/Toxinityy/noetrix.git && cd noetrix
pnpm install && pnpm -r build
```

### 4.3 Copy the secret env files from the laptop (gitignored — never in the repo)
```bash
# run FROM the laptop, in the repo root that has the live envs:
SRV=user@your-server REMOTE=~/noetrix
scp agents/arima-baseline/.env      $SRV:$REMOTE/agents/arima-baseline/.env
scp agents/naive-baseline/.env      $SRV:$REMOTE/agents/naive-baseline/.env
scp agents/deepseek-reasoner/.env   $SRV:$REMOTE/agents/deepseek-reasoner/.env
scp agents/swarm-runner/.env agents/swarm-runner/.env.*.local $SRV:$REMOTE/agents/swarm-runner/
scp agents/resolver/.env            $SRV:$REMOTE/agents/resolver/.env
scp agents/refresher/.env           $SRV:$REMOTE/agents/refresher/.env
scp indexer/.env.local              $SRV:$REMOTE/indexer/.env.local
scp deploy/keeper.env               $SRV:$REMOTE/deploy/keeper.env   # cp deploy/keeper.env.example first
```

### 4.4 Point the indexer at Supabase + the new deploy
Edit `indexer/.env.local` on the server:
```bash
DATABASE_URL=postgresql://...:5432/postgres   # Supabase SESSION-mode string (5432, not 6543)
PONDER_START_BLOCK=<AgentRegistry deploy block from Phase 1>
PONDER_RPC_URL_MANTLE_SEPOLIA=<keyed RPC>     # already in the copied file
DEPLOY_NETWORK=mantle-sepolia
```

### 4.5 Cloudflare Tunnel (indexer only — the bots are outbound-only, nothing else is exposed)
```bash
cloudflared tunnel login
cloudflared tunnel create noetrix-indexer
cloudflared tunnel route dns noetrix-indexer indexer.<yourdomain>
# fill deploy/cloudflared-config.example.yml → ~/.cloudflared/config.yml (TUNNEL_ID + hostname)
sudo cloudflared service install      # systemd service, auto-reconnect, starts on boot
```

### 4.6 Start everything
```bash
pm2 start deploy/ecosystem.config.js   # indexer + 7 agents + resolver + refresher + keeper
pm2 save && pm2 startup                 # survive reboots (run the printed sudo command)
pm2 ls && pm2 logs --lines 20
```

**Health checks:**
```bash
curl http://localhost:42069/leaderboard?category=METH_APR_24H          # local
curl https://indexer.<yourdomain>/leaderboard?category=METH_APR_24H    # through the tunnel
```
After a future contract redeploy: update the repo (`git pull`), copy new env values, then
`pm2 delete indexer && PONDER_SCHEMA=live2 pm2 start deploy/ecosystem.config.js --only indexer`
(fresh schema name each redeploy) and `pm2 restart all`.

---

## Phase 5 — Frontend on Vercel (laptop)

1. **Set env vars in the Vercel project** (Production) — values from
   `contracts/deployments/mantle-sepolia.json`:
   `NEXT_PUBLIC_ADDR_{COMPOSITE_FEED, DEMO_CONSUMER, AGENT_REGISTRY, PREDICTION_MARKET,
   YIELD_ALLOCATOR, RISK_MANAGER, SUBSCRIPTION_GATE}`, plus
   `NEXT_PUBLIC_INDEXER_URL=https://indexer.<yourdomain>`,
   `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID=5003`,
   `NEXT_PUBLIC_EXPLORER_URL=https://sepolia.mantlescan.xyz`.
   (`NEXT_PUBLIC_*` is baked at build time — env changes require a redeploy.)
2. **Let the swarm run ~1–2 h** (seed mode resolves every ~12 min), then regenerate the
   committed snapshots **before** building:
   ```bash
   pnpm --filter frontend gen:insights
   pnpm --filter frontend gen:fallback
   git add frontend/public/*.json && git commit -m "chore: post-deploy snapshots" && git push
   ```
3. Deploy: `cd frontend && pnpm dlx vercel --prod` (or Vercel's git integration).

---

## Phase 6 — Final submission gates

- [ ] Feed non-zero + fresh: `cast call <CompositeFeed> "read(bytes32)..."`; RiskManager
      `riskState` back to Normal (0) once forecasts flow.
- [ ] `https://indexer.<yourdomain>/leaderboard` returns 7 agents with climbing `resolvedCount`.
- [ ] **Make the repo public** (every doc link is dead to judges until then).
- [ ] README/SUBMISSION: fill the live URL + video TBDs; refresh the addresses table from the
      new deployments JSON; update any stale `mantle-hackathon` links to the renamed repo.
- [ ] Record the demo video (`docs/DEMO_SCRIPT.md`).
