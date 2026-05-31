// Hand-curated mock data. Replaced with indexer-driven hooks in Prompt 11.

export type CategoryId = "METH_APR_24H" | "USDY_APY_24H" | "AAVE_MANTLE_TVL_24H";

export type Category = {
  id: CategoryId;
  slug: string;
  label: string;
  unit: "bps" | "usd";
  minStake: number; // MNT
  windowBlocks: { start: number; end: number };
  description: string;
  current: number; // current composite-feed value
  unitFormatter: (n: number) => string;
};

export const CATEGORIES: Record<CategoryId, Category> = {
  METH_APR_24H: {
    id: "METH_APR_24H",
    slug: "meth-apr-24h",
    label: "mETH 24h trailing APR",
    unit: "bps",
    minStake: 0.05,
    windowBlocks: { start: 300, end: 50_000 },
    description:
      "24-hour trailing mETH exchange-rate APR, expressed in basis points. Resolves via the MethAprResolver against the mETH staking-contract historical exchange rate (43,200-block lookback ≈ 1 day on Mantle).",
    current: 3_812,
    unitFormatter: (n) => `${(n / 100).toFixed(2)}%`,
  },
  USDY_APY_24H: {
    id: "USDY_APY_24H",
    slug: "usdy-apy-24h",
    label: "USDY 24h APY",
    unit: "bps",
    minStake: 0.05,
    windowBlocks: { start: 300, end: 50_000 },
    description:
      "24-hour trailing USDY (Ondo tokenized US Treasuries) price-per-share APY, in basis points. Resolves via the UsdyApyResolver against the USDY rate oracle (43,200-block lookback ≈ 1 day on Mantle). v1 uses a seeded oracle; v2 reads the live Ondo USDY contract.",
    current: 500,
    unitFormatter: (n) => `${(n / 100).toFixed(2)}%`,
  },
  AAVE_MANTLE_TVL_24H: {
    id: "AAVE_MANTLE_TVL_24H",
    slug: "aave-mantle-tvl",
    label: "Aave-on-Mantle 24h TVL",
    unit: "usd",
    minStake: 0.05,
    windowBlocks: { start: 300, end: 50_000 },
    description:
      "Total value locked across all Aave-on-Mantle reserves at resolution, summed in USD (8-decimal precision). Contingency: INIT Capital if Aave-Mantle reserves are insufficient.",
    current: 142_310_440,
    unitFormatter: (n) =>
      `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  },
};

export type AgentKind = "ARIMA" | "CLAUDE" | "QUANT" | "ENSEMBLE";

export type Agent = {
  id: number;
  name: string;
  kind: AgentKind;
  controller: string;
  metadataURI: string;
  registeredBlock: number;
  badges: string[];
  reputation: Record<
    CategoryId,
    {
      accuracyScore: number; // -1e6..+1e6
      calibrationScore: number; // -1e6..0
      resolvedCount: number;
      lastUpdatedBlock: number;
      bucketAccuracy: number[]; // 10
      bucketCount: number[]; // 10
    }
  >;
  equityCurve: { block: number; value: number }[];
  description: string;
};

const E = (vals: number[]): number[] => vals;

export const AGENTS: Agent[] = [
  {
    id: 1,
    name: "claude-reasoner-α",
    kind: "CLAUDE",
    controller: "0xA17C9F2bC8b6f23B6cE19a5E6e1D7Cc1A2bDe041",
    metadataURI: "ipfs://bafkreieclaudereasoneralpha",
    registeredBlock: 12_120_344,
    badges: ["Top-1 mETH 7d", "Reasoning trace", "Claude Opus 4.7"],
    description:
      "Claude-driven reasoning agent. Posts a structured 4-step trace (frame → search → infer → forecast) to IPFS with every commit; reveals are auto-decrypted post-window.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 612_400,
        calibrationScore: -91_200,
        resolvedCount: 84,
        lastUpdatedBlock: 12_488_100,
        bucketAccuracy: E([
          0.49, 0.55, 0.58, 0.62, 0.66, 0.71, 0.75, 0.81, 0.87, 0.93,
        ]),
        bucketCount: E([2, 3, 5, 7, 11, 14, 12, 11, 9, 10]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 421_900,
        calibrationScore: -132_400,
        resolvedCount: 42,
        lastUpdatedBlock: 12_487_120,
        bucketAccuracy: E([
          0.42, 0.45, 0.52, 0.58, 0.61, 0.65, 0.69, 0.74, 0.79, 0.82,
        ]),
        bucketCount: E([3, 4, 5, 6, 6, 5, 4, 3, 3, 3]),
      },
      USDY_APY_24H: {
        accuracyScore: 540_000, calibrationScore: -78_000, resolvedCount: 61, lastUpdatedBlock: 12_488_050,
        bucketAccuracy: E([0.50, 0.56, 0.60, 0.64, 0.68, 0.72, 0.77, 0.82, 0.87, 0.92]),
        bucketCount: E([2, 3, 4, 6, 8, 9, 9, 8, 7, 5]),
      },
    },
    equityCurve: makeCurve(0, 1.0, 0.012, 0.004, 72),
  },
  {
    id: 2,
    name: "arima-baseline",
    kind: "ARIMA",
    controller: "0xB22a17e9C50e3a23b6CCe17a3e8F8B5d8e6f9d44",
    metadataURI: "ipfs://bafkreiarimabaseline",
    registeredBlock: 12_118_001,
    badges: ["ARIMA(2,1,1)", "Baseline"],
    description:
      "Classical ARIMA(2,1,1) on 7-day rolling window. Pure statistical baseline, no LLM. Stable, low-variance forecaster.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 384_200,
        calibrationScore: -211_800,
        resolvedCount: 72,
        lastUpdatedBlock: 12_487_980,
        bucketAccuracy: E([
          0.48, 0.51, 0.54, 0.58, 0.6, 0.63, 0.65, 0.68, 0.7, 0.72,
        ]),
        bucketCount: E([4, 5, 6, 8, 9, 9, 9, 8, 7, 7]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 281_400,
        calibrationScore: -184_700,
        resolvedCount: 64,
        lastUpdatedBlock: 12_486_220,
        bucketAccuracy: E([
          0.44, 0.46, 0.51, 0.54, 0.57, 0.59, 0.62, 0.65, 0.66, 0.68,
        ]),
        bucketCount: E([3, 4, 6, 7, 8, 8, 8, 8, 6, 6]),
      },
      USDY_APY_24H: {
        accuracyScore: 402_000, calibrationScore: -120_000, resolvedCount: 58, lastUpdatedBlock: 12_487_900,
        bucketAccuracy: E([0.49, 0.52, 0.55, 0.58, 0.61, 0.64, 0.66, 0.69, 0.71, 0.73]),
        bucketCount: E([3, 4, 5, 7, 8, 8, 8, 6, 5, 4]),
      },
    },
    equityCurve: makeCurve(1, 1.0, 0.005, 0.008, 72),
  },
  {
    id: 3,
    name: "quant-grad-momentum",
    kind: "QUANT",
    controller: "0xC78de40b8Ed8c9F9B321Ea44E1B4D31a0B5C8d11",
    metadataURI: "ipfs://bafkreiquantgrad",
    registeredBlock: 12_119_503,
    badges: ["Gradient", "Top-3 TVL"],
    description:
      "Gradient-boosted regression on on-chain features (gas, mempool, restake flows). High-variance, occasionally explosive on directional moves.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 312_700,
        calibrationScore: -302_100,
        resolvedCount: 51,
        lastUpdatedBlock: 12_487_330,
        bucketAccuracy: E([
          0.41, 0.46, 0.5, 0.54, 0.6, 0.66, 0.7, 0.73, 0.78, 0.81,
        ]),
        bucketCount: E([5, 6, 6, 6, 6, 6, 5, 5, 3, 3]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 458_900,
        calibrationScore: -167_300,
        resolvedCount: 57,
        lastUpdatedBlock: 12_487_980,
        bucketAccuracy: E([
          0.5, 0.54, 0.58, 0.62, 0.65, 0.68, 0.72, 0.76, 0.81, 0.85,
        ]),
        bucketCount: E([4, 5, 6, 7, 8, 7, 7, 6, 4, 3]),
      },
      USDY_APY_24H: {
        accuracyScore: 351_000, calibrationScore: -210_000, resolvedCount: 44, lastUpdatedBlock: 12_487_300,
        bucketAccuracy: E([0.43, 0.47, 0.51, 0.55, 0.60, 0.65, 0.69, 0.73, 0.77, 0.80]),
        bucketCount: E([4, 5, 5, 5, 5, 5, 4, 4, 3, 4]),
      },
    },
    equityCurve: makeCurve(2, 1.0, 0.018, 0.005, 72),
  },
  {
    id: 4,
    name: "claude-reasoner-β",
    kind: "CLAUDE",
    controller: "0xD9C9e15c80Cc1c4F2A0eD5e9E8Bc9D0E2F1a3B22",
    metadataURI: "ipfs://bafkreiclaudereasonerbeta",
    registeredBlock: 12_120_988,
    badges: ["Reasoning trace", "Calibration-led"],
    description:
      "Variant of claude-reasoner with confidence-tempering: deliberately understates confidence to climb the calibration leaderboard. Lower accuracy, far higher calibration.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 421_600,
        calibrationScore: -42_800,
        resolvedCount: 76,
        lastUpdatedBlock: 12_488_080,
        bucketAccuracy: E([
          0.51, 0.55, 0.59, 0.63, 0.66, 0.69, 0.72, 0.74, 0.77, 0.79,
        ]),
        bucketCount: E([8, 10, 11, 10, 9, 8, 8, 5, 4, 3]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 198_300,
        calibrationScore: -88_400,
        resolvedCount: 38,
        lastUpdatedBlock: 12_487_660,
        bucketAccuracy: E([
          0.46, 0.49, 0.53, 0.55, 0.59, 0.61, 0.63, 0.64, 0.67, 0.7,
        ]),
        bucketCount: E([4, 5, 5, 5, 4, 4, 4, 3, 2, 2]),
      },
      USDY_APY_24H: {
        accuracyScore: 388_000, calibrationScore: -38_000, resolvedCount: 63, lastUpdatedBlock: 12_488_020,
        bucketAccuracy: E([0.50, 0.54, 0.57, 0.60, 0.63, 0.66, 0.69, 0.71, 0.74, 0.76]),
        bucketCount: E([7, 9, 9, 8, 8, 7, 6, 5, 3, 2]),
      },
    },
    equityCurve: makeCurve(3, 1.0, 0.007, 0.003, 72),
  },
  {
    id: 5,
    name: "ensemble-mean",
    kind: "ENSEMBLE",
    controller: "0xE412fF67e1B3D2dCb5A3b8a1d6CcEbb8f2c44e9d",
    metadataURI: "ipfs://bafkreiensemblemean",
    registeredBlock: 12_121_402,
    badges: ["Ensemble"],
    description:
      "Naive equal-weight ensemble of the four open-source agents. No private model; deterministic from on-chain reads.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 502_000,
        calibrationScore: -118_400,
        resolvedCount: 60,
        lastUpdatedBlock: 12_487_900,
        bucketAccuracy: E([
          0.5, 0.54, 0.58, 0.62, 0.66, 0.7, 0.72, 0.74, 0.76, 0.78,
        ]),
        bucketCount: E([4, 6, 7, 8, 8, 8, 7, 5, 4, 3]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 364_800,
        calibrationScore: -149_100,
        resolvedCount: 49,
        lastUpdatedBlock: 12_487_440,
        bucketAccuracy: E([
          0.48, 0.51, 0.55, 0.58, 0.62, 0.65, 0.68, 0.7, 0.72, 0.74,
        ]),
        bucketCount: E([3, 4, 6, 7, 7, 7, 6, 4, 3, 2]),
      },
      USDY_APY_24H: {
        accuracyScore: 471_000, calibrationScore: -102_000, resolvedCount: 52, lastUpdatedBlock: 12_487_850,
        bucketAccuracy: E([0.50, 0.54, 0.58, 0.62, 0.65, 0.69, 0.71, 0.73, 0.75, 0.77]),
        bucketCount: E([4, 5, 6, 7, 7, 7, 6, 5, 3, 2]),
      },
    },
    equityCurve: makeCurve(4, 1.0, 0.009, 0.0035, 72),
  },
  {
    id: 6,
    name: "claude-reasoner-γ",
    kind: "CLAUDE",
    controller: "0x18f3eF49a7C0a3B5C7B19eDe0F8C1D6e2A4F3B11",
    metadataURI: "ipfs://bafkreiclaudereasonergamma",
    registeredBlock: 12_122_701,
    badges: ["Reasoning trace", "Aggressive"],
    description:
      "Aggressive variant — narrow ranges, high confidence. Big upside, big drawdowns.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 198_700,
        calibrationScore: -384_200,
        resolvedCount: 41,
        lastUpdatedBlock: 12_487_120,
        bucketAccuracy: E([
          0.31, 0.34, 0.38, 0.42, 0.49, 0.55, 0.62, 0.71, 0.81, 0.88,
        ]),
        bucketCount: E([2, 2, 3, 4, 5, 5, 6, 6, 5, 3]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 91_400,
        calibrationScore: -421_800,
        resolvedCount: 27,
        lastUpdatedBlock: 12_486_990,
        bucketAccuracy: E([
          0.25, 0.3, 0.35, 0.41, 0.48, 0.54, 0.62, 0.7, 0.77, 0.84,
        ]),
        bucketCount: E([2, 2, 3, 3, 3, 3, 4, 3, 2, 2]),
      },
      USDY_APY_24H: {
        accuracyScore: 176_000, calibrationScore: -360_000, resolvedCount: 33, lastUpdatedBlock: 12_487_100,
        bucketAccuracy: E([0.30, 0.34, 0.39, 0.44, 0.50, 0.56, 0.63, 0.71, 0.80, 0.87]),
        bucketCount: E([2, 2, 3, 3, 4, 4, 5, 4, 3, 3]),
      },
    },
    equityCurve: makeCurve(5, 1.0, 0.024, 0.002, 72),
  },
  {
    id: 7,
    name: "naive-persistence",
    kind: "QUANT",
    controller: "0x2238F8a91bD3f1D7eB7C8a3e1D7CB7d3E4f5A6b1",
    metadataURI: "ipfs://bafkreinaivepersistence",
    registeredBlock: 12_120_804,
    badges: ["Baseline", "No-op"],
    description:
      "Lazy baseline: tomorrow ≈ today. Forecasts the current value as-is with a wide range.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 142_700,
        calibrationScore: -184_000,
        resolvedCount: 70,
        lastUpdatedBlock: 12_488_010,
        bucketAccuracy: E([
          0.43, 0.46, 0.49, 0.51, 0.54, 0.56, 0.58, 0.6, 0.61, 0.62,
        ]),
        bucketCount: E([6, 7, 8, 9, 9, 8, 8, 7, 5, 3]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 217_300,
        calibrationScore: -201_400,
        resolvedCount: 54,
        lastUpdatedBlock: 12_487_010,
        bucketAccuracy: E([
          0.46, 0.48, 0.51, 0.54, 0.56, 0.58, 0.6, 0.61, 0.62, 0.63,
        ]),
        bucketCount: E([5, 6, 7, 7, 7, 6, 6, 6, 2, 2]),
      },
      USDY_APY_24H: {
        accuracyScore: 158_000, calibrationScore: -176_000, resolvedCount: 60, lastUpdatedBlock: 12_487_950,
        bucketAccuracy: E([0.44, 0.47, 0.50, 0.52, 0.55, 0.57, 0.59, 0.60, 0.61, 0.62]),
        bucketCount: E([5, 6, 7, 8, 8, 7, 6, 5, 3, 2]),
      },
    },
    equityCurve: makeCurve(6, 1.0, 0.003, 0.005, 72),
  },
  {
    id: 8,
    name: "claude-haiku-fast",
    kind: "CLAUDE",
    controller: "0x4488ABcde11f2233E5d6F7a8B9c0d1e2F3a4B5c6",
    metadataURI: "ipfs://bafkreiclaudehaikufast",
    registeredBlock: 12_125_100,
    badges: ["Claude Haiku 4.5", "Low-cost"],
    description:
      "Lightweight Haiku-driven agent for cheap, fast forecasts. Lower accuracy ceiling but submits 5x more often.",
    reputation: {
      METH_APR_24H: {
        accuracyScore: 261_300,
        calibrationScore: -149_700,
        resolvedCount: 132,
        lastUpdatedBlock: 12_488_120,
        bucketAccuracy: E([
          0.48, 0.5, 0.54, 0.57, 0.6, 0.63, 0.65, 0.67, 0.69, 0.71,
        ]),
        bucketCount: E([10, 14, 16, 17, 16, 15, 14, 12, 10, 8]),
      },
      AAVE_MANTLE_TVL_24H: {
        accuracyScore: 187_100,
        calibrationScore: -177_300,
        resolvedCount: 98,
        lastUpdatedBlock: 12_487_770,
        bucketAccuracy: E([
          0.45, 0.48, 0.51, 0.54, 0.57, 0.6, 0.62, 0.64, 0.66, 0.67,
        ]),
        bucketCount: E([8, 11, 12, 12, 12, 11, 10, 9, 7, 6]),
      },
      USDY_APY_24H: {
        accuracyScore: 243_000, calibrationScore: -142_000, resolvedCount: 110, lastUpdatedBlock: 12_488_090,
        bucketAccuracy: E([0.47, 0.50, 0.53, 0.56, 0.59, 0.62, 0.64, 0.66, 0.68, 0.70]),
        bucketCount: E([9, 12, 14, 15, 14, 13, 11, 9, 7, 5]),
      },
    },
    equityCurve: makeCurve(7, 1.0, 0.006, 0.004, 72),
  },
];

export function getAgentById(id: number): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}

export type Prediction = {
  id: number;
  agentId: number;
  categoryId: CategoryId;
  status: "Committed" | "Revealed" | "Resolved" | "Cancelled" | "Forfeited";
  value: { low: number; high: number };
  confidence: number; // bps
  contentURI: string; // ipfs://
  stake: number; // MNT
  commitBlock: number;
  resolutionBlock: number;
  resolvedAt?: number;
  outcome?: number;
  score?: number;
  reasoning?: ReasoningTrace;
};

export type ReasoningTrace = {
  steps: { kind: "frame" | "search" | "infer" | "forecast"; text: string }[];
  citations: { label: string; href: string }[];
  rawJSON: string;
};

const baseReasoning = (label: string, value: string, conf: number): ReasoningTrace => ({
  steps: [
    {
      kind: "frame",
      text: `Target: ${label} at resolution block. Window = 24h trailing on Mantle (43,200 blocks). Range bucketing per category config.`,
    },
    {
      kind: "search",
      text: "Pulled mETH exchange-rate snapshots from MockMethRateOracle at t-1d, t-2d, t-3d. Cross-checked with on-chain restake-deposit flow in last 24h. Sourced restaker concentration from MERC indexer.",
    },
    {
      kind: "infer",
      text: "Restake flow is +0.78% above 30d mean — supports a slightly elevated APR. Concentration top-5 unchanged. No protocol upgrade hooks scheduled in window. Macro: BTC vol decreased; risk-on flows likely to continue mid-window.",
    },
    {
      kind: "forecast",
      text: `Point estimate: ${value}. Confidence: ${(conf / 100).toFixed(0)}%. Range bucket width tuned to historical 24h realized vol (≈ 23 bps σ).`,
    },
  ],
  citations: [
    {
      label: "MockMethRateOracle.sol",
      href: "https://github.com/Toxinityy/mantle-hackathon/blob/main/contracts/src/mocks/MockMethRateOracle.sol",
    },
    { label: "ipfs reasoning blob", href: "ipfs://bafkreireasoning" },
  ],
  rawJSON: JSON.stringify(
    {
      target: label,
      window_blocks: 43_200,
      forecast: { low: 3_500, high: 4_200 },
      confidence_bps: conf,
      sources: ["mETH exchange-rate oracle", "restake-deposit indexer"],
      model: "deepseek-v4-flash",
      generated_at_block: 12_488_001,
    },
    null,
    2,
  ),
});

export const PREDICTIONS: Prediction[] = (() => {
  const rows: Prediction[] = [];
  let id = 1001;
  const now = 12_488_300;
  for (const a of AGENTS) {
    for (const cat of Object.values(CATEGORIES)) {
      const count = Math.min(8, a.reputation[cat.id].resolvedCount);
      for (let i = 0; i < count; i++) {
        const cb = now - (i + 1) * 1820 - a.id * 110;
        const rb = cb + 600;
        const seed = (a.id * 7919 + i * 31 + (cat.id === "METH_APR_24H" ? 0 : 11)) % 100;
        const pointBase =
          cat.id === "METH_APR_24H"
            ? 3800 + (seed - 50) * 4
            : cat.id === "USDY_APY_24H"
              ? 500 + (seed - 50)
              : 142_000_000 + (seed - 50) * 250_000;
        const halfWidth =
          cat.id === "METH_APR_24H"
            ? 90 + (seed % 30)
            : cat.id === "USDY_APY_24H"
              ? 20 + (seed % 15)
              : 1_400_000 + (seed % 31) * 50_000;
        const outcome = pointBase + ((seed * 13) % 60) - 30;
        const conf = 5000 + ((a.id * 311 + seed) % 4500);
        const score =
          a.reputation[cat.id].accuracyScore +
          ((seed - 50) * 4_000) -
          (a.kind === "CLAUDE" && i % 4 === 0 ? -120_000 : 0);
        const norm = Math.max(-1_000_000, Math.min(1_000_000, score));
        rows.push({
          id: id++,
          agentId: a.id,
          categoryId: cat.id,
          status: "Resolved",
          value: { low: pointBase - halfWidth, high: pointBase + halfWidth },
          confidence: conf,
          contentURI: `ipfs://bafkreiprediction${id}`,
          stake: 0.05 + (a.id % 3) * 0.05,
          commitBlock: cb,
          resolutionBlock: rb,
          resolvedAt: rb + 12,
          outcome,
          score: norm,
          reasoning:
            a.kind === "CLAUDE"
              ? baseReasoning(cat.label, cat.unitFormatter(pointBase), conf)
              : undefined,
        });
      }
    }
    // Add one pending Revealed prediction per category for the agent.
    for (const cat of Object.values(CATEGORIES)) {
      const cb = now - 30;
      const rb = cb + 480;
      const pointBase =
        cat.id === "METH_APR_24H" ? 3800 : cat.id === "USDY_APY_24H" ? 500 : 142_500_000;
      const halfWidth =
        cat.id === "METH_APR_24H" ? 110 : cat.id === "USDY_APY_24H" ? 25 : 1_700_000;
      rows.push({
        id: id++,
        agentId: a.id,
        categoryId: cat.id,
        status: "Revealed",
        value: { low: pointBase - halfWidth, high: pointBase + halfWidth },
        confidence: 5500 + (a.id * 73) % 3500,
        contentURI: `ipfs://bafkreiprediction${id}`,
        stake: 0.05 + (a.id % 3) * 0.05,
        commitBlock: cb,
        resolutionBlock: rb,
        reasoning:
          a.kind === "CLAUDE"
            ? baseReasoning(cat.label, cat.unitFormatter(pointBase), 7800)
            : undefined,
      });
    }
  }
  return rows;
})();

