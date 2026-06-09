import { RISK_STATE_UI } from "@/lib/contracts";

/// Friendly risk-state pill. Color + icon + text (never color alone, WCAG color-not-only).
/// State index matches RiskManager.State: 0 Normal, 1 Caution, 2 Frozen. Tones map to the
/// project palette (up / warn / down) so the RWA surface stays on one design system.
const TONE: React.CSSProperties[] = [
  { color: "var(--color-up)", backgroundColor: "color-mix(in srgb, var(--color-up) 15%, transparent)", borderColor: "color-mix(in srgb, var(--color-up) 35%, transparent)" },
  { color: "var(--color-warn)", backgroundColor: "color-mix(in srgb, var(--color-warn) 15%, transparent)", borderColor: "color-mix(in srgb, var(--color-warn) 35%, transparent)" },
  { color: "var(--color-down)", backgroundColor: "color-mix(in srgb, var(--color-down) 15%, transparent)", borderColor: "color-mix(in srgb, var(--color-down) 35%, transparent)" },
];

function Icon({ state }: { state: 0 | 1 | 2 }) {
  // Inline SVG (no emoji as structural icon). 16px, currentColor, decorative.
  if (state === 0) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 1) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 2.5l6 11H2l6-11z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6.5v3.2M8 11.4v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="2.5" height="10" rx="0.8" fill="currentColor" />
      <rect x="9.5" y="3" width="2.5" height="10" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function SafetyBadge({ state }: { state: 0 | 1 | 2 }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none"
      style={TONE[state]}
      role="status"
    >
      <Icon state={state} />
      {RISK_STATE_UI[state]}
    </span>
  );
}
