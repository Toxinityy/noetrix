import { Agent, resolveCategory, uploadContent, type RangeValue } from "@predictor-index/sdk";
import { confidenceFromWidth } from "@predictor-index/forecasters";
import { loadConfig, type SwarmRunnerConfig, type CategorySeed } from "./config.js";
import { loadState, saveState, type AgentState } from "./state.js";
import { countResolved, fetchHistory } from "./indexer.js";
import { STRATEGIES, runStrategy, fetchFearGreed, type StrategyKey } from "./strategy.js";

const FLIP_RESOLVED_THRESHOLD = 50;
const FLIP_ELAPSED_SECONDS = 48 * 3600;
const SEED_CADENCE_MS = Number(process.env.SEED_CADENCE_MS ?? 30 * 60 * 1000); // every 30 min (env-tunable for burst runs)
const NORMAL_CADENCE_MS = 20 * 3600 * 1000; // ~daily with 4h overlap: next commit lands BEFORE the prior 24h forecast resolves, so the feed always has an in-flight Revealed prediction

/// Synthetic seed series (~15 points) for the first run when <10 real observations exist.
function syntheticSeries(seed: CategorySeed): number[] {
  const out: number[] = [];
  let v = seed.syntheticCenter;
  for (let i = 0; i < 15; i++) {
    const drift = v * (seed.syntheticDriftPpm / 1_000_000) * (Math.random() * 2 - 1);
    v = Math.max(0, v + drift);
    out.push(v);
  }
  return out;
}

function clampRange(lower: number, upper: number, min: bigint, max: bigint): RangeValue {
  let lo = BigInt(Math.max(0, Math.round(lower)));
  let hi = BigInt(Math.max(0, Math.round(upper)));
  if (hi < lo) [lo, hi] = [hi, lo];
  if (lo < min) lo = min;
  if (hi > max) hi = max;
  if (hi <= lo) hi = lo + 1n > max ? max : lo + 1n; // keep a non-degenerate band
  return { low: lo, high: hi };
}

function checkAutoFlip(state: AgentState, strategy: StrategyKey, resolvedCount: number, now: number): AgentState {
  if (state.mode === "normal") return state;
  const elapsed = now - state.seedStartTimestamp;
  if (resolvedCount >= FLIP_RESOLVED_THRESHOLD || elapsed > FLIP_ELAPSED_SECONDS) {
    console.log(
      `[${strategy}] flipping seed → normal (resolved=${resolvedCount}, elapsed=${Math.round(elapsed / 3600)}h)`,
    );
    const next: AgentState = { ...state, mode: "normal" };
    saveState(next);
    return next;
  }
  return state;
}

async function submitForCategory(
  agent: Agent,
  cfg: SwarmRunnerConfig,
  seed: CategorySeed,
  offsetBlocks: bigint,
  fg: number | undefined,
): Promise<void> {
  const cat = resolveCategory(seed.label);
  const onchain = await agent.getCategoryConfig(seed.label);
  // Fall back to the SDK static domain (never 0n) so an undefined on-chain config can't produce a
  // degenerate [0,0] band — mirrors arima-baseline.
  const domainMin = onchain.domainMin ?? cat.domainMin;
  const domainMax = onchain.domainMax ?? cat.domainMax;

  let series = await fetchHistory(cfg.indexerUrl, cfg.agentId, seed.label);
  let usedSynthetic = false;
  if (series.length < 10) {
    console.log(`[${cfg.strategy}] ${seed.label}: only ${series.length} historical points — using synthetic seed data`);
    series = syntheticSeries(seed);
    usedSynthetic = true;
  }

  const band = runStrategy(cfg.strategy, series, { domainMin: Number(domainMin), domainMax: Number(domainMax) }, fg);
  const range = clampRange(band.lower, band.upper, domainMin, domainMax);
  const confidence = confidenceFromWidth(
    Number(range.low),
    Number(range.high),
    Number(domainMin),
    Number(domainMax),
  );

  const meta = STRATEGIES[cfg.strategy];
  const content = {
    agent: `swarm-runner:${cfg.strategy}`,
    model: meta.model,
    category: seed.label,
    usedSynthetic,
    fearGreed: meta.needsFearGreed ? (fg ?? null) : undefined,
    inputSeries: series,
    forecast: { mean: band.mean, lower: band.lower, upper: band.upper, fitted: band.fitted },
    submittedRange: { low: range.low.toString(), high: range.high.toString() },
    confidenceBps: confidence,
    timestamp: new Date().toISOString(),
  };
  const { contentHash, cid } = await uploadContent(content);

  const currentBlock = await agent.publicClient.getBlockNumber();
  const resolutionBlock = currentBlock + offsetBlocks;

  console.log(
    `[${cfg.strategy}] ${seed.label}: forecast=${Math.round(band.mean)} band=[${range.low},${range.high}] ` +
      `confidence=${confidence} resBlock=${resolutionBlock}${cid ? ` cid=${cid}` : ""}`,
  );

  const result = await agent.submitFullCycle(seed.label, range, confidence, resolutionBlock, contentHash);
  console.log(
    `[${cfg.strategy}] ${seed.label}: submitted prediction ${result.predictionId} (commit ${result.commitTx.slice(0, 10)}, reveal ${result.revealTx.slice(0, 10)})`,
  );
}

async function tick(agent: Agent, cfg: SwarmRunnerConfig): Promise<number> {
  let state = loadState();
  const resolvedCount = await countResolved(cfg.indexerUrl, cfg.agentId);
  state = checkAutoFlip(state, cfg.strategy, resolvedCount, Math.floor(Date.now() / 1000));

  const offset = state.mode === "seed" ? cfg.seedOffsetBlocks : cfg.normalOffsetBlocks;
  const fg = STRATEGIES[cfg.strategy].needsFearGreed ? await fetchFearGreed() : undefined;
  console.log(
    `[${cfg.strategy}] tick — mode=${state.mode} offset=${offset} resolved=${resolvedCount}` +
      (STRATEGIES[cfg.strategy].needsFearGreed ? ` fearGreed=${fg ?? "n/a"}` : ""),
  );

  for (const seed of cfg.categories) {
    try {
      await submitForCategory(agent, cfg, seed, offset, fg);
    } catch (err) {
      console.error(`[${cfg.strategy}] ${seed.label} submission failed:`, (err as Error).message);
    }
  }

  return state.mode === "seed" ? SEED_CADENCE_MS : NORMAL_CADENCE_MS;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const agent = new Agent({
    agentId: cfg.agentId,
    controllerPrivateKey: cfg.controllerPrivateKey,
    rpcUrl: cfg.rpcUrl,
    contractAddresses: cfg.addresses,
    chainId: cfg.chainId,
  });

  console.log(
    `[${cfg.strategy}] starting — ${STRATEGIES[cfg.strategy].name} · agentId=${cfg.agentId} controller=${agent.account.address}`,
  );

  // Run forever: tick, then sleep for the cadence the current mode dictates.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let nextDelay = SEED_CADENCE_MS;
    try {
      nextDelay = await tick(agent, cfg);
    } catch (err) {
      console.error(`[${cfg.strategy}] tick failed:`, (err as Error).message);
    }
    console.log(`[${cfg.strategy}] next tick in ${Math.round(nextDelay / 60000)} min`);
    await new Promise((r) => setTimeout(r, nextDelay));
  }
}

main().catch((err) => {
  console.error("[swarm-runner] fatal:", (err as Error).message);
  process.exit(1);
});
