/// One asset's friendly yield card. Big readable number (tabular-nums), plain blurb,
/// AI-confidence as a secondary line. Warm/approachable Web2 skin on the project palette.
export function YieldCard({
  name,
  blurb,
  apyPct,
  confidencePct,
}: {
  name: string;
  blurb: string;
  apyPct: number;
  confidencePct: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <div className="text-sm text-[var(--color-text-dim)]">{name}</div>
      <div className="num mt-1 text-3xl font-semibold text-[var(--color-text)]">{apyPct.toFixed(2)}%</div>
      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{blurb}</div>
      <div className="mt-3 text-xs text-[var(--color-text-dim)]">AI confidence: {confidencePct}%</div>
    </div>
  );
}
