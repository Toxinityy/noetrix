import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { Agent, resolveCategory, uploadContent, type RangeValue } from "@predictor-index/sdk";
import { loadConfig, type ReasonerConfig, type CategoryDef } from "./config.js";
import { loadState, saveState, type AgentState } from "./state.js";
import { countResolved, fetchAgentHistory, fetchFeedHistory } from "./indexer.js";
import { fetchNews } from "./news.js";
import { buildContext } from "./context.js";
import { loadFewShot, buildUserPrompt } from "./prompt.js";
import { getForecast, sanitizeForecast } from "./forecast.js";

const FLIP_RESOLVED_THRESHOLD = 50;
const FLIP_ELAPSED_SECONDS = 48 * 3600;
const SEED_CADENCE_MS = Number(process.env.SEED_CADENCE_MS ?? 30 * 60 * 1000); // env-tunable for burst runs
const NORMAL_CADENCE_MS = 24 * 3600 * 1000; // daily (sustainable steady-state; the metric horizon is 24h)
const LOG_FILE = resolve(process.cwd(), "reasoner.log.jsonl");

function logLine(entry: Record<string, unknown>): void {
  try {
    appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    /* logging is best-effort */
  }
}

function clampRange(lower: number, upper: number, min: bigint, max: bigint): RangeValue {
  let lo = BigInt(Math.max(0, Math.round(lower)));
  let hi = BigInt(Math.max(0, Math.round(upper)));
  if (hi < lo) [lo, hi] = [hi, lo];
  if (lo < min) lo = min;
  if (hi > max) hi = max;
  if (hi <= lo) hi = lo + 1n > max ? max : lo + 1n;
  return { low: lo, high: hi };
}

function checkAutoFlip(state: AgentState, resolvedCount: number, now: number): AgentState {
  if (state.mode === "normal") return state;
  const elapsed = now - state.seedStartTimestamp;
  if (resolvedCount >= FLIP_RESOLVED_THRESHOLD || elapsed > FLIP_ELAPSED_SECONDS) {
    console.log(
      `[reasoner] flipping seed → normal (resolved=${resolvedCount}, elapsed=${Math.round(elapsed / 3600)}h)`,
    );
    const next: AgentState = { ...state, mode: "normal" };
    saveState(next);
    return next;
  }
  return state;
}

async function submitForCategory(
  agent: Agent,
  cfg: ReasonerConfig,
  cat: CategoryDef,
  offsetBlocks: bigint,
): Promise<void> {
  const sdkCat = resolveCategory(cat.label);
  const onchain = await agent.getCategoryConfig(cat.label);
  const domainMin = onchain.domainMin ?? sdkCat.domainMin;
  const domainMax = onchain.domainMax ?? sdkCat.domainMax;
  const bucketWidth = (domainMax - domainMin) / BigInt(sdkCat.bucketCount);

  const [feed, history, news] = await Promise.all([
    fetchFeedHistory(cfg.indexerUrl, cat.label),
    fetchAgentHistory(cfg.indexerUrl, cfg.agentId, cat.label),
    fetchNews(cat.newsCurrencies, cfg.cryptoPanicToken),
  ]);

  const context = buildContext({
    categoryLabel: cat.label,
    categoryDescription: cat.description,
    domainMin,
    domainMax,
    bucketWidth,
    feed,
    history,
    news,
  });
  const examples = loadFewShot(cat.label);
  const userPrompt = buildUserPrompt(context, examples);

  const { parsed, rawText } = await getForecast(cfg.llmApiKey, cfg.llmBaseUrl, cfg.model, userPrompt);

  // Anchor of last resort for an uninformative (near-full-domain) band: latest feed value, else this
  // agent's last band midpoint, else the per-category seed center. Keeps the ensemble midpoint sane
  // when the model hedges to [0, domainMax] at cold start.
  const lastFeed = feed.length > 0 ? Number(feed[feed.length - 1].value) : NaN;
  const lastHist =
    history.length > 0 ? Number((history[history.length - 1].low + history[history.length - 1].high) / 2n) : NaN;
  const anchor = Number.isFinite(lastFeed) && lastFeed > 0 ? lastFeed : Number.isFinite(lastHist) && lastHist > 0 ? lastHist : cat.seedCenter;

  const sane = sanitizeForecast(
    parsed.predicted_value.lower,
    parsed.predicted_value.upper,
    parsed.confidence,
    Number(domainMin),
    Number(domainMax),
    anchor,
  );
  const range = clampRange(sane.lower, sane.upper, domainMin, domainMax);
  const confidence = Math.max(0, Math.min(10000, sane.confidence));

  // The full provenance — prompt, raw response, parsed forecast — is the on-chain contentHash payload.
  const content = {
    agent: "deepseek-reasoner",
    model: cfg.model,
    category: cat.label,
    systemPromptIncluded: true,
    userPrompt,
    rawResponse: rawText,
    parsedForecast: parsed,
    submittedRange: { low: range.low.toString(), high: range.high.toString() },
    confidenceBps: confidence,
    newsCount: news.length,
    fewShotCount: examples.length,
    timestamp: new Date().toISOString(),
  };
  const { contentHash, cid } = await uploadContent(content);

  const currentBlock = await agent.publicClient.getBlockNumber();
  const resolutionBlock = currentBlock + offsetBlocks;

  console.log(
    `[reasoner] ${cat.label}: band=[${range.low},${range.high}] conf=${confidence}bps ` +
      `resBlock=${resolutionBlock}${cid ? ` cid=${cid}` : ""}`,
  );
  logLine({ event: "forecast", category: cat.label, parsed, range: content.submittedRange, confidence, cid });

  const result = await agent.submitFullCycle(cat.label, range, confidence, resolutionBlock, contentHash);
  console.log(
    `[reasoner] ${cat.label}: submitted prediction ${result.predictionId} ` +
      `(commit ${result.commitTx.slice(0, 10)}, reveal ${result.revealTx.slice(0, 10)})`,
  );
  logLine({ event: "submitted", category: cat.label, predictionId: result.predictionId.toString() });
}

async function tick(agent: Agent, cfg: ReasonerConfig): Promise<number> {
  let state = loadState();
  const resolvedCount = await countResolved(cfg.indexerUrl, cfg.agentId);
  state = checkAutoFlip(state, resolvedCount, Math.floor(Date.now() / 1000));

  const offset = state.mode === "seed" ? cfg.seedOffsetBlocks : cfg.normalOffsetBlocks;
  console.log(`[reasoner] tick — mode=${state.mode} offset=${offset} resolved=${resolvedCount}`);

  for (const cat of cfg.categories) {
    try {
      await submitForCategory(agent, cfg, cat, offset);
    } catch (err) {
      console.error(`[reasoner] ${cat.label} failed:`, (err as Error).message);
      logLine({ event: "error", category: cat.label, message: (err as Error).message });
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
    `[reasoner] starting — agentId=${cfg.agentId} controller=${agent.account.address} model=${cfg.model}`,
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let nextDelay = SEED_CADENCE_MS;
    try {
      nextDelay = await tick(agent, cfg);
    } catch (err) {
      console.error(`[reasoner] tick failed:`, (err as Error).message);
    }
    console.log(`[reasoner] next tick in ${Math.round(nextDelay / 60000)} min`);
    await new Promise((r) => setTimeout(r, nextDelay));
  }
}

main().catch((err) => {
  console.error("[reasoner] fatal:", (err as Error).message);
  process.exit(1);
});
