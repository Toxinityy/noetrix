import { keccak256, toBytes, type Hex } from "viem";
import type { CategoryId } from "@/lib/mockData";

/// keccak256 of the category label — matches the contract's `keccak256("LABEL")` id derivation.
export function categoryHash(label: CategoryId): Hex {
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
