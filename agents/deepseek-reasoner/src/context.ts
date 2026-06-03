import type { PastPrediction, FeedPoint } from "./indexer.js";
import type { NewsItem } from "./news.js";

export interface ContextInput {
  categoryLabel: string;
  categoryDescription: string;
  domainMin: bigint;
  domainMax: bigint;
  bucketWidth: bigint;
  feed: FeedPoint[];
  history: PastPrediction[];
  news: NewsItem[];
}

/// Render a structured Markdown context block fed to the reasoner model as the bulk of the user prompt.
export function buildContext(input: ContextInput): string {
  const lines: string[] = [];

  lines.push(`## Category: ${input.categoryLabel}`);
  lines.push(input.categoryDescription);
  lines.push("");
  lines.push(
    `Domain: [${input.domainMin}, ${input.domainMax}] (100 buckets, width ${input.bucketWidth}). ` +
      `Your forecast band is scored with CRPS against the resolved on-chain value; a tighter band that ` +
      `contains the outcome scores best, an overconfident band that misses scores worst.`,
  );
  lines.push("");

  lines.push("## Recent composite feed values (on-chain ensemble, oldest → newest)");
  if (input.feed.length === 0) {
    lines.push("_No feed snapshots yet._");
  } else {
    for (const f of input.feed) {
      lines.push(
        `- block ${f.block}: value ${f.value}, confidence ${f.confidence} bps, ${f.contributors} contributors`,
      );
    }
  }
  lines.push("");

  lines.push("## Your recent resolved predictions (self-reflection)");
  if (input.history.length === 0) {
    lines.push("_No resolved predictions yet._");
  } else {
    for (const h of input.history) {
      const score = h.score == null ? "n/a" : `${h.score} (range −1e6…+1e6)`;
      lines.push(`- #${h.predictionId} block ${h.block}: band [${h.low}, ${h.high}], CRPS score ${score}`);
    }
  }
  lines.push("");

  lines.push("## Last 24h relevant crypto news");
  if (input.news.length === 0) {
    lines.push("_No news available (provide CRYPTOPANIC_TOKEN to enable). Reason from on-chain data alone._");
  } else {
    for (const n of input.news) {
      lines.push(`- ${n.title}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}
