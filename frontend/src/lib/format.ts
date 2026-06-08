/** Format an Ethereum address as 0x1234…abcd */
export function shortAddr(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Format bps as a percent string with given dp. */
export function fmtBps(bps: number, dp = 2): string {
  return `${(bps / 100).toFixed(dp)}%`;
}

/** Format a signed score in [-1e6, +1e6] as decimal in [-1.00, +1.00]. */
export function fmtScore(score: number, dp = 3): string {
  const v = score / 1_000_000;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(dp)}`;
}

/** Format MNT amounts with mono-friendly grouping. */
export function fmtMNT(weiOrEther: number, dp = 4): string {
  return `${weiOrEther.toFixed(dp)} MNT`;
}

/** Format USD with $, optional decimals, thousands. */
export function fmtUSD(value: number, dp = 0): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}

/**
 * Compact USD for scannable surfaces (KPIs, tables, charts): $142.3M, $1.4B.
 * Falls back to exact fmtUSD below $1M so small values stay precise.
 * Use fmtUSD on spec pages where the exact figure matters.
 */
export function fmtUSDCompact(value: number, dp = 1): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: dp,
    }).format(value)}`;
  }
  return fmtUSD(value);
}

/** Block height with thin spaces. */
export function fmtBlock(n: number): string {
  return n.toLocaleString("en-US");
}

/** Relative time ("32m ago"). Pure heuristic. */
export function fmtRelTime(epochSec: number, now = Date.now() / 1000): string {
  const diff = Math.max(0, now - epochSec);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

/** Percentage as bps from a [0..1] number. */
export function pctToBps(p: number): number {
  return Math.round(p * 10_000);
}

/** Clamp helper. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
