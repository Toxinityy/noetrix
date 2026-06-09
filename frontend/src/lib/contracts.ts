import { keccak256, toBytes, type Hex } from "viem";

/// keccak256 of the category label — matches the contract's `keccak256("LABEL")` id derivation.
/// Accepts any label string (METH_APR_24H, AAVE_MANTLE_TVL_24H, USDY_APY_24H, …).
export function categoryHash(label: string): Hex {
  return keccak256(toBytes(label));
}

/// CompositeFeed.read — consumer-facing ensemble forecast. value = abi.encode(uint256 point estimate).
export const compositeFeedAbi = [
  {
    type: "function",
    name: "read",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "value", type: "bytes" },
          { name: "confidence", type: "uint16" },
          { name: "contributingAgents", type: "uint256" },
          { name: "lastUpdatedBlock", type: "uint256" },
          { name: "disagreementBps", type: "uint32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "refresh",
    stateMutability: "nonpayable",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [],
  },
  { type: "error", name: "RateLimited", inputs: [] },
  { type: "error", name: "NotConfigured", inputs: [] },
  { type: "error", name: "NoAccess", inputs: [] },
] as const;

/// DemoFeedConsumer — example protocol business-logic views over the composite feed.
export const demoConsumerAbi = [
  {
    type: "function",
    name: "getCurrentMethApr",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "confidence", type: "uint16" },
    ],
  },
  {
    type: "function",
    name: "getCurrentAaveTvl",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "value", type: "uint256" },
      { name: "confidence", type: "uint16" },
    ],
  },
  {
    type: "function",
    name: "shouldAllowDeposits",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "shouldThrottleRisk",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/// Mirrors DemoFeedConsumer's on-chain thresholds so the UI can show the same decision when the
/// contract isn't deployed (derived client-side from the feed value).
export const DEMO_THRESHOLDS = {
  methAprDepositBps: 400,
  aaveTvlThrottle: 500_000_000 * 1e8, // $500M in USD 8-dec
} as const;

/// YieldAllocator — confidence-weighted dynamic allocation across mETH + USDY.
export const yieldAllocatorAbi = [
  {
    type: "function",
    name: "getAllocation",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "allocMethBps", type: "uint256" },
      { name: "allocUsdyBps", type: "uint256" },
      { name: "methYield", type: "uint256" },
      { name: "usdyYield", type: "uint256" },
    ],
  },
  { type: "function", name: "rebalanceSignal", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

/// RiskManager — per-asset risk params derived from forecast confidence + freshness.
export const riskManagerAbi = [
  {
    type: "function",
    name: "riskState",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "collateralFactor",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "depositCap",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isPaused",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/// Web2 jargon translation used across the /rwa surface.
export const RWA_LABELS = {
  meth: { name: "mETH staking yield", short: "mETH", blurb: "Liquid-staked ETH on Mantle" },
  usdy: { name: "USDY treasury yield", short: "USDY", blurb: "Tokenized US Treasuries (Ondo)" },
} as const;

/// Friendly risk-state labels — index matches the RiskManager.State enum (0 Normal, 1 Caution, 2 Frozen).
export const RISK_STATE_UI = ["Looking healthy", "Cautious", "Paused"] as const;

/// SubscriptionGate — paid subscription rail (native MNT). Tier enum: 0 None, 1 Pro, 2 Protocol.
export const SUB_TIER = { Pro: 1, Protocol: 2 } as const;
export type SubTier = (typeof SUB_TIER)[keyof typeof SUB_TIER];

export const subscriptionGateAbi = [
  {
    type: "function",
    name: "subscribe",
    stateMutability: "payable",
    inputs: [{ name: "tier", type: "uint8" }],
    outputs: [],
  },
  {
    type: "function",
    name: "subscriptionExpiry",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tierOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint8" }],
  },
  { type: "function", name: "proPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "protocolPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "error", name: "BadTier", inputs: [] },
  {
    type: "error",
    name: "InsufficientPayment",
    inputs: [
      { name: "required", type: "uint256" },
      { name: "sent", type: "uint256" },
    ],
  },
] as const;
