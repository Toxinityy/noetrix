import type { Hex } from "viem";

/// On-chain prediction lifecycle (mirrors IPredictionMarket.PredictionStatus order).
export enum PredictionStatus {
  Committed = 0,
  Revealed = 1,
  Resolved = 2,
  Cancelled = 3,
  Forfeited = 4,
}

/// A forecast as an inclusive [low, high] range over the category's domain (raw integer units —
/// bps for METH_APR_24H, USD 8-dec for AAVE_MANTLE_TVL_24H). The RangeCrpsScorer treats this as a
/// uniform band; both bounds are snapped to bucket boundaries on-chain.
export interface RangeValue {
  low: bigint;
  high: bigint;
}

/// A value the SDK can submit: either a structured range (encoded internally) or pre-encoded bytes.
export type PredictionValue = RangeValue | Hex;

export interface ContractAddresses {
  agentRegistry: Hex;
  predictionMarket: Hex;
}

export interface CategoryConfig {
  /// keccak256 of the category label, e.g. keccak256("METH_APR_24H").
  id: Hex;
  label: string;
  domainMin: bigint;
  domainMax: bigint;
  bucketCount: number;
}

/// On-chain category registration (subset surfaced by getCategoryConfig).
export interface OnChainCategory {
  resolver: Hex;
  scorer: Hex;
  minStake: bigint;
  allowedWindowStart: bigint;
  allowedWindowEnd: bigint;
  registered: boolean;
  /// Decoded RangeCrpsScorer domain (from configBytes), present when configBytes decodes cleanly.
  domainMin?: bigint;
  domainMax?: bigint;
}

/// Everything needed to reveal a previously-committed prediction. Returned by commit() and held
/// in-memory by the Agent; persist this if reveal happens in a different process than commit.
export interface RevealMaterial {
  predictionId: bigint;
  value: Hex;
  confidence: number;
  nonce: Hex;
  commitBlock: bigint;
}

export interface CommitResult extends RevealMaterial {
  commitHash: Hex;
  contentHash: Hex;
  resolutionBlock: bigint;
  txHash: Hex;
}
