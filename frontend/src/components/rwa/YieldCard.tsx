/// One asset's friendly yield card. Big readable number (tabular-nums), plain blurb,
/// AI-confidence as a secondary line. Warm/approachable Web2 skin (rounded-2xl, soft ring).
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
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <div className="text-sm text-white/60">{name}</div>
      <div className="num mt-1 text-3xl font-semibold text-white">{apyPct.toFixed(2)}%</div>
      <div className="mt-0.5 text-xs text-white/40">{blurb}</div>
      <div className="mt-3 text-xs text-white/50">AI confidence: {confidencePct}%</div>
    </div>
  );
}
