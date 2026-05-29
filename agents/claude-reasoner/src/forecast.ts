import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt.js";

export interface ParsedForecast {
  predicted_value: { lower: number; upper: number };
  confidence: number;
  reasoning: string;
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
  return {
    predicted_value: { lower: pv.lower, upper: pv.upper },
    confidence: Math.round(o.confidence),
    reasoning: o.reasoning,
  };
}

/// Call Claude and parse/validate the structured forecast JSON.
export async function getForecast(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<ForecastResult> {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const parsed = validate(JSON.parse(extractJson(rawText)));
  return { parsed, rawText };
}
