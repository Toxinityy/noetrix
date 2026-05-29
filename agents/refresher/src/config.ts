import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { categoryId } from "@predictor-index/sdk";
import type { Hex } from "viem";

export interface RefresherConfig {
  rpcUrl: string;
  chainId: number;
  privateKey: Hex;
  compositeFeed: Hex;
  /// Category ids to refresh each tick.
  categories: { label: string; id: Hex }[];
  /// Refresh cadence (ms). Default 5 min ≈ 150 blocks on Mantle 2s blocks.
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

/// Resolve CompositeFeed address: ADDR_COMPOSITE_FEED env → deployments JSON → throw.
function loadCompositeFeed(): Hex {
  const fromEnv = process.env.ADDR_COMPOSITE_FEED;
  if (isReal(fromEnv)) return fromEnv;

  const network = process.env.DEPLOY_NETWORK ?? "mantle-sepolia";
  const file =
    process.env.DEPLOYMENTS_FILE ??
    resolve(process.cwd(), "..", "..", "contracts", "deployments", `${network}.json`);
  try {
    const json = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    if (isReal(json.CompositeFeed)) return json.CompositeFeed as Hex;
  } catch {
    /* fall through to throw */
  }
  throw new Error(
    `Could not resolve CompositeFeed address. Set ADDR_COMPOSITE_FEED or ensure ${file} has it.`,
  );
}

export function loadConfig(): RefresherConfig {
  return {
    rpcUrl: process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz",
    chainId: Number(process.env.CHAIN_ID ?? 5003),
    privateKey: required("REFRESHER_PRIVATE_KEY") as Hex,
    compositeFeed: loadCompositeFeed(),
    categories: [
      { label: "METH_APR_24H", id: categoryId("METH_APR_24H") },
      { label: "AAVE_MANTLE_TVL_24H", id: categoryId("AAVE_MANTLE_TVL_24H") },
    ],
    intervalMs: Number(process.env.REFRESH_INTERVAL_MS ?? 5 * 60 * 1000),
  };
}
