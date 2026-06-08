/// Pearson correlation; returns 0 when either series has zero variance (avoids NaN).
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}

export interface CorrelationMatrix {
  keys: string[];
  matrix: number[][];
}

/// Pairwise Pearson correlation across named series (e.g. per-agent forecast errors). The diversity
/// proof: low off-diagonal correlation = genuinely diverse swarm.
export function correlationMatrix(seriesByKey: Record<string, number[]>): CorrelationMatrix {
  const keys = Object.keys(seriesByKey);
  const matrix = keys.map((ki) => keys.map((kj) => pearson(seriesByKey[ki], seriesByKey[kj])));
  return { keys, matrix };
}

/// Mean of a number list (0 for empty).
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
