/// Self-contained ARIMA(1,1,1) estimator + forecaster (no native/WASM deps, fully portable).
///
/// Model on the once-differenced series w[t] = y[t] - y[t-1]:
///     w[t] = c + phi*w[t-1] + theta*e[t-1] + e[t]
/// Estimation: conditional sum-of-squares minimized over (phi, theta) by coarse grid + refine; the
/// intercept c is pinned to mean(w)*(1-phi). Forecast integrates the differenced forecasts back to
/// levels and builds a 95% interval from the integrated MA(∞) psi-weights (cumulative ARMA weights).

export interface ArimaForecast {
  mean: number;
  lower95: number;
  upper95: number;
  sigma: number;
  phi: number;
  theta: number;
  c: number;
  /// True when the fit ran on supplied history; false when it fell back to a flat/last-value model.
  fitted: boolean;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/// One-step residuals + SSE for a given (c, phi, theta) over the differenced series.
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

  // Coarse grid over the stationary/invertible interior.
  const grid = [-0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9];
  for (const phi of grid) {
    for (const theta of grid) {
      const c = wbar * (1 - phi);
      const { sse } = conditionalSSE(w, c, phi, theta);
      if (sse < best.sse) best = { phi, theta, sse };
    }
  }

  // Local refinement around the best grid point.
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

/// Forecast `horizon` steps ahead from `series` (levels). Returns mean + 95% interval on the level.
export function arima111(series: number[], horizon: number): ArimaForecast {
  // Need at least a few points to difference + estimate.
  if (series.length < 4) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower95: last, upper95: last, sigma: 0, phi: 0, theta: 0, c: 0, fitted: false };
  }

  // d = 1 differencing.
  const w: number[] = [];
  for (let t = 1; t < series.length; t++) w.push(series[t] - series[t - 1]);

  const { phi, theta, c, e, sigma2 } = estimate(w);

  // Forecast the differenced series h steps. e future = 0; only the first step carries theta*e[n].
  const lastW = w[w.length - 1];
  const lastE = e[e.length - 1];
  const wHat: number[] = [];
  for (let k = 1; k <= horizon; k++) {
    const prevW = k === 1 ? lastW : wHat[k - 2];
    const maTerm = k === 1 ? theta * lastE : 0;
    wHat.push(c + phi * prevW + maTerm);
  }

  // Integrate back to levels.
  const lastLevel = series[series.length - 1];
  let level = lastLevel;
  for (const dw of wHat) level += dw;
  const meanForecast = level;

  // psi-weights of the ARMA(1,1) on the differenced series: psi_0=1, psi_1=phi+theta, psi_j=phi*psi_{j-1}.
  const psi: number[] = [1];
  if (horizon > 1) psi.push(phi + theta);
  for (let j = 2; j < horizon; j++) psi.push(phi * psi[j - 1]);

  // Integrated (level) MA(∞) weights are cumulative sums of psi; var = sigma2 * sum(Psi_j^2).
  let cum = 0;
  let varSum = 0;
  for (let j = 0; j < horizon; j++) {
    cum += psi[j] ?? 0;
    varSum += cum * cum;
  }
  const sigma = Math.sqrt(Math.max(0, sigma2) * varSum);

  return {
    mean: meanForecast,
    lower95: meanForecast - 1.96 * sigma,
    upper95: meanForecast + 1.96 * sigma,
    sigma,
    phi,
    theta,
    c,
    fitted: true,
  };
}
