import { SYSTEM_PROMPT } from "./prompt.js";

export interface ParsedForecast {
  predicted_value: { lower: number; upper: number };
  confidence: number;
  reasoning: string;
  summary?: string; // ≤140 char plain-English, Web2 reader
  confidence_rationale?: string; // one sentence on band width
}

export interface ForecastResult {
  parsed: ParsedForecast;
  rawText: string;
}

function extractJson(text: string): string {
  // Strip ```json fences if the model added them despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object in model response");
  return candidate.slice(start, end + 1);
}

function validate(obj: unknown): ParsedForecast {
  const o = obj as Record<string, unknown>;
  const pv = o.predicted_value as Record<string, unknown> | undefined;
  if (!pv || typeof pv.lower !== "number" || typeof pv.upper !== "number") {
    throw new Error("predicted_value.lower/upper missing or non-numeric");
  }
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 10000) {
    throw new Error("confidence missing or out of [0,10000]");
  }
  if (typeof o.reasoning !== "string" || o.reasoning.length === 0) {
    throw new Error("reasoning missing");
  }
  const summary =
    typeof o.summary === "string" && o.summary.trim().length > 0
      ? o.summary.trim().slice(0, 200)
      : undefined;
  const confidence_rationale =
    typeof o.confidence_rationale === "string" && o.confidence_rationale.trim().length > 0
      ? o.confidence_rationale.trim()
      : undefined;
  return {
    predicted_value: { lower: pv.lower, upper: pv.upper },
    confidence: Math.round(o.confidence),
    reasoning: o.reasoning,
    summary,
    confidence_rationale,
  };
}

/// Pure parser: raw model text → validated forecast. Extracted so it can be unit-tested
/// without a network call. Tolerates ```json fences via extractJson.
export function parseForecastText(rawText: string): ParsedForecast {
  return validate(JSON.parse(extractJson(rawText)));
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/// Call the model via OpenRouter's OpenAI-compatible Chat Completions API and parse/validate the
/// structured forecast JSON. Works with any OpenRouter-hosted model (DeepSeek, Gemma, etc.).
export async function getForecast(
  apiKey: string,
  baseUrl: string,
  model: string,
  userPrompt: string,
): Promise<ForecastResult> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Noetrix Reasoner",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as ChatCompletion;
  const rawText = (json.choices?.[0]?.message?.content ?? "").trim();
  if (!rawText) throw new Error("empty completion from model");

  const parsed = parseForecastText(rawText);
  return { parsed, rawText };
}
