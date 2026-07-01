import "dotenv/config";
import { loadAddresses, type ContractAddresses } from "@predictor-index/sdk";
import type { Hex } from "viem";

export interface CategorySeed {
  /// SDK category label.
  label: string;
  /// Center value (domain units) for synthetic seed data when <10 historical points exist.
  syntheticCenter: number;
  /// Per-step relative drift for the synthetic series.
  syntheticDriftPpm: number;
}

export interface ArimaConfig {
  rpcUrl: string;
  chainId: number;
  controllerPrivateKey: Hex;
  agentId: bigint;
  indexerUrl: string;
  addresses: ContractAddresses;
  categories: CategorySeed[];
  /// Resolution offset (blocks) used in normal mode (~24h on 2s blocks).
  normalOffsetBlocks: bigint;
  /// Resolution offset (blocks) used in seed mode (~12 min, safely past 200+100 cutoff).
  seedOffsetBlocks: bigint;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): ArimaConfig {
  const rpcUrl = process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz";
  const controllerPrivateKey = required("CONTROLLER_PRIVATE_KEY") as Hex;
  const agentId = BigInt(required("AGENT_ID"));
  const indexerUrl = process.env.INDEXER_URL ?? "http://localhost:42069";
  const addresses = loadAddresses();

  return {
    rpcUrl,
    chainId: Number(process.env.CHAIN_ID ?? 5003),
    controllerPrivateKey,
    agentId,
    indexerUrl,
    addresses,
    categories: [
      { label: "METH_APR_24H", syntheticCenter: 350, syntheticDriftPpm: 800 }, // ~3.5% APR bps (domain [0,2000]; oracle resolves ≈350)
      { label: "AAVE_MANTLE_TVL_24H", syntheticCenter: 1.4e16, syntheticDriftPpm: 500 }, // ~$140M, 8-dec
      { label: "USDY_APY_24H", syntheticCenter: 500, syntheticDriftPpm: 300 }, // ~5% APY bps
      { label: "MNT_USD_SPOT", syntheticCenter: 50_000_000, syntheticDriftPpm: 1500 }, // MNT/USD ≈ $0.50, 8-dec USD (domain [0,5e8])
    ],
    normalOffsetBlocks: 43_200n, // ~24h
    seedOffsetBlocks: 350n, // ~12 min, > 200 cutoff + 100 reveal window
  };
}
