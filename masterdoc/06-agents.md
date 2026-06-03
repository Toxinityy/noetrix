# 06 — Agents

Four TypeScript workspace packages. All depend on `@predictor-index/sdk` (except sdk itself).

## agents/sdk

**Purpose:** Shared TypeScript SDK. viem-based contract bindings, commit-reveal helpers, gas + retry policies, nonce caching for batch submission.

**Planned exports (Prompt 9 Part A):**

```ts
// Base class
export class Agent {
  constructor(opts: {
    agentId: number;
    controllerPrivateKey: `0x${string}`;
    rpcUrl: string;
    contractAddresses: AddressMap;
  });

  // Two-phase API
  commit(categoryId: bytes32, value: bytes, confidence: number, resolutionBlock: bigint, contentHash: bytes32): Promise<predictionId>;
  reveal(predictionId: bigint): Promise<void>;  // auto-times based on REVEAL_DELAY/WINDOW

  // Convenience: schedules reveal after delay
  submitFullCycle(categoryId, value, confidence, resolutionBlock, contentHash): Promise<predictionId>;
}

// Helpers
export function getCategoryConfig(categoryId: bytes32): CategoryConfig;
export type CategoryConfig = { minStake: bigint; allowedWindowStart: bigint; allowedWindowEnd: bigint; configBytes: bytes };
```

**Internals:** viem client + automatic gas estimation + retry-on-transient-failure (max 3 attempts) + nonce caching.

**Current state:** `src/index.ts` exports `PREDICTOR_SDK_VERSION = "0.1.0"` only. `pnpm -C agents/sdk build` works.

## agents/arima-baseline

**Purpose:** ARIMA(1,1,1) baseline forecasting agent. Reference accuracy floor; demonstrates the protocol works without LLM dependency.

**Schedule:** every 6h per category (normal mode), every 30 min per category (SEED_MODE).

**Pipeline (Prompt 9 Part B):**
1. Pull last 30 days of category outcomes from indexer.
2. Fit ARIMA(1,1,1) via `arima` npm package OR Python sidecar via `child_process`.
3. Predict mean + 95% CI for `resolutionBlock` ~24h ahead.
4. ABI-encode the range as `bytes` (lower bucket, upper bucket per category schema).
5. Confidence: fixed at 5000 bps.
6. `contentHash`: hash of input data + model spec; upload to IPFS via web3.storage.
7. Call `sdk.submitFullCycle()`.

**SEED_MODE:** state in `agent.state.json` at agent root. On every schedule tick, poll indexer for `resolvedCount >= 50` OR `48h elapsed since seedStartTimestamp` — flip to normal mode if either true. In SEED_MODE, `resolutionBlock = currentBlock + 350` (~12 min on 2s blocks).

**Current state:** placeholder `src/index.ts` only. deps: `@predictor-index/sdk`, `viem`, `dotenv`. devDeps: `tsx`, `typescript`.

## agents/deepseek-reasoner

**Purpose:** Demo highlight. DeepSeek-powered reasoning agent (OpenRouter). Each prediction stores full prompt + response + parsed forecast to IPFS as the `contentHash`. Frontend renders this on `/agent/[id]` expandable rows.

**Schedule:** same as ARIMA. SEED_MODE flip identical.

**Pipeline (Prompt 10):**
1. Build context: last 7d category outcomes from indexer + last 24h crypto news from cryptopanic.com → Markdown context block.
2. Call DeepSeek via OpenRouter (`deepseek/deepseek-chat-v3.1`).
3. Request structured JSON: `{ predicted_value: {lower, upper}, confidence: 0-10000, reasoning: string }`.
4. Validate JSON shape.
5. Upload full prompt + response + parsed forecast to IPFS → `contentHash`.
6. Call `sdk.submitFullCycle()`.

**System prompt anchor:**
> "You are a forecasting agent for Mantle ecosystem metrics. Your reputation depends on calibrated forecasts. Overconfidence will harm your calibration score; underconfidence will harm your accuracy ranking. Produce honest, well-reasoned predictions."

**Few-shot examples:** `agents/deepseek-reasoner/fewshot/*.json`. **HAND-WRITTEN Day-9 deliverable** — NOT auto-generated. 2-3 examples showing: observed data → hypothesis → forecast range → confidence with justification. Concatenated into user prompt.

**Current state:** built + few-shot examples present. deps: `@predictor-index/sdk`, `viem`, `dotenv` (OpenRouter via fetch — no LLM SDK).

## agents/refresher

**Purpose:** Cron worker calling `CompositeFeed.refresh(categoryId)` every ~5 min per active category. Spec'd in PRD §7.5.3.

**Why separate worker:** `refresh()` has no caller incentive in v1; permissionless refresh would never get called. Cron solves it. Hot wallet (`REFRESHER_PRIVATE_KEY`) funded with small MNT balance, separate from agent keys.

**Idempotency:** `CompositeFeed.refresh` reverts if called within 100 blocks of last refresh; cron just catches and continues.

**Fallback:** `/demo-consumer` page has a manual "Refresh feed now" button per category (wagmi-wired) for demo-day safety.

**Hosting decision pending:** Railway cron, Vercel cron, or GitHub Actions. Decide before Prompt 11.

**Current state:** placeholder `src/index.ts` only.

## Registration flow (common)

Per agent, run once before scheduling:

```bash
pnpm -C agents/arima-baseline register   # or deepseek-reasoner
```

`scripts/register.ts`:
1. Build metadata JSON per PRD §8.1.1.
2. Upload to IPFS via web3.storage.
3. Call `AgentRegistry.register(uri)` with 0.1 MNT fee.
4. Save returned `agentId` to package's local `.env`.

## Env vars per agent

```
PRIVATE_KEY=                    controller private key
AGENT_ID=                       set after register
RPC_URL=                        Mantle Sepolia/mainnet RPC
INDEXER_URL=                    e.g. https://predictor-index-indexer.up.railway.app
WEB3_STORAGE_TOKEN=             for IPFS uploads
OPENROUTER_API_KEY=             deepseek-reasoner only
CRYPTOPANIC_API_KEY=            deepseek-reasoner only (optional)
```

## Deployment options

- **GitHub Actions scheduled workflow** — simplest, free tier sufficient for hackathon, but hidden cold-start latency.
- **Railway-hosted Node service** — runs continuously, clean logs, ~$5/mo each.
- Pick before Prompt 9 (ARIMA) deploy.
