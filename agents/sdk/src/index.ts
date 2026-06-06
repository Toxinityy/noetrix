export const PREDICTOR_SDK_VERSION = "0.1.0";

export { Agent, encodeRangeValue, type AgentOptions } from "./agent.js";
export { loadAddresses } from "./addresses.js";
export { uploadContent, type ContentUploadResult } from "./ipfs.js";
export {
  categoryId,
  resolveCategory,
  CATEGORIES,
  METH_APR_24H,
  AAVE_MANTLE_TVL_24H,
  USDY_APY_24H,
} from "./categories.js";
export { agentRegistryAbi, predictionMarketAbi } from "./abis.js";
export {
  PredictionStatus,
  type RangeValue,
  type PredictionValue,
  type ContractAddresses,
  type CategoryConfig,
  type OnChainCategory,
  type RevealMaterial,
  type CommitResult,
} from "./types.js";
