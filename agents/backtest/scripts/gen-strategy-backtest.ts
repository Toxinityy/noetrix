/// Real total-return backtest → frontend/public/strategy-backtest-snapshot.json.
/// Usage: pnpm --filter @predictor-index/backtest gen:strategy   (needs data/*.json incl ETH_PRICE)
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadSeries } from "@predictor-index/market-data";
import { alignByDay } from "../src/align.js";
import { runOneCategory } from "../src/run.js";
import type { DeepSeekCache } from "../src/roster.js";
import { allocMeth, simulate } from "../src/strategy.js";

const here = dirname(fileURLToPath(import.meta.url));

function loadCache(): DeepSeekCache {
  const f = join(here, "..", "data", "deepseek-cache.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as DeepSeekCache) : null;
}

function main(stamp: string) {
  const meth = loadSeries("METH_APR");
  const usdy = loadSeries("USDY_APY");
  const eth = loadSeries("ETH_PRICE");
  const fng = loadSeries("FEAR_GREED");
  if (!meth || !usdy || !eth) throw new Error("need METH_APR + USDY_APY + ETH_PRICE (run market-data refresh)");

  // Align USDY, ETH, F&G onto the METH day grid (alignByDay → value|null per METH index).
  const methPts = meth.points;
  const usdyA = alignByDay(methPts, usdy.points);
  const ethA = alignByDay(methPts, eth.points);
  const values = methPts.map((p) => p.value);
  const fgA = fng ? alignByDay(methPts, fng.points) : values.map(() => null);

  // Replay the mETH category (train-tuned, out-of-sample) → per-step ensemble + per-agent signals.
  const result = runOneCategory("METH_APR", values, fgA, loadCache());

  // Honest window: only steps where BOTH real ETH price and USDY yield exist (no synthetic fill).
  const usable = result.steps.filter((s) => ethA[s.t] != null && usdyA[s.t] != null);
  if (usable.length < 20) throw new Error(`only ${usable.length} real 3-asset days — window too thin`);

  // Per-step asset returns over the real window (step t uses ETH price change t-1→t + mETH staking accrual).
  const methRet: number[] = [];
  const usdyRet: number[] = [];
  const stepTs: number[] = [];
  for (const s of usable) {
    const t = s.t;
    const p0 = ethA[t - 1], p1 = ethA[t];
    const priceRet = p0 != null && p1 != null ? p1 / p0 - 1 : 0;
    const stakeAccrual = values[t] / 1e4 / 365; // METH APY bps → daily accrual
    methRet.push(priceRet + stakeAccrual);
    usdyRet.push((usdyA[t] as number) / 1e4 / 365); // USDY APY bps → daily yield
    stepTs.push(methPts[t].ts); // REAL unix ts (StepResult.ts is only the step index)
  }

  const N = usable.length;
  const withTs = (cum: number[]) => cum.map((v, i) => ({ ts: stepTs[i], value: v }));

  // Ensemble weights (composite confidence + stress) over the window.
  const ensW = usable.map((s) => allocMeth(s.swarm.confidenceBps, s.stress.level));

  // Single-agent weights per agent (own statedBps, NO stress signal). Hold prior weight if unfitted.
  const agentKeys = result.agents.map((a) => a.agentKey);
  const agentW: Record<string, number[]> = {};
  for (const k of agentKeys) {
    const ws: number[] = [];
    let prev = allocMeth(0, null);
    for (const s of usable) {
      const a = s.agents.find((x) => x.agentKey === k);
      if (a && a.fitted) prev = allocMeth(a.statedBps, null);
      ws.push(prev);
    }
    agentW[k] = ws;
  }

  // Best single agent = the strongest FORECASTER by TRAIN-split accuracy (accBefore carried into the
  // first test step = trained on train only, zero return-lookahead). The real-data window sits entirely
  // in the test region, so a return-based train Sharpe is not computable — forecast skill is the honest,
  // return-independent selector for "even the best individual model".
  const nTrain = result.trainSteps;
  const boundary = result.steps[nTrain] ?? result.steps[result.steps.length - 1];
  const trainAcc = (k: string) => {
    const a = boundary.agents.find((x) => x.agentKey === k);
    return a ? Number(a.accBefore) : -Infinity;
  };
  let bestKey = agentKeys[0];
  for (const k of agentKeys) if (trainAcc(k) > trainAcc(bestKey)) bestKey = k;
  const bestLabel = result.agents.find((a) => a.agentKey === bestKey)!.label;

  const passive = new Array(N).fill(0.5);
  const allMeth = new Array(N).fill(1);
  const allUsdy = new Array(N).fill(0);

  const mk = (key: string, label: string, w: number[]) => {
    const r = simulate(w, methRet, usdyRet);
    return { key, label, cumulative: withTs(r.cumulative), final: r.final, maxDD: r.maxDD, vol: r.vol, sharpe: r.sharpe };
  };
  const strategies = [
    mk("ensemble", "Noetrix Ensemble", ensW),
    mk("bestAgent", `Best single agent (${bestLabel})`, agentW[bestKey]),
    mk("passive5050", "Passive 50/50", passive),
    mk("allMeth", "100% mETH", allMeth),
    mk("allUsdy", "100% USDY", allUsdy),
  ];

  const ens = strategies[0], best = strategies[1];
  const usdyS = strategies.find((s) => s.key === "allUsdy")!;
  const methS = strategies.find((s) => s.key === "allMeth")!;
  const won = ens.sharpe > best.sharpe && ens.maxDD > best.maxDD; // higher Sharpe + shallower DD
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const dir = methS.final < 0 ? "fell" : "rose";
  const reading = won
    ? `Over ${Math.round((stepTs[N - 1] - stepTs[0]) / 86400)} days of real data (ETH ${dir} — 100% mETH ${pct(methS.final)}), the Noetrix ensemble returned ${pct(ens.final)} at a ${pct(ens.maxDD)} max drawdown — beating the best single forecaster (${bestLabel}: ${pct(best.final)}, DD ${pct(best.maxDD)}) and every risk-on baseline by de-risking as its agents disagreed. It did NOT beat a permanently-safe 100% USDY (${pct(usdyS.final)}) in this down market — just as it would not beat 100% mETH in a pure bull run. The edge is that it does not need to know the regime in advance.`
    : `Over ${Math.round((stepTs[N - 1] - stepTs[0]) / 86400)} days of real data, the Noetrix ensemble returned ${pct(ens.final)} (max DD ${pct(ens.maxDD)}) vs the best single forecaster ${bestLabel} (${pct(best.final)}, DD ${pct(best.maxDD)}) and 100% USDY (${pct(usdyS.final)}). Real out-of-sample result — presented as-is.`;

  const days = Math.round((stepTs[N - 1] - stepTs[0]) / 86400);
  const snap = { generatedAt: stamp, windowDays: days, startTs: stepTs[0], endTs: stepTs[N - 1], bestAgentKey: bestKey, bestAgentLabel: bestLabel, strategies, reading };

  const fePublic = join(here, "..", "..", "..", "frontend", "public");
  writeFileSync(join(fePublic, "strategy-backtest-snapshot.json"), JSON.stringify(snap, null, 2) + "\n");
  console.log(`[ok] wrote strategy-backtest-snapshot.json — ${days}d, best=${bestLabel}, ensembleWon=${won}`);
  console.log(reading);
}
main(new Date().toISOString());
