import { meanReversion, momentum, ewmaVol, sentiment } from "@predictor-index/forecasters";

/// The swarm strategies this generic runner can embody. Set via the STRATEGY env var; run the package
/// once per strategy with its own controller key + agentId. The forecast logic lives in
/// @predictor-index/forecasters (the same code the backtest scores) — this is a thin live wrapper.
export type StrategyKey = "mean-reversion" | "momentum" | "ewma-vol" | "sentiment";

export interface StrategyMeta {
  key: StrategyKey;
  /// Display name (used in the registration metadata + on-chain identity).
  name: string;
  model: string;
  description: string;
  /// True if the strategy needs the current Fear & Greed index.
  needsFearGreed: boolean;
}

export const STRATEGIES: Record<StrategyKey, StrategyMeta> = {
  "mean-reversion": {
    key: "mean-reversion",
    name: "Mean-Reversion",
    model: "AR(1)-to-moving-mean",
    description: "Bets shocks revert: pulls the forecast toward a long-run moving mean.",
    needsFearGreed: false,
  },
  momentum: {
    key: "momentum",
    name: "Momentum",
    model: "OLS-slope-extrapolation",
    description: "Bets trends continue: extrapolates the recent OLS slope.",
    needsFearGreed: false,
  },
  "ewma-vol": {
    key: "ewma-vol",
    name: "EWMA-Volatility",
    model: "EWMA(lambda=0.94)",
    description: "Tracks the EWMA level; sizes its band by EWMA volatility.",
    needsFearGreed: false,
  },
  sentiment: {
    key: "sentiment",
    name: "Sentiment (Fear & Greed)",
    model: "fear-greed-tilt",
    description: "Tilts the forecast by the Crypto Fear & Greed index; widens the band in fear.",
    needsFearGreed: true,
  },
};

export interface Band {
  mean: number;
  lower: number;
  upper: number;
  fitted: boolean;
}

export function parseStrategy(raw: string | undefined): StrategyKey {
  const key = (raw ?? "").trim() as StrategyKey;
  if (!(key in STRATEGIES)) {
    throw new Error(`Invalid STRATEGY="${raw}". Expected one of: ${Object.keys(STRATEGIES).join(", ")}`);
  }
  return key;
}

/// Dispatch to the matching forecasters strategy. `fg` (0–100) is only used by the sentiment strategy.
export function runStrategy(
  key: StrategyKey,
  series: number[],
  opts: { domainMin: number; domainMax: number },
  fg: number | undefined,
): Band {
  switch (key) {
    case "mean-reversion":
      return meanReversion(series, opts);
    case "momentum":
      return momentum(series, opts);
    case "ewma-vol":
      return ewmaVol(series, opts);
    case "sentiment":
      return sentiment(series, opts, fg);
  }
}

/// Latest Crypto Fear & Greed index (0–100) from alternative.me — the same source the keeper posts
/// on-chain. Returns undefined on failure; the sentiment strategy then degrades to an unfitted band.
export async function fetchFearGreed(): Promise<number | undefined> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!res.ok) return undefined;
    const json = (await res.json()) as { data?: { value: string }[] };
    const raw = json.data?.[0]?.value;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : undefined;
  } catch {
    return undefined;
  }
}
