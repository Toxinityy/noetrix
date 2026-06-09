import type { CategoryResult, StressLevel } from "./types.js";
import { buildErrByAgent, correlationMatrix } from "./metrics.js";

/// Render a human-readable markdown report. Honest about thin data (notes when test steps are few).
export function renderReport(results: CategoryResult[]): string {
  const lines: string[] = ["# Backtest Report", ""];
  for (const r of results) {
    lines.push(`## ${r.metric}`, "");
    lines.push(`- disagreeScale (tuned on train): ${r.disagreeScale}`);
    lines.push(`- steps: ${r.trainSteps} train / ${r.testSteps} test`);
    if (r.testSteps < 20) lines.push(`- ⚠️ thin test window (${r.testSteps} steps) — treat metrics as illustrative.`);
    lines.push("", "| agent | accuracy | calibration | resolved | mean test score |", "|---|---:|---:|---:|---:|");
    for (const a of [...r.agents].sort((x, y) => y.meanScore - x.meanScore)) {
      lines.push(`| ${a.label} | ${a.accuracy} | ${a.calibration} | ${a.resolved} | ${Math.round(a.meanScore)} |`);
    }
    // Diversity: pairwise error correlation over the test window.
    const errByAgent = buildErrByAgent(r);
    const corr = correlationMatrix(errByAgent);
    lines.push("", "### Inter-agent error correlation (diversity proof)", "");
    lines.push("| | " + corr.keys.join(" | ") + " |");
    lines.push("|---|" + corr.keys.map(() => "---:").join("|") + "|");
    corr.matrix.forEach((row, i) => {
      lines.push(`| ${corr.keys[i]} | ` + row.map((v) => v.toFixed(2)).join(" | ") + " |");
    });
    // Stress over test window.
    const stressCounts: Record<StressLevel, number> = { Calm: 0, Elevated: 0, Stressed: 0 };
    for (const s of r.steps) stressCounts[s.stress.level]++;
    lines.push("", `Stress distribution: Calm ${stressCounts.Calm} · Elevated ${stressCounts.Elevated} · Stressed ${stressCounts.Stressed}`, "");
  }
  return lines.join("\n");
}
