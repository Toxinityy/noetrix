import type { DailyPoint } from "@predictor-index/market-data";

const DAY = 86_400;

/// Align `other` onto `ref`'s timeline by UTC day. Returns one value per ref point (null if `other`
/// has no observation that day). Used to line up the Fear & Greed series with a category series.
export function alignByDay(ref: DailyPoint[], other: DailyPoint[]): (number | null)[] {
  const byDay = new Map<number, number>();
  for (const p of other) byDay.set(Math.floor(p.ts / DAY), p.value);
  return ref.map((p) => {
    const d = Math.floor(p.ts / DAY);
    return byDay.has(d) ? (byDay.get(d) as number) : null;
  });
}