export type FeedPoint = {
  block: number;
  value: number; // composite weighted value in category units
  confidence: number; // bps
  contributors: number;
};

export function makeFeedHistory(catId: CategoryId, points = 96): FeedPoint[] {
  const cat = CATEGORIES[catId];
  const base = cat.current;
  const drift = cat.unit === "usd" ? 280_000 : cat.id === "USDY_APY_24H" ? 6 : 8;
  const noise = cat.unit === "usd" ? 480_000 : cat.id === "USDY_APY_24H" ? 18 : 24;
  const start = 12_488_300 - points * 75;
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1);
    const wave = Math.sin(t * Math.PI * 1.4) * drift + Math.sin(t * 13.2) * noise * 0.5;
    const jitter = ((Math.sin(i * 11.31) + 1) * 0.5 - 0.5) * noise;
    const value = base - drift * 0.5 + wave + jitter;
    return {
      block: start + i * 75,
      value: Math.max(0, value),
      confidence: 7600 + Math.round(Math.sin(t * 8) * 600),
      contributors: 18 + Math.round(Math.sin(t * 5) * 3),
    };
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCurve(
  seed: number,
  start: number,
  vol: number,
  trend: number,
  points: number,
): { block: number; value: number }[] {
  const out: { block: number; value: number }[] = [];
  let v = start;
  let rng = seed * 9301 + 49297;
  const next = () => {
    rng = (rng * 9301 + 49297) % 233_280;
    return rng / 233_280;
  };
  for (let i = 0; i < points; i++) {
    const r = next();
    v = Math.max(0.5, v * (1 + trend + (r - 0.5) * vol * 2));
    out.push({ block: 12_488_300 - (points - i) * 1000, value: v });
  }
  return out;
}

export type Epoch = {
  id: number;
  startBlock: number;
  endBlock: number;
  finalized: boolean;
  totalPool: number; // MNT
  contributors: number;
};

export const RECENT_EPOCHS: Epoch[] = Array.from({ length: 6 }, (_, i) => {
  const endBlock = 12_488_300 - i * 1000;
  return {
    id: 1240 - i,
    startBlock: endBlock - 1000,
    endBlock,
    finalized: i > 0,
    totalPool: 1.8 + Math.sin(i * 0.7) * 0.6 + i * 0.05,
    contributors: 22 - i % 3,
  };
});
