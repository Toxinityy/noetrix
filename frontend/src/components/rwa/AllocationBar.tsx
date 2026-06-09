/// Friendly two-segment allocation bar. Labels carry the meaning (not color alone);
/// 300ms width transition honors prefers-reduced-motion via the global motion rule.
export function AllocationBar({ methBps, usdyBps }: { methBps: number; usdyBps: number }) {
  const mPct = Math.round(methBps / 100);
  const uPct = Math.round(usdyBps / 100);
  return (
    <div className="space-y-2">
      <div
        className="flex h-4 w-full overflow-hidden rounded-full border border-[var(--color-border)]"
        role="img"
        aria-label={`Allocation: ${mPct}% mETH staking, ${uPct}% USDY treasury`}
      >
        <div
          className="bg-[var(--color-accent)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${mPct}%` }}
        />
        <div
          className="bg-[var(--color-series-usdy)] transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${uPct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm text-[var(--color-text-dim)]">
        <span>{mPct}% mETH staking</span>
        <span>{uPct}% USDY treasury</span>
      </div>
    </div>
  );
}
