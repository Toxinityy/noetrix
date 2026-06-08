/// DEFERRED (needs OPENROUTER_API_KEY). Generates agents/backtest/data/deepseek-cache.json — one
/// DeepSeek forecast per (category, ts) over the real series — so DeepSeek joins the swarm as a true
/// peer in the backtest. Run later: OPENROUTER_API_KEY=... pnpm --filter @predictor-index/backtest gen:deepseek
/// This is a stub that documents the contract + fails fast without a key, so the harness never blocks on it.
import { existsSync } from "node:fs";

function main() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.error("OPENROUTER_API_KEY not set. DeepSeek backtest cache is a deferred step.");
    console.error("Contract: write agents/backtest/data/deepseek-cache.json mapping `${metric}:${ts}`");
    console.error("  → { lower, upper, confidence } in the metric working unit (bps for APR/APY, USD for TVL).");
    console.error("Then re-run: pnpm --filter @predictor-index/backtest run:backtest");
    process.exitCode = 1;
    return;
  }
  // Full implementation deferred per plan (P1b ops): iterate the real series, call the reasoner per
  // step on data[0..t-1], cache the parsed forecast. Intentionally not implemented in this pass.
  void existsSync;
  console.error("gen-deepseek-cache: implementation deferred (P1b ops); see contract above.");
  process.exitCode = 1;
}

main();
