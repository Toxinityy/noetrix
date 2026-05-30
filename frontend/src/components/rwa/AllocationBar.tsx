/// Friendly two-segment allocation bar. Labels carry the meaning (not color alone);
/// 300ms width transition honors prefers-reduced-motion via the global motion rule.
export function AllocationBar({ methBps, usdyBps }: { methBps: number; usdyBps: number }) {
  const mPct = Math.round(methBps / 100);
  const uPct = 100 - mPct;
  return (
    <div className="space-y-2">
      <div
        className="flex h-4 w-full overflow-hidden rounded-full ring-1 ring-white/10"
        role="img"
        aria-label={`Allocation: ${mPct}% mETH staking, ${uPct}% USDY treasury`}
      >
        <div
          className="bg-teal-400/80 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${mPct}%` }}
        />
        <div
          className="bg-sky-400/70 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${uPct}%` }}
        />
      </div>
      <div className="flex justify-between text-sm text-white/70">
        <span>{mPct}% mETH staking</span>
        <span>{uPct}% USDY treasury</span>
      </div>
    </div>
  );
}
