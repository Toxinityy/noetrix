# Agent Swarm — Plan 2: Market-Data Library

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `agents/market-data` — fetch real DefiLlama (mETH APR, Aave-Mantle TVL, USDY APY) + Crypto Fear & Greed series, normalize them to the on-chain domain units, compute realized volatility, and cache to disk. This is the real-data input for the backtest (Plan 3) and the oracle seeder (Plan 4).

**Architecture:** Pure parsers/normalizers/volatility functions (fixture-tested, no network) + thin `fetch`-based fetchers + a disk cache. A `metrics` registry maps each metric's working float unit (bps for APR/APY, USD for TVL, 0–100 index for F&G) to the on-chain domain bigint. TVL is held in BigInt at 8-decimal precision because $92M × 1e8 ≈ 9.2e15 exceeds `Number.MAX_SAFE_INTEGER`. A `refresh-data` script does the live fetch (Node `fetch` handles the >10MB DefiLlama payloads that the WebFetch tool can't) and commits real snapshots.

**Tech Stack:** TypeScript (ESM, NodeNext), native `fetch`, Vitest, fixture JSON.

**Spec:** `docs/superpowers/specs/2026-06-09-agent-swarm-confidence-stress-design.md` (§5 real data).

**Verified endpoints (fetched during grounding):**
- mETH APR: `https://yields.llama.fi/chart/b9f2f00a-ba96-4589-a171-dde979a23d87` → `{status, data:[{timestamp(ISO), apy, apyBase, tvlUsd, ...}]}` (daily, ETH-L1 staking %).
- USDY APY: resolve UUID from `https://yields.llama.fi/pools` filtering `project==='ondo-yield-assets' && symbol==='USDY' && chain==='Mantle'`, then `/chart/{uuid}`.
- Aave-Mantle TVL: `https://api.llama.fi/protocol/aave-v3` → `chainTvls.Mantle.tvl[]` of `{date(unix), totalLiquidityUSD}` (~4mo). Longer proxy: `https://api.llama.fi/v2/historicalChainTvl/Mantle` → `[{date, tvl}]` (note field name `tvl`, not `totalLiquidityUSD`).
- Fear & Greed: `https://api.alternative.me/fng/?limit=0&format=json` → `{data:[{value(str "0".."100"), value_classification, timestamp(unix str)}]}`.

**Units (consistent with `MethAprResolver`/categories):** APR/APY bps where `10000 bps = 100%` → `bps = round(pct·100)` (real mETH ~3.5% → ~350 bps; USDY ~5% → ~500 bps). TVL 8-dec USD → `usd·1e8` (in BigInt). F&G is 0–100.

**Scope note:** Plan 2 of 5 (Plan 1 forecasters done). Plan 3 = `agents/backtest`. The library + fixture tests land with NO network; the real-data snapshot is produced by `scripts/refresh-data.ts` (best-effort during execution; otherwise a one-command follow-up).

---

## Task 1: Scaffold `@predictor-index/market-data`

**Files:**
- Create: `agents/market-data/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` (stub)
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create `agents/market-data/package.json`**

```json
{
  "name": "@predictor-index/market-data",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "refresh": "tsx scripts/refresh-data.ts"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create `agents/market-data/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create `agents/market-data/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `agents/market-data/src/index.ts` (stub)**

```ts
export const MARKET_DATA_VERSION = "0.1.0";
```

- [ ] **Step 5: Add to `pnpm-workspace.yaml`** — add under `packages:` after the `agents/forecasters` line:

```yaml
  - "agents/market-data"
```

- [ ] **Step 6: Install**

Run: `pnpm install`
Expected: completes; `@predictor-index/market-data` recognized.

- [ ] **Step 7: Commit**

```bash
git add agents/market-data/package.json agents/market-data/tsconfig.json agents/market-data/vitest.config.ts agents/market-data/src/index.ts pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore(market-data): scaffold @predictor-index/market-data package"
```

---

## Task 2: Types + metrics registry

**Files:**
- Create: `agents/market-data/src/types.ts`
- Create: `agents/market-data/src/metrics.ts`
- Test: `agents/market-data/test/metrics.test.ts`

- [ ] **Step 1: Write the failing test `agents/market-data/test/metrics.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { METRICS } from "../src/metrics.js";

