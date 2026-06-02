"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";

type Props = {
  /** Pre-baked summary (from reasoner field / mock). If absent, fetches /api/narrate. */
  summary?: string;
  confidenceRationale?: string;
  // narrate inputs (used only when summary is absent)
  predictionId: number;
  agentKind: "ARIMA" | "CLAUDE" | "QUANT" | "ENSEMBLE";
  category: string;
  low: number;
  high: number;
  confidence: number;
  accuracyScore: number;
};

export function ForecastSummary(p: Props) {
  const [fetched, setFetched] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  // Guards against the effect re-firing a second request; a ref never triggers a render,
  // so we avoid calling setState synchronously inside the effect body.
  const startedRef = React.useRef(false);
  const text = p.summary ?? fetched;

  React.useEffect(() => {
    if (p.summary || startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    fetch("/api/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        predictionId: p.predictionId,
        agentKind: p.agentKind,
        category: p.category,
        low: p.low,
        high: p.high,
        confidence: p.confidence,
        accuracyScore: p.accuracyScore,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setFetched(typeof j.summary === "string" ? j.summary : null);
      })
      .catch(() => {
        if (!cancelled) setFetched(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    p.summary,
    p.predictionId,
    p.agentKind,
    p.category,
    p.low,
    p.high,
    p.confidence,
    p.accuracyScore,
  ]);

  return (
    <div
      className="rounded-md border border-[var(--color-accent)]/25 bg-[color:var(--color-accent)]/6 px-4 py-3"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
        <MessageSquareText size={12} aria-hidden />
        In plain English
      </div>
      {text ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">{text}</p>
      ) : loaded ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">Summary unavailable.</p>
      ) : (
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[var(--color-bg-elev-2)]" />
      )}
      {p.confidenceRationale ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-dim)]">{p.confidenceRationale}</p>
      ) : null}
    </div>
  );
}
