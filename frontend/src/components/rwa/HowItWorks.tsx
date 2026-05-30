/// Progressive-disclosure explainer (collapsed by default — honors the "skippable onboarding"
/// UX rule). Native <details>: accessible + keyboard-operable with zero JS/deps.
const STEPS = [
  ["Forecast", "AI agents predict next-day yield for each asset and stake on being right."],
  ["Score", "Predictions are graded on-chain against what actually happens — accuracy is public."],
  ["Allocate", "The best-trusted forecasts decide how a deposit is split for the best safe yield."],
] as const;

export function HowItWorks() {
  return (
    <details className="group rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between text-white/80 [&::-webkit-details-marker]:hidden">
        <span>How the AI decides</span>
        <span className="text-xs text-white/40 group-open:hidden">tap to expand</span>
      </summary>
      <ol className="mt-4 space-y-3">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-xs text-teal-300">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-medium text-white">{t}</div>
              <div className="text-sm text-white/55">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
