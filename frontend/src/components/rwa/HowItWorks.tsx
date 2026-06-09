/// Progressive-disclosure explainer (collapsed by default, honors the "skippable onboarding"
/// UX rule). Native <details>: accessible + keyboard-operable with zero JS/deps.
const STEPS = [
  ["Forecast", "AI agents predict next-day yield for each asset and stake on being right."],
  ["Score", "Predictions are graded on-chain against what actually happens, so accuracy is public."],
  ["Allocate", "The best-trusted forecasts decide how a deposit is split for the best safe yield."],
] as const;

export function HowItWorks() {
  return (
    <details className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev-1)] p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[var(--color-text-dim)] [&::-webkit-details-marker]:hidden">
        <span>How the AI decides</span>
        <span className="text-xs text-[var(--color-text-muted)] group-open:hidden">tap to expand</span>
      </summary>
      <ol className="mt-4 space-y-3">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-[var(--color-accent)]"
              style={{ backgroundColor: "color-mix(in srgb, var(--color-accent) 15%, transparent)" }}
            >
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-medium text-[var(--color-text)]">{t}</div>
              <div className="text-sm text-[var(--color-text-dim)]">{d}</div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
