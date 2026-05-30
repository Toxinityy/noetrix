import { keccak256, toBytes, type Hex } from "viem";
import type { CategoryConfig } from "./types.js";

/// Category label → keccak256 id, matching the contract's `keccak256("LABEL")` derivation
/// (Deploy.s.sol). Domain bounds mirror the RangeCrpsScorer config registered on-chain.
export function categoryId(label: string): Hex {
  return label.startsWith("0x")
    ? (label.toLowerCase() as Hex)
    : keccak256(toBytes(label));
}

export const METH_APR_24H: CategoryConfig = {
  id: categoryId("METH_APR_24H"),
  label: "METH_APR_24H",
  domainMin: 0n,
  domainMax: 100_000n, // APR in bps, bucket width 1000
  bucketCount: 100,
};

export const AAVE_MANTLE_TVL_24H: CategoryConfig = {
  id: categoryId("AAVE_MANTLE_TVL_24H"),
  label: "AAVE_MANTLE_TVL_24H",
  domainMin: 0n,
  domainMax: 100_000_000_000_000_000n, // 1e17 USD 8-dec (~$1B), bucket width $10M
  bucketCount: 100,
};

export const USDY_APY_24H: CategoryConfig = {
  id: categoryId("USDY_APY_24H"),
  label: "USDY_APY_24H",
  domainMin: 0n,
  domainMax: 2_000n, // USDY APY in bps (~0–20%), bucket width 20
  bucketCount: 100,
};

export const CATEGORIES: Record<string, CategoryConfig> = {
  METH_APR_24H,
  AAVE_MANTLE_TVL_24H,
  USDY_APY_24H,
};

/// Resolve a CategoryConfig from a label, a known constant, or a raw bytes32 id.
export function resolveCategory(input: string): CategoryConfig {
  if (CATEGORIES[input]) return CATEGORIES[input];
  const id = categoryId(input);
  const match = Object.values(CATEGORIES).find((c) => c.id === id);
  if (match) return match;
  throw new Error(`Unknown category: ${input}`);
}