describe("metrics registry", () => {
  it("APR/APY map percent-bps to domain bigint (10000 bps = 100%)", () => {
    expect(METRICS.METH_APR.toDomain(350)).toBe(350n); // 3.5% → 350 bps
    expect(METRICS.USDY_APY.toDomain(500)).toBe(500n); // 5% → 500 bps
  });
  it("TVL maps USD to 8-dec bigint without Number precision loss", () => {
    // $92,000,000 → 92e6 * 1e8 = 9.2e15 (exceeds 2^53, must be exact via BigInt)
    expect(METRICS.AAVE_TVL.toDomain(92_000_000)).toBe(9_200_000_000_000_000n);
  });
  it("domain bounds match the on-chain categories", () => {
    expect(METRICS.METH_APR.domainMax).toBe(100_000n);
    expect(METRICS.USDY_APY.domainMax).toBe(2_000n);
    expect(METRICS.AAVE_TVL.domainMax).toBe(100_000_000_000_000_000n);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test metrics`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/market-data/src/types.ts`**

```ts
/// One daily observation in the metric's WORKING unit (bps for APR/APY, USD for TVL, 0–100 for F&G).
export interface DailyPoint {
  /// Unix seconds (UTC midnight).
  ts: number;
  value: number;
}

export type MetricKey = "METH_APR" | "AAVE_TVL" | "USDY_APY" | "FEAR_GREED";

export interface MetricSeries {
  metric: MetricKey;
  /// Working-unit ('bps' | 'usd' | 'index').
  unit: string;
  /// Sorted ascending by ts.
  points: DailyPoint[];
  /// ISO timestamp of when this series was fetched (provenance for the cache).
  fetchedAt: string;
  /// Optional source note (endpoint / fallback).
  source?: string;
}
```

- [ ] **Step 4: Create `agents/market-data/src/metrics.ts`**

```ts
import type { MetricKey } from "./types.js";

export interface MetricConfig {
  key: MetricKey;
  /// On-chain category label (undefined for F&G, which has no category).
  categoryLabel?: string;
  workingUnit: "bps" | "usd" | "index";
  /// On-chain domain bounds (mirror agents/sdk categories.ts / RangeCrpsScorer config).
  domainMin: bigint;
  domainMax: bigint;
  /// Working-unit float → on-chain domain bigint. TVL does the 1e8 scale in BigInt to stay exact.
  toDomain: (working: number) => bigint;
  /// Volatility method appropriate to the series shape.
  volMethod: "firstDiff" | "logReturn";
}

const r = (x: number) => Math.round(x);

export const METRICS: Record<MetricKey, MetricConfig> = {
  METH_APR: {
    key: "METH_APR",
    categoryLabel: "METH_APR_24H",
    workingUnit: "bps",
    domainMin: 0n,
    domainMax: 100_000n,
    toDomain: (bps) => BigInt(r(bps)),
    volMethod: "firstDiff",
  },
  USDY_APY: {
    key: "USDY_APY",
    categoryLabel: "USDY_APY_24H",
    workingUnit: "bps",
    domainMin: 0n,
    domainMax: 2_000n,
    toDomain: (bps) => BigInt(r(bps)),
    volMethod: "firstDiff",
  },
  AAVE_TVL: {
    key: "AAVE_TVL",
    categoryLabel: "AAVE_MANTLE_TVL_24H",
    workingUnit: "usd",
    domainMin: 0n,
    domainMax: 100_000_000_000_000_000n, // 1e17 = $1B at 8 decimals
    toDomain: (usd) => BigInt(r(usd)) * 100_000_000n, // USD → 8-dec, scale in BigInt
    volMethod: "logReturn",
  },
  FEAR_GREED: {
    key: "FEAR_GREED",
    workingUnit: "index",
    domainMin: 0n,
    domainMax: 100n,
    toDomain: (v) => BigInt(r(v)),
    volMethod: "firstDiff",
  },
};
```

- [ ] **Step 4b: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/market-data test metrics`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/market-data/src/types.ts agents/market-data/src/metrics.ts agents/market-data/test/metrics.test.ts
git commit -m "feat(market-data): DailyPoint/MetricSeries types + on-chain metrics registry"
```

---

## Task 3: Normalizers

**Files:**
- Create: `agents/market-data/src/normalize.ts`
- Test: `agents/market-data/test/normalize.test.ts`

- [ ] **Step 1: Write the failing test `agents/market-data/test/normalize.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { apyPctToBps, deriveMethRateSeries } from "../src/normalize.js";

describe("apyPctToBps", () => {
  it("10000 bps = 100% (matches MethAprResolver)", () => {
    expect(apyPctToBps(3.5)).toBe(350);
    expect(apyPctToBps(100)).toBe(10000);
    expect(apyPctToBps(5.05)).toBe(505);
  });
});

describe("deriveMethRateSeries", () => {
  it("rate grows so the 24h slope reproduces the apy (monotone up for positive apy)", () => {
    const rates = deriveMethRateSeries([3.65, 3.65, 3.65]); // ~0.01%/day
    expect(rates.length).toBe(3);
    expect(rates[0] > 1_000_000_000_000_000_000n).toBe(true); // grew above base
    expect(rates[2] > rates[1] && rates[1] > rates[0]).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test normalize`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/market-data/src/normalize.ts`**

```ts
/// APR/APY percent → basis points, matching the on-chain convention (10000 bps = 100%).
export function apyPctToBps(pct: number): number {
  return Math.round(pct * 100);
}

/// Derive a mETH/ETH exchange-rate series (1e18-scaled BigInt) from a daily apy% series, so that
/// MethAprResolver's 24h-slope formula reproduces the daily apy. rate_t = rate_{t-1}·(1 + apy_t/100/365).
/// Used by the Plan 4 oracle seeder; kept here so the derivation lives with the data layer.
export function deriveMethRateSeries(
  apyPct: number[],
  base = 1_000_000_000_000_000_000n,
): bigint[] {
  const out: bigint[] = [];
  let rate = base;
  for (const apy of apyPct) {
    // daily growth in parts-per-billion of the rate
    const dailyPpb = BigInt(Math.round((apy / 100 / 365) * 1_000_000_000));
    rate = rate + (rate * dailyPpb) / 1_000_000_000n;
    out.push(rate);
  }
  return out;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/market-data test normalize`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/market-data/src/normalize.ts agents/market-data/test/normalize.test.ts
git commit -m "feat(market-data): apyPctToBps + mETH rate-series derivation"
```

---

## Task 4: Volatility metrics

**Files:**
- Create: `agents/market-data/src/volatility.ts`
- Test: `agents/market-data/test/volatility.test.ts`

- [ ] **Step 1: Write the failing test `agents/market-data/test/volatility.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { rollingStdevFirstDiff, rollingStdevLogReturn, winsorize } from "../src/volatility.js";

describe("rollingStdevFirstDiff", () => {
  it("zero for a perfectly flat series; positive for a choppy one", () => {
    const flat = rollingStdevFirstDiff([5, 5, 5, 5, 5], 3);
    expect(flat[flat.length - 1]).toBe(0);
    const choppy = rollingStdevFirstDiff([5, 9, 4, 8, 3], 3);
    expect(choppy[choppy.length - 1]).toBeGreaterThan(0);
  });
  it("returns one value per input point", () => {
    expect(rollingStdevFirstDiff([1, 2, 3, 4], 2).length).toBe(4);
  });
});

describe("rollingStdevLogReturn", () => {
  it("zero for a flat positive series", () => {
    const v = rollingStdevLogReturn([100, 100, 100, 100], 3);
    expect(v[v.length - 1]).toBe(0);
  });
});

describe("winsorize", () => {
  it("caps extreme outliers toward the mean±k·sigma", () => {
    const out = winsorize([10, 10, 10, 10, 1000], 2);
    expect(out[4]).toBeLessThan(1000);
    expect(out[0]).toBe(10);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test volatility`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/market-data/src/volatility.ts`**

```ts
function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

/// Rolling stdev of first differences (absolute changes), windowed. One value per input point;
/// warmup points (< 2 diffs available) are 0. Suited to bps APR/APY + the F&G index.
export function rollingStdevFirstDiff(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(1, i - window + 1);
    const diffs: number[] = [];
    for (let j = start; j <= i; j++) diffs.push(values[j] - values[j - 1]);
    out.push(stdev(diffs));
  }
  return out;
}

/// Rolling stdev of daily log-returns, windowed. Suited to USD TVL (multiplicative moves). Non-positive
/// values are skipped in the log (treated as no-return) to avoid NaN.
export function rollingStdevLogReturn(values: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(1, i - window + 1);
    const rets: number[] = [];
    for (let j = start; j <= i; j++) {
      if (values[j] > 0 && values[j - 1] > 0) rets.push(Math.log(values[j] / values[j - 1]));
    }
    out.push(stdev(rets));
  }
  return out;
}

/// Clamp values to mean ± k·sigma (winsorization) — tames TVL jumps from token-price swings/migrations
/// that aren't yield-signal noise.
export function winsorize(values: number[], k = 3): number[] {
  if (values.length < 2) return values.slice();
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const s = stdev(values);
  const lo = m - k * s;
  const hi = m + k * s;
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/market-data test volatility`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add agents/market-data/src/volatility.ts agents/market-data/test/volatility.test.ts
git commit -m "feat(market-data): rolling volatility (first-diff, log-return) + winsorize"
```

---

## Task 5: Response parsers (fixture-tested, pure)

**Files:**
- Create: `agents/market-data/src/parsers.ts`
- Create: `agents/market-data/test/fixtures/{meth-chart,fng,aave-protocol,chain-tvl,pools}.json`
- Test: `agents/market-data/test/parsers.test.ts`

- [ ] **Step 1: Create the fixtures**

`agents/market-data/test/fixtures/meth-chart.json`:
```json
{ "status": "success", "data": [
  { "timestamp": "2025-02-05T00:00:00.000Z", "tvlUsd": 1402301000, "apy": 3.12, "apyBase": 3.10, "apyReward": null },
  { "timestamp": "2025-02-06T00:00:00.000Z", "tvlUsd": 1410000000, "apy": 3.25, "apyBase": 3.20, "apyReward": null },
  { "timestamp": "2025-02-07T00:00:00.000Z", "tvlUsd": 1399000000, "apy": 3.05, "apyBase": 3.04, "apyReward": null }
] }
```

`agents/market-data/test/fixtures/fng.json`:
```json
{ "name": "Fear and Greed Index", "data": [
  { "value": "45", "value_classification": "Fear", "timestamp": "1738713600" },
  { "value": "52", "value_classification": "Neutral", "timestamp": "1738800000" },
  { "value": "20", "value_classification": "Extreme Fear", "timestamp": "1738886400" }
] }
```

`agents/market-data/test/fixtures/aave-protocol.json`:
```json
{ "name": "AAVE V3", "chainTvls": { "Mantle": { "tvl": [
  { "date": 1739232000, "totalLiquidityUSD": 365216006 },
  { "date": 1739318400, "totalLiquidityUSD": 401000000 },
  { "date": 1739404800, "totalLiquidityUSD": 388500000 }
] }, "Ethereum": { "tvl": [ { "date": 1739232000, "totalLiquidityUSD": 11000000000 } ] } } }
```

`agents/market-data/test/fixtures/chain-tvl.json`:
```json
[ { "date": 1739232000, "tvl": 156000000 }, { "date": 1739318400, "tvl": 161000000 } ]
```

`agents/market-data/test/fixtures/pools.json`:
```json
{ "status": "success", "data": [
  { "pool": "aaaa-1111", "project": "lido", "symbol": "STETH", "chain": "Ethereum", "apy": 3.1 },
  { "pool": "usdy-mantle-uuid", "project": "ondo-yield-assets", "symbol": "USDY", "chain": "Mantle", "apy": 3.55, "apyBase": 3.55 },
  { "pool": "usdy-eth-uuid", "project": "ondo-yield-assets", "symbol": "USDY", "chain": "Ethereum", "apy": 3.55 }
] }
```

- [ ] **Step 2: Write the failing test `agents/market-data/test/parsers.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseYieldChart, parseFearGreed, parseProtocolChainTvl, parseChainTvl, pickUsdyPool } from "../src/parsers.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

describe("parsers", () => {
  it("parseYieldChart → ascending {ts, value=apyBase%}", () => {
    const pts = parseYieldChart(fx("meth-chart.json"));
    expect(pts.length).toBe(3);
    expect(pts[0].value).toBe(3.10);
    expect(pts[0].ts).toBe(Math.floor(Date.parse("2025-02-05T00:00:00.000Z") / 1000));
    expect(pts[0].ts < pts[1].ts).toBe(true);
  });
  it("parseFearGreed → numeric values ascending by ts", () => {
    const pts = parseFearGreed(fx("fng.json"));
    expect(pts.map((p) => p.value)).toEqual([45, 52, 20]);
    expect(pts[0].ts).toBe(1738713600);
  });
  it("parseProtocolChainTvl picks the Mantle chain only", () => {
    const pts = parseProtocolChainTvl(fx("aave-protocol.json"), "Mantle");
    expect(pts.length).toBe(3);
    expect(pts[0].value).toBe(365216006);
  });
  it("parseChainTvl reads the {date,tvl} shape", () => {
    const pts = parseChainTvl(fx("chain-tvl.json"));
    expect(pts[0].value).toBe(156000000);
  });
  it("pickUsdyPool finds the Mantle Ondo USDY pool UUID", () => {
    expect(pickUsdyPool(fx("pools.json"))).toBe("usdy-mantle-uuid");
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test parsers`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `agents/market-data/src/parsers.ts`**

```ts
import type { DailyPoint } from "./types.js";

function sortByTs(pts: DailyPoint[]): DailyPoint[] {
  return pts.slice().sort((a, b) => a.ts - b.ts);
}

/// DefiLlama yields /chart → {ts, value} in PERCENT (prefers apyBase, falls back to apy).
export function parseYieldChart(raw: unknown): DailyPoint[] {
  const data = (raw as { data?: Array<{ timestamp: string; apy?: number; apyBase?: number }> }).data ?? [];
  const pts: DailyPoint[] = [];
  for (const d of data) {
    const v = typeof d.apyBase === "number" ? d.apyBase : d.apy;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const ts = Math.floor(Date.parse(d.timestamp) / 1000);
    if (!Number.isFinite(ts)) continue;
    pts.push({ ts, value: v });
  }
  return sortByTs(pts);
}

/// alternative.me Fear & Greed → {ts, value} as a 0–100 index.
export function parseFearGreed(raw: unknown): DailyPoint[] {
  const data = (raw as { data?: Array<{ value: string; timestamp: string }> }).data ?? [];
  const pts: DailyPoint[] = [];
  for (const d of data) {
    const value = Number(d.value);
    const ts = Number(d.timestamp);
    if (!Number.isFinite(value) || !Number.isFinite(ts)) continue;
    pts.push({ ts, value });
  }
  return sortByTs(pts);
}

/// DefiLlama /protocol/{slug} → chainTvls[chain].tvl[] of {date, totalLiquidityUSD}.
export function parseProtocolChainTvl(raw: unknown, chain = "Mantle"): DailyPoint[] {
  const chainTvls = (raw as { chainTvls?: Record<string, { tvl?: Array<{ date: number; totalLiquidityUSD: number }> }> }).chainTvls ?? {};
  const tvl = chainTvls[chain]?.tvl ?? [];
  return sortByTs(tvl.map((d) => ({ ts: d.date, value: d.totalLiquidityUSD })));
}

/// DefiLlama /v2/historicalChainTvl/{chain} → [{date, tvl}] (NOTE: field is `tvl`, not totalLiquidityUSD).
export function parseChainTvl(raw: unknown): DailyPoint[] {
  const arr = (raw as Array<{ date: number; tvl: number }>) ?? [];
  return sortByTs(arr.map((d) => ({ ts: d.date, value: d.tvl })));
}

/// DefiLlama /pools → the Mantle Ondo USDY pool UUID (throws if absent so the caller can fall back).
export function pickUsdyPool(raw: unknown): string {
  const data = (raw as { data?: Array<{ pool: string; project: string; symbol: string; chain: string }> }).data ?? [];
  const match = data.find((p) => p.project === "ondo-yield-assets" && p.symbol === "USDY" && p.chain === "Mantle");
  if (!match) throw new Error("USDY Mantle pool not found in /pools");
  return match.pool;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/market-data test parsers`
Expected: PASS (5 assertions).

- [ ] **Step 6: Commit**

```bash
git add agents/market-data/src/parsers.ts agents/market-data/test/parsers.test.ts agents/market-data/test/fixtures
git commit -m "feat(market-data): pure DefiLlama/F&G response parsers + fixtures"
```

---

## Task 6: Fetchers (thin fetch wrappers) + series builder

**Files:**
- Create: `agents/market-data/src/fetchers.ts`
- Create: `agents/market-data/src/series.ts`
- Test: `agents/market-data/test/series.test.ts`

- [ ] **Step 1: Write the failing test `agents/market-data/test/series.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildMethSeries, buildUsdySeries, buildAaveTvlSeries, buildFearGreedSeries } from "../src/series.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => JSON.parse(readFileSync(join(here, "fixtures", name), "utf8"));

describe("series builders (raw JSON → normalized MetricSeries)", () => {
  it("METH series is in bps (10000=100%) and ascending", () => {
    const s = buildMethSeries(fx("meth-chart.json"));
    expect(s.metric).toBe("METH_APR");
    expect(s.unit).toBe("bps");
    expect(s.points[0].value).toBe(310); // 3.10% → 310 bps
  });
  it("USDY series is in bps", () => {
    const s = buildUsdySeries(fx("meth-chart.json")); // reuse same chart shape
    expect(s.points[0].value).toBe(310);
  });
  it("AAVE TVL series keeps USD working unit (number)", () => {
    const s = buildAaveTvlSeries(fx("aave-protocol.json"), "Mantle");
    expect(s.unit).toBe("usd");
    expect(s.points[0].value).toBe(365216006);
  });
  it("Fear & Greed series is the 0–100 index", () => {
    const s = buildFearGreedSeries(fx("fng.json"));
    expect(s.points.map((p) => p.value)).toEqual([45, 52, 20]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test series`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/market-data/src/series.ts`**

```ts
import type { MetricSeries } from "./types.js";
import { parseYieldChart, parseFearGreed, parseProtocolChainTvl, parseChainTvl } from "./parsers.js";
import { apyPctToBps } from "./normalize.js";

function nowIso(): string {
  // Deterministic-friendly: callers may pass fetchedAt; default to empty so tests don't depend on time.
  return "";
}

export function buildMethSeries(rawChart: unknown, fetchedAt = nowIso()): MetricSeries {
  const pct = parseYieldChart(rawChart);
  return { metric: "METH_APR", unit: "bps", fetchedAt, source: "defillama:yields/chart(meth)", points: pct.map((p) => ({ ts: p.ts, value: apyPctToBps(p.value) })) };
}

export function buildUsdySeries(rawChart: unknown, fetchedAt = nowIso()): MetricSeries {
  const pct = parseYieldChart(rawChart);
  return { metric: "USDY_APY", unit: "bps", fetchedAt, source: "defillama:yields/chart(usdy)", points: pct.map((p) => ({ ts: p.ts, value: apyPctToBps(p.value) })) };
}

export function buildAaveTvlSeries(rawProtocol: unknown, chain = "Mantle", fetchedAt = nowIso()): MetricSeries {
  const pts = parseProtocolChainTvl(rawProtocol, chain);
  return { metric: "AAVE_TVL", unit: "usd", fetchedAt, source: "defillama:protocol/aave-v3", points: pts };
}

export function buildChainTvlSeries(rawChainTvl: unknown, fetchedAt = nowIso()): MetricSeries {
  const pts = parseChainTvl(rawChainTvl);
  return { metric: "AAVE_TVL", unit: "usd", fetchedAt, source: "defillama:v2/historicalChainTvl/Mantle(proxy)", points: pts };
}

export function buildFearGreedSeries(rawFng: unknown, fetchedAt = nowIso()): MetricSeries {
  const pts = parseFearGreed(rawFng);
  return { metric: "FEAR_GREED", unit: "index", fetchedAt, source: "alternative.me/fng", points: pts };
}
```

- [ ] **Step 4: Create `agents/market-data/src/fetchers.ts`**

```ts
import { pickUsdyPool } from "./parsers.js";

const METH_POOL = "b9f2f00a-ba96-4589-a171-dde979a23d87";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json();
}

export async function fetchMethChart(): Promise<unknown> {
  return getJson(`https://yields.llama.fi/chart/${METH_POOL}`);
}

/// Resolve the Mantle USDY pool UUID from the (>10MB) /pools list, then fetch its chart.
export async function fetchUsdyChart(): Promise<unknown> {
  const pools = await getJson("https://yields.llama.fi/pools");
  const uuid = pickUsdyPool(pools);
  return getJson(`https://yields.llama.fi/chart/${uuid}`);
}

/// Aave-Mantle TVL from the (>10MB) protocol endpoint.
export async function fetchAaveProtocol(): Promise<unknown> {
  return getJson("https://api.llama.fi/protocol/aave-v3");
}

/// Longer-history Mantle chain-level TVL proxy.
export async function fetchChainTvl(): Promise<unknown> {
  return getJson("https://api.llama.fi/v2/historicalChainTvl/Mantle");
}

export async function fetchFearGreed(): Promise<unknown> {
  return getJson("https://api.alternative.me/fng/?limit=0&format=json");
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @predictor-index/market-data test series`
Expected: PASS (the series builders are tested against fixtures; the network fetchers are thin wrappers exercised by the refresh script in Task 8).

- [ ] **Step 6: Commit**

```bash
git add agents/market-data/src/fetchers.ts agents/market-data/src/series.ts agents/market-data/test/series.test.ts
git commit -m "feat(market-data): network fetchers + raw→MetricSeries builders"
```

---

## Task 7: Disk cache + public API

**Files:**
- Create: `agents/market-data/src/cache.ts`
- Modify: `agents/market-data/src/index.ts`
- Test: `agents/market-data/test/cache.test.ts`

- [ ] **Step 1: Write the failing test `agents/market-data/test/cache.test.ts`**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { rmSync, existsSync } from "node:fs";
import { saveSeries, loadSeries, dataDir } from "../src/cache.js";
import type { MetricSeries } from "../src/types.js";

const sample: MetricSeries = {
  metric: "METH_APR", unit: "bps", fetchedAt: "2026-06-09T00:00:00.000Z",
  points: [{ ts: 1738713600, value: 310 }, { ts: 1738800000, value: 320 }],
};

afterEach(() => {
  const f = `${dataDir()}/METH_APR.json`;
  if (existsSync(f)) rmSync(f);
});

describe("cache", () => {
  it("round-trips a series through disk", () => {
    saveSeries(sample);
    const loaded = loadSeries("METH_APR");
    expect(loaded?.points.length).toBe(2);
    expect(loaded?.points[1].value).toBe(320);
  });
  it("loadSeries returns null when absent", () => {
    expect(loadSeries("USDY_APY")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @predictor-index/market-data test cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `agents/market-data/src/cache.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { MetricKey, MetricSeries } from "./types.js";

/// Cache lives at agents/market-data/data (sibling of src), committed for reproducible backtests.
export function dataDir(): string {
  const here = dirname(fileURLToPath(import.meta.url)); // .../src (or dist)
  return join(here, "..", "data");
}

export function saveSeries(series: MetricSeries): void {
  const dir = dataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${series.metric}.json`), JSON.stringify(series, null, 2) + "\n");
}

export function loadSeries(metric: MetricKey): MetricSeries | null {
  const f = join(dataDir(), `${metric}.json`);
  if (!existsSync(f)) return null;
  return JSON.parse(readFileSync(f, "utf8")) as MetricSeries;
}
```

- [ ] **Step 4: Replace `agents/market-data/src/index.ts`**

```ts
export const MARKET_DATA_VERSION = "0.1.0";
export * from "./types.js";
export * from "./metrics.js";
export * from "./normalize.js";
export * from "./volatility.js";
export * from "./parsers.js";
export * from "./series.js";
export * from "./fetchers.js";
export * from "./cache.js";
```

- [ ] **Step 5: Run the test + typecheck**

Run: `pnpm --filter @predictor-index/market-data test cache`
Expected: PASS.
Run: `pnpm --filter @predictor-index/market-data typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add agents/market-data/src/cache.ts agents/market-data/src/index.ts agents/market-data/test/cache.test.ts
git commit -m "feat(market-data): disk cache + public barrel"
```

---

## Task 8: `refresh-data` script — fetch & commit real snapshots (best-effort)

**Files:**
- Create: `agents/market-data/scripts/refresh-data.ts`
- Create (generated, committed): `agents/market-data/data/{METH_APR,USDY_APY,AAVE_TVL,FEAR_GREED}.json`

- [ ] **Step 1: Create `agents/market-data/scripts/refresh-data.ts`**

```ts
/// Live fetch of all real series → agents/market-data/data/*.json. Run with network access:
///   pnpm --filter @predictor-index/market-data refresh
/// Node's fetch handles the >10MB DefiLlama payloads that the WebFetch tool cannot. Each metric is
/// independent: a failure on one logs and continues so partial real data still lands.
import {
  fetchMethChart, fetchUsdyChart, fetchAaveProtocol, fetchChainTvl, fetchFearGreed,
} from "../src/fetchers.js";
import { buildMethSeries, buildUsdySeries, buildAaveTvlSeries, buildChainTvlSeries, buildFearGreedSeries } from "../src/series.js";
import { saveSeries } from "../src/cache.js";
import type { MetricSeries } from "../src/types.js";

async function tryOne(name: string, fn: () => Promise<MetricSeries>): Promise<boolean> {
  try {
    const s = await fn();
    saveSeries(s);
    console.log(`[ok] ${name}: ${s.points.length} points (${s.source})`);
    return true;
  } catch (e) {
    console.warn(`[skip] ${name}: ${(e as Error).message}`);
    return false;
  }
}

async function main() {
  const stamp = new Date().toISOString();
  let ok = 0;
  ok += (await tryOne("METH_APR", async () => buildMethSeries(await fetchMethChart(), stamp))) ? 1 : 0;
  ok += (await tryOne("USDY_APY", async () => buildUsdySeries(await fetchUsdyChart(), stamp))) ? 1 : 0;
  ok += (await tryOne("AAVE_TVL", async () => {
    try {
      const s = buildAaveTvlSeries(await fetchAaveProtocol(), "Mantle", stamp);
      if (s.points.length > 0) return s;
    } catch (e) {
      console.warn(`  aave protocol failed (${(e as Error).message}), falling back to chain-level proxy`);
    }
    return buildChainTvlSeries(await fetchChainTvl(), stamp);
  })) ? 1 : 0;
  ok += (await tryOne("FEAR_GREED", async () => buildFearGreedSeries(await fetchFearGreed(), stamp))) ? 1 : 0;
  console.log(`refresh-data: ${ok}/4 metrics written to data/`);
  if (ok === 0) process.exitCode = 1;
}

main();
```

- [ ] **Step 2: Run the refresh (best-effort — requires network)**

Run: `pnpm --filter @predictor-index/market-data refresh`
Expected (network available): `4/4 metrics written` (or `3/4` if the USDY pool list is unreachable). Files appear under `agents/market-data/data/`.
**If the run fails entirely (no network in this environment):** record the blocker in your status as `DONE_WITH_CONCERNS` and proceed — the library + fixture tests are the gating deliverable; the real-data snapshot is a one-command follow-up (`pnpm --filter @predictor-index/market-data refresh`) the user runs with network. Do NOT fabricate `data/*.json` by hand.

- [ ] **Step 3: Inspect a snapshot for sanity (if written)**

Run: `node -e "const s=require('./agents/market-data/data/METH_APR.json'); console.log(s.points.length, 'points, last bps:', s.points.at(-1).value)"`
Expected: a few hundred points; last bps in a plausible range (~250–500 for real mETH).

- [ ] **Step 4: Commit (only the files that were actually written)**

```bash
git add agents/market-data/scripts/refresh-data.ts agents/market-data/data 2>/dev/null
git commit -m "feat(market-data): refresh-data script + committed real snapshots (best-effort)"
```
(If no `data/` files were written, commit just the script: `git add agents/market-data/scripts/refresh-data.ts && git commit -m "feat(market-data): refresh-data live-fetch script"`.)

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite, typecheck, and build**

Run: `pnpm --filter @predictor-index/market-data test`
Expected: PASS — metrics, normalize, volatility, parsers, series, cache suites all green.

Run: `pnpm --filter @predictor-index/market-data typecheck`
Expected: exit 0.

Run: `pnpm --filter @predictor-index/market-data build`
Expected: exit 0; `dist/` emitted.

- [ ] **Step 2: Confirm the forecasters package still builds (no workspace breakage)**

Run: `pnpm --filter @predictor-index/forecasters test`
Expected: 48 tests pass (unchanged).

- [ ] **Step 3: Commit any incidental changes (none expected)**

```bash
git status --porcelain
```
Expected: clean (everything already committed).

---

## Self-Review (completed by plan author)

- **Spec coverage (§5):** mETH via verified pool `b9f2f00a…` (Task 6) + apy→exchange-rate derivation (Task 3); Aave-Mantle TVL with the protocol endpoint + chain-level proxy fallback and the `totalLiquidityUSD` vs `tvl` field distinction (Tasks 5–6); USDY runtime UUID resolution via `/pools` filter (Tasks 5–6); Fear & Greed (Tasks 5–6); normalization to on-chain units with **BigInt TVL precision** (Task 2); volatility incl. winsorized log-returns for TVL (Task 4); 24h-cache via committed `data/` snapshots (Tasks 7–8). **Deferred (by design):** the backtest replay/metrics (Plan 3); on-chain oracle seeding uses `deriveMethRateSeries` (Plan 4).
- **Placeholder scan:** none — complete code + fixtures + exact commands. The only conditional is Task 8's best-effort network fetch, which has an explicit no-fabrication fallback.
- **Type consistency:** `DailyPoint`/`MetricSeries`/`MetricKey` (Task 2) used identically by parsers (Task 5), series builders (Task 6), and cache (Task 7); `MetricConfig.toDomain` returns `bigint` (Task 2) consistent with the TVL precision requirement; barrel (Task 7) re-exports all modules.
- **Network independence:** every unit test runs against committed fixtures; only `refresh-data.ts` (Task 8) touches the network, and the suite is green without it.
