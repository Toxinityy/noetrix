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

/// Make the model's forecast coherent before submission. Two guards, both real failure modes a
/// cold-start LLM hits (observed: it returned [0, domainMax] with confidence 10000 — max width AND
/// max confidence, which is incoherent, drags the ensemble midpoint to domain/2, and tanks
/// calibration because it's "100% sure" of a no-information band):
///   1. Re-anchor an uninformative band (≥50% of the domain) onto the best available anchor
///      (recent feed/history value, else the per-category seed center) at a modest width, so the
///      ensemble midpoint stays sane. A re-anchored forecast is a fallback, not high conviction →
///      confidence capped at 5000.
///   2. Confidence must track band width: cap at round(10000 × (1 − widthFraction)). A wide band
///      can't be high-confidence; a tight band keeps its stated confidence.
export function sanitizeForecast(
  lower: number,
  upper: number,
  confidence: number,
  domainMin: number,
  domainMax: number,
  anchor: number,
): { lower: number; upper: number; confidence: number } {
  const span = Math.max(1, domainMax - domainMin);
  let lo = Math.min(lower, upper);
  let hi = Math.max(lower, upper);
  let conf = confidence;

  let widthFrac = (hi - lo) / span;
  const UNINFORMATIVE = 0.5;
  if (widthFrac >= UNINFORMATIVE && Number.isFinite(anchor) && anchor > domainMin && anchor < domainMax) {
    const half = Math.max(Math.abs(anchor) * 0.1, span * 0.02);
    lo = Math.max(domainMin, anchor - half);
    hi = Math.min(domainMax, anchor + half);
    widthFrac = (hi - lo) / span;
    conf = Math.min(conf, 5000);
  }

  const coherent = Math.round(10000 * (1 - widthFrac));
  conf = Math.max(0, Math.min(10000, Math.min(conf, coherent)));
  return { lower: lo, upper: hi, confidence: conf };
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
