import type { Band, StrategyOpts } from "../types.js";

/// Self-contained ARIMA(1,1,1) (ported from arima-baseline). d=1 differencing; CSS-estimated (phi,
/// theta) by coarse grid + local refine; 95% interval from integrated MA(∞) psi-weights.
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function conditionalSSE(w: number[], c: number, phi: number, theta: number): { sse: number; e: number[] } {
  const e = new Array<number>(w.length).fill(0);
  let sse = 0;
  for (let t = 1; t < w.length; t++) {
    const pred = c + phi * w[t - 1] + theta * e[t - 1];
    e[t] = w[t] - pred;
    sse += e[t] * e[t];
  }
  return { sse, e };
}

function estimate(w: number[]): { phi: number; theta: number; c: number; e: number[]; sigma2: number } {
  const wbar = mean(w);
  let best = { phi: 0, theta: 0, sse: Infinity };
  const grid = [-0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9];
  for (const phi of grid) {
    for (const theta of grid) {
      const c = wbar * (1 - phi);
      const { sse } = conditionalSSE(w, c, phi, theta);
      if (sse < best.sse) best = { phi, theta, sse };
    }
  }
  let step = 0.1;
  for (let iter = 0; iter < 6; iter++) {
    let improved = false;
    for (const dphi of [-step, 0, step]) {
      for (const dtheta of [-step, 0, step]) {
        const phi = Math.max(-0.98, Math.min(0.98, best.phi + dphi));
        const theta = Math.max(-0.98, Math.min(0.98, best.theta + dtheta));
        const c = wbar * (1 - phi);
        const { sse } = conditionalSSE(w, c, phi, theta);
        if (sse < best.sse - 1e-12) {
          best = { phi, theta, sse };
          improved = true;
        }
      }
    }
    if (!improved) step /= 2;
  }
  const c = wbar * (1 - best.phi);
  const { e, sse } = conditionalSSE(w, c, best.phi, best.theta);
  const dof = Math.max(1, w.length - 3);
  return { phi: best.phi, theta: best.theta, c, e, sigma2: sse / dof };
}

export function arima(series: number[], opts: StrategyOpts): Band {
  const horizon = opts.horizon ?? 1;
  if (series.length < 4) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const w: number[] = [];
  for (let t = 1; t < series.length; t++) w.push(series[t] - series[t - 1]);
  const { phi, theta, c, e, sigma2 } = estimate(w);
  const lastW = w[w.length - 1];
  const lastE = e[e.length - 1];
  const wHat: number[] = [];
  for (let k = 1; k <= horizon; k++) {
    const prevW = k === 1 ? lastW : wHat[k - 2];
    const maTerm = k === 1 ? theta * lastE : 0;
    wHat.push(c + phi * prevW + maTerm);
  }
  let level = series[series.length - 1];
  for (const dw of wHat) level += dw;
  const psi: number[] = [1];
  if (horizon > 1) psi.push(phi + theta);
  for (let j = 2; j < horizon; j++) psi.push(phi * psi[j - 1]);
  let cum = 0;
  let varSum = 0;
  for (let j = 0; j < horizon; j++) {
    cum += psi[j];
    varSum += cum * cum;
  }
  const rawSigma = Math.sqrt(Math.max(0, sigma2) * varSum);
  // Minimum noise floor: avoid exactly-degenerate bands (e.g. perfectly linear test series).
  const sigma = rawSigma > 0 ? rawSigma : Math.abs(level) * 1e-9 + 1e-9;
  return { mean: level, lower: level - 1.96 * sigma, upper: level + 1.96 * sigma, fitted: true };
}
