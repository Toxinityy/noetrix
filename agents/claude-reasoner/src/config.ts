import "dotenv/config";
import { loadAddresses, type ContractAddresses } from "@predictor-index/sdk";
import type { Hex } from "viem";

export interface CategoryDef {
  /// SDK category label.
  label: string;
  /// Human description of what's being predicted + units (fed to Claude).
  description: string;
  /// CryptoPanic currency codes to pull news for.
  newsCurrencies: string[];
}

export interface ReasonerConfig {
  rpcUrl: string;
  chainId: number;
  controllerPrivateKey: Hex;
  agentId: bigint;
  indexerUrl: string;
  addresses: ContractAddresses;
  /// OpenRouter API key + OpenAI-compatible base URL (any OpenRouter-hosted model works).
  llmApiKey: string;
  llmBaseUrl: string;
  model: string;
  cryptoPanicToken?: string;
  categories: CategoryDef[];
  normalOffsetBlocks: bigint;
  seedOffsetBlocks: bigint;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): ReasonerConfig {
  return {
    rpcUrl: process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz",
    chainId: Number(process.env.CHAIN_ID ?? 5003),
    controllerPrivateKey: required("CONTROLLER_PRIVATE_KEY") as Hex,
    agentId: BigInt(required("AGENT_ID")),
    indexerUrl: process.env.INDEXER_URL ?? "http://localhost:42069",
    addresses: loadAddresses(),
    llmApiKey: required("OPENROUTER_API_KEY"),
    llmBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    model: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat-v3.1",
    cryptoPanicToken: process.env.CRYPTOPANIC_TOKEN,
    categories: [
      {
        label: "METH_APR_24H",
        description:
          "24h annualized staking APR of Mantle mETH, expressed in basis points (bps). Domain [0, 100000] bps " +
          "(0%–1000%); resolved by annualizing the mETH exchange-rate change over the prior day.",
        newsCurrencies: ["ETH", "MNT"],
      },
      {
        label: "AAVE_MANTLE_TVL_24H",
        description:
          "Total value locked in Aave on Mantle, in USD with 8 decimals (value = USD × 1e8). Domain [0, 1e17] " +
          "(up to ~$1B); resolved by summing reserve aToken supply × oracle price across the pool.",
        newsCurrencies: ["AAVE", "MNT", "ETH"],
      },
    ],
    normalOffsetBlocks: 43_200n, // ~24h
    seedOffsetBlocks: 350n, // ~12 min
  };
}
