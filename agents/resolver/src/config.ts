import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keccak256, toBytes, type Hex } from "viem";

/// Keeper-snapshot config for the live Pyth spot category. When present, the resolver first RECORDS
/// the real Pyth price for a matured prediction's resolutionBlock (pushing a signed Hermes update
/// on-chain), then resolves — see PythSpotResolver. Undefined → the bot runs the plain resolve path
/// only (category not deployed yet).
export interface PythConfig {
  resolver: Hex; // PythSpotResolver (this bot's wallet must be its keeper)
  categoryId: Hex; // keccak256("MNT_USD_SPOT")
  feedId: Hex; // Pyth price-feed id
  pythAddress: Hex; // deployed Pyth pull-oracle (for getUpdateFee)
  hermesUrl: string; // Hermes REST base (signed updates)
}

export interface ResolverConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: Hex;
  predictionMarket: Hex;
  resolutionEngine: Hex;
  /// Poll cadence (ms). Default 1 min.
  intervalMs: number;
  /// Present only when the Pyth spot category is deployed + configured.
  pyth?: PythConfig;
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

/// Build the Pyth keeper config iff the resolver address AND the external Pyth address are available.
/// Missing either → undefined (bot runs the plain resolve path only).
function loadPythConfig(): PythConfig | undefined {
  const pythAddress = process.env.PYTH_ADDRESS;
  if (!isReal(pythAddress)) return undefined;
  let resolverAddr: Hex;
  try {
    resolverAddr = loadAddress("ADDR_PYTH_SPOT_RESOLVER", "PythSpotResolver");
  } catch {
    return undefined; // category not deployed yet
  }
  return {
    resolver: resolverAddr,
    categoryId: keccak256(toBytes("MNT_USD_SPOT")),
    feedId: (process.env.PYTH_FEED_ID ??
      "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585") as Hex, // MNT/USD
    pythAddress,
    hermesUrl: process.env.HERMES_URL ?? "https://hermes.pyth.network",
  };
}

export function loadConfig(): ResolverConfig {
  return {
    rpcUrl: process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz",
    chainId: Number(process.env.CHAIN_ID ?? 5003),
    privateKey: required("RESOLVER_PRIVATE_KEY") as Hex,
    predictionMarket: loadAddress("ADDR_PREDICTION_MARKET", "PredictionMarket"),
    resolutionEngine: loadAddress("ADDR_RESOLUTION_ENGINE", "ResolutionEngine"),
    intervalMs: Number(process.env.RESOLVE_INTERVAL_MS ?? 60_000),
    pyth: loadPythConfig(),
  };
}
