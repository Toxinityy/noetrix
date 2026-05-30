import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";

export interface ResolverConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: Hex;
  predictionMarket: Hex;
  resolutionEngine: Hex;
  /// Poll cadence (ms). Default 1 min.
  intervalMs: number;
}

const ZERO = "0x0000000000000000000000000000000000000000";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function isReal(a: string | undefined): a is Hex {
  return !!a && a.length === 42 && a.toLowerCase() !== ZERO;
}

/// Resolve a contract address: ADDR_<NAME> env → deployments JSON → throw.
function loadAddress(envName: string, jsonKey: string): Hex {
  const fromEnv = process.env[envName];
  if (isReal(fromEnv)) return fromEnv;

  const network = process.env.DEPLOY_NETWORK ?? "mantle-sepolia";
  const file =
    process.env.DEPLOYMENTS_FILE ??
    resolve(process.cwd(), "..", "..", "contracts", "deployments", `${network}.json`);
  try {
    const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    if (isReal(json[jsonKey])) return json[jsonKey] as Hex;
  } catch {
    /* fall through to throw */
  }
  throw new Error(`Could not resolve ${jsonKey} address. Set ${envName} or ensure ${file} has it.`);
}

export function loadConfig(): ResolverConfig {
  return {
    rpcUrl: process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz",
    chainId: Number(process.env.CHAIN_ID ?? 5003),
    privateKey: required("RESOLVER_PRIVATE_KEY") as Hex,
    predictionMarket: loadAddress("ADDR_PREDICTION_MARKET", "PredictionMarket"),
    resolutionEngine: loadAddress("ADDR_RESOLUTION_ENGINE", "ResolutionEngine"),
    intervalMs: Number(process.env.RESOLVE_INTERVAL_MS ?? 60_000),
  };
}
