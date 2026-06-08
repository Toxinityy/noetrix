# Agent Swarm — Plan 1: Forecasters Foundation Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `agents/forecasters` — the single-source-of-truth library holding the 6 statistical forecasting strategies, the swarm-aggregation math, the confidence-from-width rule, and BigInt ports of the on-chain CRPS + calibration scorers. Everything else (the backtest, and the Solidity parity tests) depends on this.

**Architecture:** A standalone pnpm workspace package of **pure, deterministic functions** (no I/O). Strategies take a numeric series and return a `Band`; a shared helper turns a `Band` into a `Forecast` with confidence derived from band width. The swarm aggregation is implemented in **scaled-integer BigInt** that mirrors `CompositeFeed.sol._aggregate` op-for-op so a later plan can prove bit-parity. The CRPS and calibration ports mirror `RangeCrpsScorer.sol` and `ScoringEngine._calibration` exactly, anchored to hand-verified golden vectors computed from the Solidity formulas.

**Tech Stack:** TypeScript (ESM, NodeNext), BigInt fixed-point, Vitest. No runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-09-agent-swarm-confidence-stress-design.md` (§2 swarm math, §3 strategies, §7 parity).

**Scope note:** This is Plan 1 of 4 for P1a. Follow-on plans (not in this file): Plan 2 `agents/market-data` + `agents/backtest`; Plan 3 contracts (`CompositeFeed` extension + `MarketStressMonitor` + `SentimentOracle` + Solidity↔TS parity vectors); Plan 4 frontend wiring + live runners + real-data seeding. This plan delivers working, independently-testable software on its own (`pnpm --filter @predictor-index/forecasters test` green).

**Conventions used throughout (defined in Task 2, referenced everywhere):**
- `WEIGHT_SCALE = 1_000_000_000_000_000_000n` (1e18), `CAL_SCALE = 1_000_000n` (1e6), `CAL_FLOOR = -500_000n`, `MAX_CONFIDENCE_BPS = 10_000`, `AGREE_FLOOR = 400_000n`, `MIN_SWARM = 3`, `SINGLE_SOURCE_CEILING_BPS = 5_000`.
- `Band = { mean: number; lower: number; upper: number; fitted: boolean }`
- `Forecast = Band & { confidenceBps: number }`
- A **Strategy** is `(series: number[], opts: StrategyOpts) => Band`.

---

## Task 1: Scaffold the `@predictor-index/forecasters` package

**Files:**
- Create: `agents/forecasters/package.json`
- Create: `agents/forecasters/tsconfig.json`
- Create: `agents/forecasters/vitest.config.ts`
- Create: `agents/forecasters/src/index.ts` (temporary stub)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create `agents/forecasters/package.json`**

```json
{
  "name": "@predictor-index/forecasters",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `agents/forecasters/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agents/forecasters/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `agents/forecasters/src/index.ts` (stub)**

```ts
export const FORECASTERS_VERSION = "0.1.0";
```

- [ ] **Step 5: Add the package to `pnpm-workspace.yaml`**

Add this line under `packages:` (after the `agents/sdk` entry):

```yaml
  - "agents/forecasters"
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes without error; `@predictor-index/forecasters` appears in the workspace.

- [ ] **Step 7: Commit**

```bash
git add agents/forecasters/package.json agents/forecasters/tsconfig.json agents/forecasters/vitest.config.ts agents/forecasters/src/index.ts pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(forecasters): scaffold @predictor-index/forecasters workspace package"
```

---

## Task 2: Constants, types, and `confidenceFromWidth`

**Files:**
- Create: `agents/forecasters/src/types.ts`
- Create: `agents/forecasters/src/confidence.ts`
- Test: `agents/forecasters/test/confidence.test.ts`

- [ ] **Step 1: Write the failing test `agents/forecasters/test/confidence.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { confidenceFromWidth, toForecast } from "../src/confidence.js";

describe("confidenceFromWidth", () => {
  it("tight band → high confidence (mirrors reasoner coherent rule)", () => {
    // width 4000 over span 100000 → widthFrac 0.04 → round(10000*0.96)=9600
    expect(confidenceFromWidth(48000, 52000, 0, 100000)).toBe(9600);
  });
  it("full-domain band → 0 confidence", () => {
    expect(confidenceFromWidth(0, 100000, 0, 100000)).toBe(0);
  });
  it("zero-width band → max confidence", () => {
    expect(confidenceFromWidth(500, 500, 0, 2000)).toBe(10000);
  });
});

describe("toForecast", () => {
  it("clamps band to domain and derives confidence", () => {
    const f = toForecast({ mean: 50, lower: -10, upper: 120, fitted: true }, 0, 100);
    expect(f.lower).toBe(0);
    expect(f.upper).toBe(100);
    expect(f.confidenceBps).toBe(0); // full-domain after clamp
    expect(f.fitted).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test confidence`
Expected: FAIL — cannot find `../src/confidence.js`.

- [ ] **Step 3: Create `agents/forecasters/src/types.ts`**

```ts
/// Scaled-integer constants shared by the swarm math + scoring ports. These MUST match
/// the on-chain values in CompositeFeed.sol / RangeCrpsScorer.sol / ScoringEngine.sol.
export const WEIGHT_SCALE = 1_000_000_000_000_000_000n; // 1e18
export const CAL_SCALE = 1_000_000n; // 1e6 (calibration / multiplier fixed-point)
export const CAL_FLOOR = -500_000n; // -0.5 in CAL_SCALE
export const MAX_CONFIDENCE_BPS = 10_000;
export const AGREE_FLOOR = 400_000n; // 0.4 in CAL_SCALE — agreement multiplier floor
export const MIN_SWARM = 3; // quorum: below this, confidence is capped (single-source)
export const SINGLE_SOURCE_CEILING_BPS = 5_000;

/// A raw forecast band on the metric level (no confidence yet).
export interface Band {
  mean: number;
  lower: number;
  upper: number;
  /// True when a real history drove the forecast; false on a degenerate/empty fallback.
  fitted: boolean;
}

/// A band plus the confidence derived from its width (bps, [0, 10000]).
export interface Forecast extends Band {
  confidenceBps: number;
}

/// Options every strategy accepts. domainMin/Max bound the metric (used for confidence + clamping).
export interface StrategyOpts {
  domainMin: number;
  domainMax: number;
  horizon?: number;
}
```

- [ ] **Step 4: Create `agents/forecasters/src/confidence.ts`**

```ts
import type { Band, Forecast } from "./types.js";

/// Confidence from band width — mirrors the reasoner's coherent rule (forecast.ts):
/// confidence = round(10000 * (1 - widthFraction)), clamped to [0, 10000].
/// A wide band cannot be high-confidence; a tight band approaches max.
export function confidenceFromWidth(
  lower: number,
  upper: number,
  domainMin: number,
  domainMax: number,
): number {
  const span = Math.max(1, domainMax - domainMin);
  const widthFrac = Math.min(1, Math.max(0, (upper - lower) / span));
  return Math.max(0, Math.min(10000, Math.round(10000 * (1 - widthFrac))));
}

/// Clamp a raw Band to the category domain and attach width-derived confidence.
export function toForecast(band: Band, domainMin: number, domainMax: number): Forecast {
  const lower = Math.min(Math.max(band.lower, domainMin), domainMax);
  const upper = Math.min(Math.max(band.upper, domainMin), domainMax);
  const mean = Math.min(Math.max(band.mean, domainMin), domainMax);
  return {
    mean,
    lower,
    upper,
    fitted: band.fitted,
    confidenceBps: confidenceFromWidth(lower, upper, domainMin, domainMax),
  };
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test confidence`
Expected: PASS (4 assertions).

- [ ] **Step 6: Commit**

```bash
git add agents/forecasters/src/types.ts agents/forecasters/src/confidence.ts agents/forecasters/test/confidence.test.ts
git commit -m "feat(forecasters): constants, Band/Forecast types, confidenceFromWidth"
```

---

## Task 3: BigInt integer square root (`isqrt`)

**Files:**
- Create: `agents/forecasters/src/math/isqrt.ts`
- Test: `agents/forecasters/test/isqrt.test.ts`

**Why:** the swarm dispersion needs `sqrt`. On-chain we will use OZ `Math.sqrt` (Babylonian, FLOOR-truncating integer sqrt). JS `Math.sqrt` returns a float and would break parity. This is the floor-integer sqrt both sides will use.

- [ ] **Step 1: Write the failing test `agents/forecasters/test/isqrt.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { isqrt } from "../src/math/isqrt.js";

describe("isqrt (floor integer sqrt)", () => {
  it("perfect squares", () => {
    expect(isqrt(0n)).toBe(0n);
    expect(isqrt(1n)).toBe(1n);
    expect(isqrt(144n)).toBe(12n);
    expect(isqrt(1_000_000n)).toBe(1000n);
  });
  it("non-perfect squares floor", () => {
    expect(isqrt(2n)).toBe(1n);
    expect(isqrt(15n)).toBe(3n);
    expect(isqrt(99n)).toBe(9n);
  });
  it("large values (256-bit range)", () => {
    const big = 10n ** 40n; // (1e20)^2
    expect(isqrt(big)).toBe(10n ** 20n);
  });
  it("rejects negatives", () => {
    expect(() => isqrt(-1n)).toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test isqrt`
Expected: FAIL — cannot find `../src/math/isqrt.js`.

- [ ] **Step 3: Create `agents/forecasters/src/math/isqrt.ts`**

```ts
/// Floor integer square root over BigInt (Babylonian / Newton). Returns floor(sqrt(n)).
/// Matches OpenZeppelin Math.sqrt's truncating result for parity with the on-chain swarm math.
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("isqrt: negative input");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test isqrt`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/math/isqrt.ts agents/forecasters/test/isqrt.test.ts
git commit -m "feat(forecasters): BigInt floor isqrt (OZ Math.sqrt parity)"
```

---

## Task 4: Rank-weight helper (`rankWeights`)

**Files:**
- Create: `agents/forecasters/src/math/rankWeights.ts`
- Test: `agents/forecasters/test/rankWeights.test.ts`

**Why:** `CompositeFeed.sol:201` computes `wScaled = ((n-j) * WEIGHT_SCALE) / denom`, `denom = n(n+1)/2`, multiply-before-divide. The ensemble value AND the dispersion must use the EXACT same weights, so this lives in one helper.

- [ ] **Step 1: Write the failing test `agents/forecasters/test/rankWeights.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { rankWeights } from "../src/math/rankWeights.js";
import { WEIGHT_SCALE } from "../src/types.js";

describe("rankWeights", () => {
  it("n=1 → single full weight", () => {
    expect(rankWeights(1)).toEqual([WEIGHT_SCALE]);
  });
  it("n=2 → 2/3, 1/3 with multiply-before-divide flooring", () => {
    const denom = 3n;
    expect(rankWeights(2)).toEqual([
      (2n * WEIGHT_SCALE) / denom,
      (1n * WEIGHT_SCALE) / denom,
    ]);
  });
  it("weights are descending by rank", () => {
    const w = rankWeights(4);
    expect(w[0] > w[1] && w[1] > w[2] && w[2] > w[3]).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test rankWeights`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/math/rankWeights.ts`**

```ts
import { WEIGHT_SCALE } from "../types.js";

/// Linear decreasing rank weights, scaled by WEIGHT_SCALE, summing to ~WEIGHT_SCALE.
/// Mirrors CompositeFeed.sol: wScaled_j = ((n - j) * WEIGHT_SCALE) / (n(n+1)/2).
/// Multiply-before-divide, integer floor — must match Solidity exactly.
export function rankWeights(n: number, scale: bigint = WEIGHT_SCALE): bigint[] {
  if (n <= 0) return [];
  const denom = BigInt((n * (n + 1)) / 2);
  const out: bigint[] = [];
  for (let j = 0; j < n; j++) {
    out.push((BigInt(n - j) * scale) / denom);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test rankWeights`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/math/rankWeights.ts agents/forecasters/test/rankWeights.test.ts
git commit -m "feat(forecasters): shared rank-weight helper (CompositeFeed parity)"
```

---

## Task 5: Strategy — persistence (naive)

**Files:**
- Create: `agents/forecasters/src/strategies/persistence.ts`
- Test: `agents/forecasters/test/strategies.persistence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { persistence } from "../src/strategies/persistence.js";

describe("persistence", () => {
  it("mean = last value", () => {
    const b = persistence([10, 11, 12], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBe(12);
    expect(b.fitted).toBe(true);
  });
  it("band widens with recent volatility", () => {
    const calm = persistence([50, 50, 50, 50], { domainMin: 0, domainMax: 100 });
    const choppy = persistence([50, 60, 40, 55], { domainMin: 0, domainMax: 100 });
    expect(choppy.upper - choppy.lower).toBeGreaterThan(calm.upper - calm.lower);
  });
  it("empty series → unfitted", () => {
    const b = persistence([], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.persistence`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/persistence.ts`**

```ts
import type { Band, StrategyOpts } from "../types.js";

/// Persistence / random-walk baseline (ported from naive-baseline). mean = last value; 95% band
/// half-width = max(8% * |last|, 1.96 * stddev of last up-to-10 first-differences).
export function persistence(series: number[], _opts: StrategyOpts, bandPct = 0.08): Band {
  if (series.length === 0) return { mean: 0, lower: 0, upper: 1, fitted: false };
  const last = series[series.length - 1];

  const recent = series.slice(-11);
  let vol = 0;
  if (recent.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
    const m = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const v = diffs.reduce((a, b) => a + (b - m) ** 2, 0) / diffs.length;
    vol = Math.sqrt(v);
  }

  const half = Math.max(Math.abs(last) * bandPct, 1.96 * vol);
  return { mean: last, lower: last - half, upper: last + half, fitted: series.length >= 2 };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.persistence`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/persistence.ts agents/forecasters/test/strategies.persistence.test.ts
git commit -m "feat(forecasters): persistence strategy (ported from naive-baseline)"
```

---

## Task 6: Strategy — ARIMA(1,1,1)

**Files:**
- Create: `agents/forecasters/src/strategies/arima.ts`
- Test: `agents/forecasters/test/strategies.arima.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { arima } from "../src/strategies/arima.js";

describe("arima(1,1,1)", () => {
  it("short series → unfitted last-value fallback", () => {
    const b = arima([5, 6], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(6);
    expect(b.lower).toBe(6);
    expect(b.upper).toBe(6);
  });
  it("trending series → forecast continues upward, band non-degenerate", () => {
    const b = arima([10, 12, 14, 16, 18, 20, 22, 24], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(true);
    expect(b.mean).toBeGreaterThan(24);
    expect(b.upper).toBeGreaterThan(b.lower);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.arima`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/arima.ts`**

```ts
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
    cum += psi[j] ?? 0;
    varSum += cum * cum;
  }
  const sigma = Math.sqrt(Math.max(0, sigma2) * varSum);
  return { mean: level, lower: level - 1.96 * sigma, upper: level + 1.96 * sigma, fitted: true };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.arima`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/arima.ts agents/forecasters/test/strategies.arima.test.ts
git commit -m "feat(forecasters): ARIMA(1,1,1) strategy (ported from arima-baseline)"
```

---

## Task 7: Strategy — mean-reversion

**Files:**
- Create: `agents/forecasters/src/strategies/meanReversion.ts`
- Test: `agents/forecasters/test/strategies.meanReversion.test.ts`

**Diversity role:** bets shocks **revert** to a long-run moving mean — the opposite prior to persistence.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { meanReversion } from "../src/strategies/meanReversion.js";

describe("meanReversion", () => {
  it("pulls a spiked last value back toward the moving mean", () => {
    // long run around 50, last spikes to 80 → forecast should sit between 80 and 50
    const series = [50, 50, 50, 50, 50, 50, 50, 50, 50, 80];
    const b = meanReversion(series, { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeLessThan(80);
    expect(b.mean).toBeGreaterThan(50);
    expect(b.fitted).toBe(true);
  });
  it("flat series → forecast ≈ last (no reversion pressure)", () => {
    const b = meanReversion([42, 42, 42, 42, 42], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeCloseTo(42, 6);
  });
  it("short series → unfitted last-value", () => {
    const b = meanReversion([7], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(7);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.meanReversion`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/meanReversion.ts`**

```ts
import type { Band, StrategyOpts } from "../types.js";

/// Mean-reversion (AR(1) toward a moving mean): mean = last + kappa*(SMA_k - last).
/// kappa in (0,1] is the reversion speed; SMA_k is the simple moving average of the last k points.
/// Band half-width from recent volatility (stddev of last up-to-10 first-differences).
export function meanReversion(
  series: number[],
  _opts: StrategyOpts,
  kappa = 0.3,
  k = 10,
): Band {
  if (series.length < 2) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const last = series[series.length - 1];
  const window = series.slice(-k);
  const sma = window.reduce((a, b) => a + b, 0) / window.length;
  const meanForecast = last + kappa * (sma - last);

  const recent = series.slice(-11);
  const diffs: number[] = [];
  for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
  const dm = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const vol = Math.sqrt(diffs.reduce((a, b) => a + (b - dm) ** 2, 0) / diffs.length);
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * vol);

  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.meanReversion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/meanReversion.ts agents/forecasters/test/strategies.meanReversion.test.ts
git commit -m "feat(forecasters): mean-reversion strategy"
```

---

## Task 8: Strategy — momentum (OLS slope)

**Files:**
- Create: `agents/forecasters/src/strategies/momentum.ts`
- Test: `agents/forecasters/test/strategies.momentum.test.ts`

**Diversity role:** bets trends **continue** — the opposite prior to mean-reversion.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { momentum } from "../src/strategies/momentum.js";

describe("momentum", () => {
  it("extrapolates an upward trend above the last value", () => {
    const b = momentum([10, 12, 14, 16, 18], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeGreaterThan(18);
    expect(b.fitted).toBe(true);
  });
  it("extrapolates a downward trend below the last value", () => {
    const b = momentum([30, 28, 26, 24, 22], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeLessThan(22);
  });
  it("short series → unfitted last-value", () => {
    const b = momentum([9], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(9);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.momentum`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/momentum.ts`**

```ts
import type { Band, StrategyOpts } from "../types.js";

/// Momentum / trend-following: fit an OLS line over the last k points and extrapolate `horizon`
/// steps. mean = last + slope*horizon. Band half-width from the residual stddev around the fit.
export function momentum(series: number[], opts: StrategyOpts, k = 10): Band {
  const horizon = opts.horizon ?? 1;
  if (series.length < 3) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const window = series.slice(-k);
  const n = window.length;
  // x = 0..n-1
  const xbar = (n - 1) / 2;
  const ybar = window.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - xbar) * (window[i] - ybar);
    sxx += (i - xbar) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ybar - slope * xbar;
  // residual stddev around the fit
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const fit = intercept + slope * i;
    sse += (window[i] - fit) ** 2;
  }
  const resid = Math.sqrt(sse / Math.max(1, n - 2));
  const last = window[n - 1];
  const meanForecast = last + slope * horizon;
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * resid);
  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.momentum`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/momentum.ts agents/forecasters/test/strategies.momentum.test.ts
git commit -m "feat(forecasters): momentum (OLS slope) strategy"
```

---

## Task 9: Strategy — EWMA volatility

**Files:**
- Create: `agents/forecasters/src/strategies/ewmaVol.ts`
- Test: `agents/forecasters/test/strategies.ewmaVol.test.ts`

**Diversity role:** specializes in the **uncertainty/width** dimension — band sized by EWMA of absolute changes.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ewmaVol } from "../src/strategies/ewmaVol.js";

describe("ewmaVol", () => {
  it("mean tracks the EWMA level (close to recent values)", () => {
    const b = ewmaVol([50, 50, 50, 51, 50], { domainMin: 0, domainMax: 100 });
    expect(b.mean).toBeGreaterThan(48);
    expect(b.mean).toBeLessThan(52);
    expect(b.fitted).toBe(true);
  });
  it("turbulent series → wider band than a calm one", () => {
    const calm = ewmaVol([50, 50, 50, 50, 50, 50], { domainMin: 0, domainMax: 100 });
    const wild = ewmaVol([50, 70, 30, 65, 35, 60], { domainMin: 0, domainMax: 100 });
    expect(wild.upper - wild.lower).toBeGreaterThan(calm.upper - calm.lower);
  });
  it("short series → unfitted", () => {
    const b = ewmaVol([3], { domainMin: 0, domainMax: 100 });
    expect(b.fitted).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.ewmaVol`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/ewmaVol.ts`**

```ts
import type { Band, StrategyOpts } from "../types.js";

/// EWMA-volatility: exponentially-weighted level for the point, band sized by an EWMA of absolute
/// first-differences (RiskMetrics-style, lambda≈0.94). Emphasizes the uncertainty/width dimension.
export function ewmaVol(series: number[], _opts: StrategyOpts, lambda = 0.94): Band {
  if (series.length < 2) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  // EWMA level
  let level = series[0];
  for (let i = 1; i < series.length; i++) level = lambda * level + (1 - lambda) * series[i];
  // EWMA of |first difference| as a volatility proxy
  let vol = Math.abs(series[1] - series[0]);
  for (let i = 2; i < series.length; i++) {
    vol = lambda * vol + (1 - lambda) * Math.abs(series[i] - series[i - 1]);
  }
  const half = 1.96 * vol;
  return { mean: level, lower: level - half, upper: level + half, fitted: true };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.ewmaVol`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/ewmaVol.ts agents/forecasters/test/strategies.ewmaVol.test.ts
git commit -m "feat(forecasters): EWMA-volatility strategy"
```

---

## Task 10: Strategy — sentiment (Fear & Greed tilt)

**Files:**
- Create: `agents/forecasters/src/strategies/sentiment.ts`
- Test: `agents/forecasters/test/strategies.sentiment.test.ts`

**Diversity role:** tilts the forecast by an external Fear & Greed value (0–100) → brings **independent data**. Greed (>50) tilts the level up, fear (<50) tilts it down and **widens** the band (more uncertainty in fear).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sentiment } from "../src/strategies/sentiment.js";

describe("sentiment (fear & greed tilt)", () => {
  const opts = { domainMin: 0, domainMax: 100 };
  it("greed tilts the forecast above last; fear tilts below", () => {
    const greed = sentiment([50, 50, 50], opts, 90); // extreme greed
    const fear = sentiment([50, 50, 50], opts, 10); // extreme fear
    expect(greed.mean).toBeGreaterThan(50);
    expect(fear.mean).toBeLessThan(50);
  });
  it("fear widens the band vs neutral", () => {
    const neutral = sentiment([50, 50, 50], opts, 50);
    const fear = sentiment([50, 50, 50], opts, 10);
    expect(fear.upper - fear.lower).toBeGreaterThan(neutral.upper - neutral.lower);
  });
  it("neutral (50) → mean ≈ last", () => {
    const b = sentiment([42, 42, 42], opts, 50);
    expect(b.mean).toBeCloseTo(42, 6);
  });
  it("missing fg → unfitted last-value", () => {
    const b = sentiment([42, 42], opts, undefined);
    expect(b.fitted).toBe(false);
    expect(b.mean).toBe(42);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test strategies.sentiment`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/strategies/sentiment.ts`**

```ts
import type { Band, StrategyOpts } from "../types.js";

/// Sentiment tilt driven by a Fear & Greed value `fg` ∈ [0,100]. Greed (>50) tilts the level up,
/// fear (<50) tilts it down (flight-to-safety for risk metrics) and widens the band. `beta` is the
/// max relative tilt at the extremes; `fearWiden` is the max extra band widening at full fear.
export function sentiment(
  series: number[],
  _opts: StrategyOpts,
  fg: number | undefined,
  beta = 0.1,
  fearWiden = 0.5,
): Band {
  if (series.length < 2 || fg === undefined || !Number.isFinite(fg)) {
    const last = series.length ? series[series.length - 1] : 0;
    return { mean: last, lower: last, upper: last, fitted: false };
  }
  const last = series[series.length - 1];
  const tilt = (fg - 50) / 50; // [-1, 1]: <0 fear, >0 greed
  const meanForecast = last * (1 + beta * tilt);

  // base volatility from recent diffs
  const recent = series.slice(-11);
  const diffs: number[] = [];
  for (let i = 1; i < recent.length; i++) diffs.push(recent[i] - recent[i - 1]);
  const dm = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const vol = Math.sqrt(diffs.reduce((a, b) => a + (b - dm) ** 2, 0) / diffs.length);

  const fearFactor = 1 + Math.max(0, (50 - fg) / 50) * fearWiden; // ≥1, larger in fear
  const half = Math.max(Math.abs(meanForecast) * 0.08, 1.96 * vol) * fearFactor;
  return { mean: meanForecast, lower: meanForecast - half, upper: meanForecast + half, fitted: true };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test strategies.sentiment`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/strategies/sentiment.ts agents/forecasters/test/strategies.sentiment.test.ts
git commit -m "feat(forecasters): sentiment (fear & greed) strategy"
```

---

## Task 11: Swarm aggregation (dispersion → quorum-aware agreement → MIN-combined confidence)

**Files:**
- Create: `agents/forecasters/src/swarm.ts`
- Test: `agents/forecasters/test/swarm.test.ts`

**This is the core.** It mirrors `CompositeFeed.sol._aggregate` (to be implemented in Plan 3) op-for-op in BigInt: rank-weighted ensemble, midpoint+width dispersion, per-category `disagreeScale` normalization, agreement floor, quorum cap, and `MIN(calibration, agreement)` combination. All scaled-integer; no float.

- [ ] **Step 1: Write the failing test `agents/forecasters/test/swarm.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { aggregateSwarm } from "../src/swarm.js";
import { SINGLE_SOURCE_CEILING_BPS } from "../src/types.js";

// METH-like domain for these cases
const P = { domainMin: 0n, domainMax: 100_000n, disagreeScale: 5_000n };

describe("aggregateSwarm", () => {
  it("n=0 → empty result", () => {
    const r = aggregateSwarm([], [], [], [], P);
    expect(r.contributors).toBe(0);
    expect(r.confidenceBps).toBe(0);
    expect(r.ensemble).toBe(0n);
  });

  it("n=1 → quorum cap: confidence ≤ single-source ceiling (NOT 100% 'consensus')", () => {
    // one tight, fully-calibrated agent that would otherwise report ~9600 bps
    const r = aggregateSwarm([48_000n], [52_000n], [9_600], [0n], P);
    expect(r.contributors).toBe(1);
    expect(r.confidenceBps).toBeLessThanOrEqual(SINGLE_SOURCE_CEILING_BPS);
  });

  it("identical tight midpoints (n=3) → near-zero disagreement, high agreement", () => {
    const lo = [49_000n, 49_000n, 49_000n];
    const hi = [51_000n, 51_000n, 51_000n];
    const stated = [9_800, 9_800, 9_800];
    const cal = [0n, 0n, 0n];
    const r = aggregateSwarm(lo, hi, stated, cal, P);
    expect(r.contributors).toBe(3);
    expect(r.disagreementBps).toBeLessThan(500); // tight
    expect(r.confidenceBps).toBeGreaterThan(7_000);
  });

  it("scattered midpoints (n=3) → high disagreement, confidence haircut", () => {
    const tightAgree = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    const scattered = aggregateSwarm(
      [10_000n, 49_000n, 88_000n], [12_000n, 51_000n, 90_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    expect(scattered.disagreementBps).toBeGreaterThan(tightAgree.disagreementBps);
    expect(scattered.confidenceBps).toBeLessThan(tightAgree.confidenceBps);
  });

  it("MIN-combine: a badly-calibrated swarm is haircut even when it agrees", () => {
    const agreeGoodCal = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000], [0n, 0n, 0n], P);
    const agreeBadCal = aggregateSwarm(
      [49_000n, 49_000n, 49_000n], [51_000n, 51_000n, 51_000n], [9_000, 9_000, 9_000],
      [-500_000n, -500_000n, -500_000n], P); // worst calibration
    expect(agreeBadCal.confidenceBps).toBeLessThan(agreeGoodCal.confidenceBps);
  });

  it("TVL domain (1e17) does not overflow and produces a finite result", () => {
    const big = { domainMin: 0n, domainMax: 100_000_000_000_000_000n, disagreeScale: 2_000_000_000_000_000n };
    const r = aggregateSwarm(
      [9_000_000_000_000_000n, 9_100_000_000_000_000n, 9_050_000_000_000_000n],
      [9_200_000_000_000_000n, 9_300_000_000_000_000n, 9_250_000_000_000_000n],
      [8_000, 8_000, 8_000], [0n, 0n, 0n], big);
    expect(r.contributors).toBe(3);
    expect(Number.isFinite(r.confidenceBps)).toBe(true);
    expect(r.confidenceBps).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test swarm`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/swarm.ts`**

```ts
import {
  WEIGHT_SCALE,
  CAL_SCALE,
  CAL_FLOOR,
  AGREE_FLOOR,
  MIN_SWARM,
  SINGLE_SOURCE_CEILING_BPS,
  MAX_CONFIDENCE_BPS,
} from "./types.js";
import { rankWeights } from "./math/rankWeights.js";
import { isqrt } from "./math/isqrt.js";

export interface SwarmParams {
  domainMin: bigint;
  domainMax: bigint;
  /// Per-category absolute spread (metric units) mapping to full disagreement (d = 1.0).
  disagreeScale: bigint;
  minSwarm?: number;
  singleSourceCeilingBps?: number;
  agreeFloor?: bigint;
}

export interface SwarmResult {
  ensemble: bigint;
  confidenceBps: number;
  disagreementBps: number;
  contributors: number;
}

function clamp(v: bigint, lo: bigint, hi: bigint): bigint {
  return v < lo ? lo : v > hi ? hi : v;
}

/// Mirror of CompositeFeed.sol._aggregate (to be implemented in Plan 3), in scaled-integer BigInt.
/// Contributors are passed in RANK ORDER (best first). lo/hi are the band; stated is bps; cal is the
/// agent's calibrationScore in CAL_SCALE (≤ 0). All four arrays share length n.
export function aggregateSwarm(
  lo: bigint[],
  hi: bigint[],
  stated: number[],
  cal: bigint[],
  p: SwarmParams,
): SwarmResult {
  const n = lo.length;
  if (n === 0) return { ensemble: 0n, confidenceBps: 0, disagreementBps: 0, contributors: 0 };

  const minSwarm = p.minSwarm ?? MIN_SWARM;
  const ceiling = p.singleSourceCeilingBps ?? SINGLE_SOURCE_CEILING_BPS;
  const agreeFloor = p.agreeFloor ?? AGREE_FLOOR;

  // Clamp bands to domain; midpoints + widths.
  const mid: bigint[] = [];
  const width: bigint[] = [];
  for (let i = 0; i < n; i++) {
    const a = clamp(lo[i], p.domainMin, p.domainMax);
    const b = clamp(hi[i], p.domainMin, p.domainMax);
    mid.push((a + b) / 2n);
    width.push(b - a);
  }

  const w = rankWeights(n); // BigInt, WEIGHT_SCALE-scaled, sum ≈ WEIGHT_SCALE

  // Ensemble value = Σ w_i * mid_i / WEIGHT_SCALE
  let ensemble = 0n;
  for (let i = 0; i < n; i++) ensemble += (w[i] * mid[i]) / WEIGHT_SCALE;

  // Weighted variance V = Σ w_i * (mid_i - M)^2 / WEIGHT_SCALE ; D = isqrt(V)
  let V = 0n;
  for (let i = 0; i < n; i++) {
    const dev = mid[i] - ensemble;
    V += (w[i] * (dev * dev)) / WEIGHT_SCALE;
  }
  const D = isqrt(V);

  // Mean band width Wbar = Σ w_i * width_i / WEIGHT_SCALE
  let Wbar = 0n;
  for (let i = 0; i < n; i++) Wbar += (w[i] * width[i]) / WEIGHT_SCALE;

  // Raw disagreement = midpoint scatter + half mean band width
  const dRaw = D + Wbar / 2n;

  // Normalized disagreement d ∈ [0, CAL_SCALE]
  const scale = p.disagreeScale > 0n ? p.disagreeScale : 1n;
  let d = (dRaw * CAL_SCALE) / scale;
  if (d > CAL_SCALE) d = CAL_SCALE;

  // Agreement multiplier g = max(AGREE_FLOOR, CAL_SCALE - d)
  let g = CAL_SCALE - d;
  if (g < agreeFloor) g = agreeFloor;

  // Calibration multiplier (existing CompositeFeed derivation): mean of clipped calibrations + 1
  let sumClipped = 0n;
  for (let i = 0; i < n; i++) {
    let c = cal[i] < CAL_FLOOR ? CAL_FLOOR : cal[i];
    if (c > 0n) c = 0n;
    sumClipped += c;
  }
  const meanClipped = sumClipped / BigInt(n);
  const calMult = CAL_SCALE + meanClipped; // ∈ [CAL_SCALE/2, CAL_SCALE]

  // Combine penalties with MIN (not product)
  const mult = calMult < g ? calMult : g;

  // weightedStated = Σ w_i * stated_i  (bps × WEIGHT_SCALE), folded out with mult
  let weightedStated = 0n;
  for (let i = 0; i < n; i++) weightedStated += w[i] * BigInt(stated[i]);
  let finalConf = (weightedStated * mult) / (WEIGHT_SCALE * CAL_SCALE);
  if (finalConf > BigInt(MAX_CONFIDENCE_BPS)) finalConf = BigInt(MAX_CONFIDENCE_BPS);

  // Quorum cap: a sub-MIN_SWARM swarm cannot claim full consensus confidence.
  let confidenceBps = Number(finalConf);
  if (n < minSwarm && confidenceBps > ceiling) confidenceBps = ceiling;

  const disagreementBps = Number((d * BigInt(MAX_CONFIDENCE_BPS)) / CAL_SCALE);

  return { ensemble, confidenceBps, disagreementBps, contributors: n };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test swarm`
Expected: PASS (6 assertions).

- [ ] **Step 5: Generate and commit the golden swarm vectors (cross-checked by Solidity in Plan 3)**

Create `agents/forecasters/scripts/gen-swarm-vectors.ts`:

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { aggregateSwarm, type SwarmParams } from "../src/swarm.js";

interface Case { name: string; lo: string[]; hi: string[]; stated: number[]; cal: string[]; params: { domainMin: string; domainMax: string; disagreeScale: string } }

const cases: Case[] = [
  { name: "meth-agree-n3", lo: ["49000", "49000", "49000"], hi: ["51000", "51000", "51000"], stated: [9800, 9800, 9800], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "meth-scatter-n3", lo: ["10000", "49000", "88000"], hi: ["12000", "51000", "90000"], stated: [9000, 9000, 9000], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "meth-lone-n1", lo: ["48000"], hi: ["52000"], stated: [9600], cal: ["0"], params: { domainMin: "0", domainMax: "100000", disagreeScale: "5000" } },
  { name: "usdy-agree-n3", lo: ["480", "490", "485"], hi: ["520", "510", "515"], stated: [9000, 9000, 9000], cal: ["0", "0", "0"], params: { domainMin: "0", domainMax: "2000", disagreeScale: "120" } },
];

const out = cases.map((c) => {
  const p: SwarmParams = { domainMin: BigInt(c.params.domainMin), domainMax: BigInt(c.params.domainMax), disagreeScale: BigInt(c.params.disagreeScale) };
  const r = aggregateSwarm(c.lo.map(BigInt), c.hi.map(BigInt), c.stated, c.cal.map(BigInt), p);
  return { ...c, expected: { ensemble: r.ensemble.toString(), confidenceBps: r.confidenceBps, disagreementBps: r.disagreementBps, contributors: r.contributors } };
});

mkdirSync("test/vectors", { recursive: true });
writeFileSync("test/vectors/swarm-vectors.json", JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${out.length} swarm vectors`);
```

Run (from the package dir): `pnpm --filter @predictor-index/forecasters exec tsx scripts/gen-swarm-vectors.ts`
(If `tsx` is unavailable, add `"tsx": "^4"` to the package devDependencies and `pnpm install` first.)
Expected: writes `agents/forecasters/test/vectors/swarm-vectors.json`.

- [ ] **Step 6: Commit**

```bash
git add agents/forecasters/src/swarm.ts agents/forecasters/test/swarm.test.ts agents/forecasters/scripts/gen-swarm-vectors.ts agents/forecasters/test/vectors/swarm-vectors.json
git commit -m "feat(forecasters): quorum-aware swarm aggregation + golden vectors"
```

---

## Task 12: CRPS BigInt port (parity with RangeCrpsScorer.sol)

**Files:**
- Create: `agents/forecasters/src/scoring/crps.ts`
- Test: `agents/forecasters/test/crps.test.ts`

**Why:** the backtest scores forecasts with the SAME CRPS the chain uses. The TVL domain's cubic term reaches ~194 bits ≫ 2⁵³, so the port is **pure BigInt**, mirroring `RangeCrpsScorer.sol` op-for-op (doubled coords, the `+1` in `y2`, the `deduction ≥ 2·SCALE ⇒ SCORE_MIN` branch). The golden values below were computed by hand from the Solidity formula.

- [ ] **Step 1: Write the failing test `agents/forecasters/test/crps.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { crpsScore } from "../src/scoring/crps.js";

// domain [0, 100000], N=100, w=1000
describe("crpsScore (RangeCrpsScorer parity)", () => {
  it("centered in-range band [40000,60000], outcome 50000 → 965000", () => {
    // case 3: a2=80000,b2=122000,y2=101000; dya=dby=21000,dba=42000
    // deduction = 1e6 * (2*21000^3) / (3*42000^2*100000) = 35000 → 1e6-35000
    expect(crpsScore(40000n, 60000n, 50000n, 0n, 100000n)).toBe(965000n);
  });
  it("outcome above band: [40000,60000], outcome 90000 → 270000", () => {
    // case 2: y2=181000>b2=122000; numerator=3*(181000-122000)+(122000-80000)=219000
    // deduction = 1e6*219000/(3*100000)=730000 → 1e6-730000
    expect(crpsScore(40000n, 60000n, 90000n, 0n, 100000n)).toBe(270000n);
  });
  it("inverted bounds auto-swap (same as ordered)", () => {
    expect(crpsScore(60000n, 40000n, 50000n, 0n, 100000n)).toBe(965000n);
  });
  it("very wide band is not catastrophically scored (bounded deduction)", () => {
    const s = crpsScore(0n, 100000n, 50000n, 0n, 100000n);
    expect(s).toBeGreaterThan(-1_000_000n);
    expect(s).toBeLessThanOrEqual(1_000_000n);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test crps`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/scoring/crps.ts`**

```ts
/// BigInt port of RangeCrpsScorer.sol — MUST match the Solidity op-for-op.
const N = 100n;
const SCORE_MAX = 1_000_000n;
const SCORE_MIN = -1_000_000n;
const SCALE = 1_000_000n;

function bucketIdx(v: bigint, domainMin: bigint, domainMax: bigint, w: bigint): bigint {
  if (v <= domainMin) return 0n;
  if (v >= domainMax) return N - 1n;
  let idx = (v - domainMin) / w;
  if (idx >= N) idx = N - 1n;
  return idx;
}

function deduction(a2: bigint, b2: bigint, y2: bigint, D: bigint): bigint {
  if (y2 < a2) {
    const numerator = 3n * (a2 - y2) + (b2 - a2);
    return (SCALE * numerator) / (3n * D);
  }
  if (y2 > b2) {
    const numerator = 3n * (y2 - b2) + (b2 - a2);
    return (SCALE * numerator) / (3n * D);
  }
  const dya = y2 - a2;
  const dby = b2 - y2;
  const dba = b2 - a2;
  const num = dya * dya * dya + dby * dby * dby;
  const denom = 3n * dba * dba * D;
  return (SCALE * num) / denom;
}

/// Returns the CRPS score in [-1e6, +1e6] for a uniform[low,high] band vs a point outcome,
/// over [domainMin, domainMax] split into 100 buckets. Mirrors RangeCrpsScorer.score.
export function crpsScore(
  lowRaw: bigint,
  highRaw: bigint,
  actualRaw: bigint,
  domainMin: bigint,
  domainMax: bigint,
): bigint {
  if (domainMax <= domainMin) throw new Error("crps: invalid domain");
  const D = domainMax - domainMin;
  const w = D / N;
  if (w === 0n) throw new Error("crps: zero bucket width");

  let lo = lowRaw;
  let hi = highRaw;
  if (lo > hi) {
    const t = lo;
    lo = hi;
    hi = t;
  }

  const a2 = 2n * (domainMin + bucketIdx(lo, domainMin, domainMax, w) * w);
  const b2 = 2n * (domainMin + (bucketIdx(hi, domainMin, domainMax, w) + 1n) * w);
  const y2 = 2n * domainMin + (2n * bucketIdx(actualRaw, domainMin, domainMax, w) + 1n) * w;

  const ded = deduction(a2, b2, y2, D);
  let sc: bigint;
  if (ded >= 2n * SCALE) sc = SCORE_MIN;
  else sc = SCORE_MAX - ded;
  if (sc > SCORE_MAX) sc = SCORE_MAX;
  if (sc < SCORE_MIN) sc = SCORE_MIN;
  return sc;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test crps`
Expected: PASS (the hand-computed 965000 and 270000 anchors confirm parity with the Solidity formula).

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/scoring/crps.ts agents/forecasters/test/crps.test.ts
git commit -m "feat(forecasters): BigInt CRPS port (RangeCrpsScorer parity)"
```

---

## Task 13: Calibration BigInt port (parity with ScoringEngine._calibration)

**Files:**
- Create: `agents/forecasters/src/scoring/calibration.ts`
- Test: `agents/forecasters/test/calibration.test.ts`

**Why:** the backtest must reproduce the on-chain per-agent calibration (the multiplier the swarm consumes), including the **cold-start `total < 10 ⇒ 0`** threshold. Mirrors `ScoringEngine._calibration` (10 buckets, midpoint `i*100000+50000`, squared error × 4 / (total × 1e6), clamp `[-1e6, 0]`). Golden values computed by hand from the formula.

- [ ] **Step 1: Write the failing test `agents/forecasters/test/calibration.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { calibration } from "../src/scoring/calibration.js";

describe("calibration (ScoringEngine._calibration parity)", () => {
  it("cold start (total < 10) → 0", () => {
    const buckets = new Array(10).fill(0n);
    const counts = new Array(10).fill(0n);
    counts[0] = 9n;
    expect(calibration(buckets, counts)).toBe(0n);
  });
  it("perfect calibration (bucket = its midpoint) → 0", () => {
    const buckets = Array.from({ length: 10 }, (_, i) => BigInt(i * 100_000 + 50_000));
    const counts = new Array(10).fill(1n); // total = 10
    expect(calibration(buckets, counts)).toBe(0n);
  });
  it("bucket0 measured 0 vs midpoint 50000, count 10 → -10000", () => {
    // diff=50000, sq=2.5e9, sumWeightedSq=2.5e10, denom=10*1e6, cal=-((2.5e10*4)/1e7)=-10000
    const buckets = new Array(10).fill(0n);
    const counts = new Array(10).fill(0n);
    counts[0] = 10n;
    expect(calibration(buckets, counts)).toBe(-10_000n);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test calibration`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/forecasters/src/scoring/calibration.ts`**

```ts
/// BigInt port of ScoringEngine._calibration — MUST match the Solidity op-for-op.
const BUCKET_COUNT = 10n;
const SCORE_SCALE_U = 1_000_000n; // 1e6
const SCORE_SCALE = 1_000_000n;

/// buckets[i] = EMA realized-accuracy for confidence bucket i (CAL_SCALE units, [0, 1e6]).
/// counts[i]  = number of resolved predictions in bucket i.
/// Returns the calibration penalty in [-1e6, 0]; 0 if total observations < 10 (cold start).
export function calibration(buckets: bigint[], counts: bigint[]): bigint {
  let total = 0n;
  for (let i = 0; i < 10; i++) total += counts[i];
  if (total < BUCKET_COUNT) return 0n;

  let sumWeightedSq = 0n;
  for (let i = 0; i < 10; i++) {
    const midpoint = BigInt(i) * 100_000n + 50_000n;
    const diff = midpoint - buckets[i];
    const sq = diff * diff;
    sumWeightedSq += sq * counts[i];
  }

  const denom = total * SCORE_SCALE_U;
  let cal = -((sumWeightedSq * 4n) / denom);
  if (cal < -SCORE_SCALE) cal = -SCORE_SCALE;
  if (cal > 0n) cal = 0n;
  return cal;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/forecasters test calibration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/scoring/calibration.ts agents/forecasters/test/calibration.test.ts
git commit -m "feat(forecasters): BigInt calibration port (ScoringEngine parity)"
```

---

## Task 14: Public barrel + full verification

**Files:**
- Modify: `agents/forecasters/src/index.ts`
- Test: `agents/forecasters/test/index.test.ts`

- [ ] **Step 1: Write the failing test `agents/forecasters/test/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import * as lib from "../src/index.js";

describe("public barrel", () => {
  it("exports the 6 strategies, swarm, scoring, confidence, and constants", () => {
    for (const name of [
      "persistence", "arima", "meanReversion", "momentum", "ewmaVol", "sentiment",
      "aggregateSwarm", "crpsScore", "calibration", "confidenceFromWidth", "toForecast",
      "isqrt", "rankWeights", "MIN_SWARM",
    ]) {
      expect(lib).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/forecasters test index`
Expected: FAIL — exports missing.

- [ ] **Step 3: Replace `agents/forecasters/src/index.ts`**

```ts
export const FORECASTERS_VERSION = "0.1.0";

export * from "./types.js";
export * from "./confidence.js";
export * from "./math/isqrt.js";
export * from "./math/rankWeights.js";
export * from "./swarm.js";
export * from "./scoring/crps.js";
export * from "./scoring/calibration.js";

export { persistence } from "./strategies/persistence.js";
export { arima } from "./strategies/arima.js";
export { meanReversion } from "./strategies/meanReversion.js";
export { momentum } from "./strategies/momentum.js";
export { ewmaVol } from "./strategies/ewmaVol.js";
export { sentiment } from "./strategies/sentiment.js";
```

- [ ] **Step 4: Run the full test suite + typecheck + build**

Run: `pnpm --filter @predictor-index/forecasters test`
Expected: PASS — all suites green (confidence, isqrt, rankWeights, 6 strategies, swarm, crps, calibration, index).

Run: `pnpm --filter @predictor-index/forecasters typecheck`
Expected: exit 0.

Run: `pnpm --filter @predictor-index/forecasters build`
Expected: exit 0; `dist/` emitted.

- [ ] **Step 5: Commit**

```bash
git add agents/forecasters/src/index.ts agents/forecasters/test/index.test.ts
git commit -m "feat(forecasters): public barrel + full-suite verification green"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** §3 strategies → Tasks 5–10 (all 6 statistical strategies; the DeepSeek reasoner stays in its own package per spec). §2 swarm math (per-category scale, dispersion = midpoint + width, quorum cap, MIN-combine, AGREE_FLOOR) → Task 11. §7 BigInt parity for CRPS + calibration + isqrt → Tasks 3, 12, 13. `confidenceFromWidth` (real confidence replacing fixed 5000) → Task 2. Rank-weight single-helper → Task 4. **Deferred to later plans (by design):** market-data (Plan 2), backtest replay/metrics (Plan 2), Solidity `_aggregate`/`MarketStressMonitor`/`SentimentOracle` + Solidity↔TS vector cross-check (Plan 3), live runners + frontend + seeding (Plan 4).
- **Placeholder scan:** none — every step has complete code and exact commands.
- **Type consistency:** `Band`/`Forecast`/`StrategyOpts` (Task 2) are used identically by all strategies; `aggregateSwarm` signature `(lo, hi, stated, cal, params)` (Task 11) matches its golden-vector generator (Task 11 Step 5) and the index export (Task 14); constants (`WEIGHT_SCALE`, `CAL_SCALE`, `CAL_FLOOR`, `AGREE_FLOOR`, `MIN_SWARM`, `SINGLE_SOURCE_CEILING_BPS`, `MAX_CONFIDENCE_BPS`) defined once in `types.ts` and imported everywhere.
- **Parity anchors:** CRPS golden values (965000, 270000) and calibration golden (-10000, 0) are hand-derived from the Solidity formulas; Plan 3 will assert the Solidity side matches the same `swarm-vectors.json` + emits its own CRPS vectors to close the loop both directions.
