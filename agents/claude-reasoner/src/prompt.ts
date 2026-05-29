import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface FewShotExample {
  category: string;
  context: string;
  reasoning: string;
  predicted_value: { lower: number; upper: number };
  confidence: number;
}

export const SYSTEM_PROMPT =
  "You are a forecasting agent for Mantle ecosystem metrics. Your reputation depends on calibrated " +
  "forecasts. Overconfidence will harm your calibration score; underconfidence will harm your accuracy " +
  "ranking. Both your accuracy and your calibration score are PUBLIC on-chain — be honest about your " +
  "uncertainty. Produce well-reasoned predictions. Respond with ONLY a single JSON object, no prose " +
  "outside it.";

const FEWSHOT_DIR = resolve(process.cwd(), "fewshot");

/// Load hand-written few-shot examples (fewshot/*.json) for a category. These are the Day-9
/// deliverable that makes cold-start outputs non-bland (§8.3 Part B).
export function loadFewShot(categoryLabel: string): FewShotExample[] {
  let files: string[];
  try {
    files = readdirSync(FEWSHOT_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: FewShotExample[] = [];
  for (const f of files) {
    try {
      const ex = JSON.parse(readFileSync(resolve(FEWSHOT_DIR, f), "utf8")) as FewShotExample;
      if (ex.category === categoryLabel) out.push(ex);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/// Assemble the user prompt: few-shot examples + the live context + a strict output contract.
export function buildUserPrompt(context: string, examples: FewShotExample[]): string {
  const parts: string[] = [];

  if (examples.length > 0) {
    parts.push("# Worked examples of well-reasoned forecasts\n");
    examples.forEach((ex, i) => {
      const response = JSON.stringify(
        {
          predicted_value: ex.predicted_value,
          confidence: ex.confidence,
          reasoning: ex.reasoning,
        },
        null,
        2,
      );
      parts.push(`## Example ${i + 1}\n\nContext:\n${ex.context}\n\nResponse:\n${response}\n`);
    });
  }

  parts.push("# Your turn\n");
  parts.push("Using the context below, produce a forecast for the NEXT resolution of this category.\n");
  parts.push(context);
  parts.push(
    "\n# Output contract\n" +
      "Respond with ONLY this JSON object (no markdown fences, no commentary):\n" +
      "{\n" +
      '  "predicted_value": { "lower": <integer in domain units>, "upper": <integer in domain units> },\n' +
      '  "confidence": <integer 0-10000 basis points, your honest probability the outcome lands in the band>,\n' +
      '  "reasoning": "<concise justification: what you observed, your hypothesis, why this band and confidence>"\n' +
      "}\n" +
      "lower and upper MUST be integers within the domain, lower <= upper. Pick a band you genuinely " +
      "believe contains the outcome with probability ≈ confidence/10000.",
  );

  return parts.join("\n");
}
