import { createConfig } from "ponder";
import { readFileSync } from "node:fs";

import { AgentRegistryAbi } from "./abis/AgentRegistryAbi";
import { PredictionMarketAbi } from "./abis/PredictionMarketAbi";
import { CompositeFeedAbi } from "./abis/CompositeFeedAbi";
import { BonusDistributorAbi } from "./abis/BonusDistributorAbi";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/// Resolve a contract address. Priority: explicit env var → deployments/<network>.json → zero.
/// Lets the indexer build/typecheck before a live deploy exists; once Deploy.s.sol broadcasts and
/// writes the JSON (or the operator sets env vars), real addresses flow in with no code change.
function loadDeployments(): Record<string, string> {
  const network = process.env.DEPLOY_NETWORK ?? "mantle-sepolia";
  try {
    const raw = readFileSync(
      new URL(`../contracts/deployments/${network}.json`, import.meta.url),
      "utf8",
    );
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

const deployments = loadDeployments();

function addr(name: string, envVar: string): `0x${string}` {
  const fromEnv = process.env[envVar];
  const fromJson = deployments[name];
  return (fromEnv ?? fromJson ?? ZERO) as `0x${string}`;
}

const startBlock = process.env.PONDER_START_BLOCK
  ? Number(process.env.PONDER_START_BLOCK)
  : 0;

export default createConfig({
  chains: {
    mantleSepolia: {
      id: 5003,
      rpc: process.env.PONDER_RPC_URL_MANTLE_SEPOLIA ?? "https://rpc.sepolia.mantle.xyz",
      // The public Mantle Sepolia RPC 429s under Ponder's default parallel eth_getLogs burst.
      // Throttle to stay under its limit. Raise this (or drop a paid Alchemy/Infura URL into
      // PONDER_RPC_URL_MANTLE_SEPOLIA) for a faster sustained sync.
      maxRequestsPerSecond: Number(process.env.PONDER_MAX_RPS ?? 3),
    },
  },
  contracts: {
    AgentRegistry: {
      chain: "mantleSepolia",
      abi: AgentRegistryAbi,
      address: addr("AgentRegistry", "ADDR_AGENT_REGISTRY"),
      startBlock,
    },
    PredictionMarket: {
      chain: "mantleSepolia",
      abi: PredictionMarketAbi,
      address: addr("PredictionMarket", "ADDR_PREDICTION_MARKET"),
      startBlock,
    },
    CompositeFeed: {
      chain: "mantleSepolia",
      abi: CompositeFeedAbi,
      address: addr("CompositeFeed", "ADDR_COMPOSITE_FEED"),
      startBlock,
    },
    BonusDistributor: {
      chain: "mantleSepolia",
      abi: BonusDistributorAbi,
      address: addr("BonusDistributor", "ADDR_BONUS_DISTRIBUTOR"),
      startBlock,
    },
  },
});
