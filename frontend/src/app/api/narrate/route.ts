import { NextResponse } from "next/server";
import { narrateWith, openRouterFetcher, fallbackNarration, type NarrateInput } from "@/lib/narrate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<NarrateInput>;
  try {
    body = (await req.json()) as Partial<NarrateInput>;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (
    typeof body.predictionId !== "number" ||
    typeof body.low !== "number" ||
    typeof body.high !== "number" ||
    !body.category ||
    !body.agentKind
  ) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const input = body as NarrateInput;
  // If no key configured, return the deterministic fallback (still useful, no 500).
  const summary = process.env.OPENROUTER_API_KEY
    ? await narrateWith(input, openRouterFetcher())
    : fallbackNarration(input);
  return NextResponse.json({ summary });
}
