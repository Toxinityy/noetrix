import { FRIENDLY_CATEGORY, friendlyValue } from "@/lib/labels";
import type { CategoryId } from "@/lib/mockData";

export interface NarrateInput {
  predictionId: number;
  agentKind: "ARIMA" | "CLAUDE" | "QUANT" | "ENSEMBLE";
  category: CategoryId;
  low: number;
  high: number;
  confidence: number; // bps
  accuracyScore: number; // -1e6..1e6
}

const cache = new Map<number, string>();

/** Test-only cache reset. */
export function _clearCache(): void {
  cache.clear();
}

/** Build the plain-English narration prompt for a single forecast. */
export function buildNarrationPrompt(i: NarrateInput): string {
  const friendly = FRIENDLY_CATEGORY[i.category];
  return [
    `An AI forecaster (${i.agentKind}) predicts ${friendly} will be between ` +
      `${friendlyValue(i.category, i.low)} and ${friendlyValue(i.category, i.high)} next day, ` +
      `with ${(i.confidence / 100).toFixed(0)}% confidence.`,
    `Explain this forecast to someone new to crypto in 1–2 short sentences, in plain English.`,
    `No jargon (do not say bps, CRPS, composite feed, calibration). Use % or $ naturally.`,
    `Reply with the explanation only.`,
  ].join(" ");
}

/** Deterministic fallback if the model is unavailable. */
export function fallbackNarration(i: NarrateInput): string {
  const friendly = FRIENDLY_CATEGORY[i.category];
  return `This AI's forecast expects ${friendly} between ${friendlyValue(i.category, i.low)} and ${friendlyValue(i.category, i.high)} next day.`;
}

/** Narrate with an injected model fetcher (prompt → text). Caches by predictionId; never throws. */
export async function narrateWith(
  i: NarrateInput,
  fetcher: (prompt: string) => Promise<string>,
): Promise<string> {
  const hit = cache.get(i.predictionId);
  if (hit) return hit;
  let out: string;
  try {
    out = (await fetcher(buildNarrationPrompt(i))).trim() || fallbackNarration(i);
  } catch {
    out = fallbackNarration(i);
  }
  cache.set(i.predictionId, out);
  return out;
}

/** Real OpenRouter→DeepSeek fetcher (server-side only). */
export function openRouterFetcher(): (prompt: string) => Promise<string> {
  return async (prompt: string) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    const model = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Noetrix Insights",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.5,
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  };
}
