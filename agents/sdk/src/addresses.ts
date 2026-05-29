import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import type { ContractAddresses } from "./types.js";

const ZERO = "0x0000000000000000000000000000000000000000";

function isReal(a: string | undefined): a is Hex {
  return !!a && a.length === 42 && a.toLowerCase() !== ZERO;
}

/// Resolve contract addresses. Priority: explicit env (ADDR_AGENT_REGISTRY / ADDR_PREDICTION_MARKET)
/// → deployments JSON (DEPLOYMENTS_FILE, else contracts/deployments/<DEPLOY_NETWORK>.json relative to
/// cwd) → throw. Mirrors the indexer's loader so all off-chain code resolves the same addresses.
export function loadAddresses(opts?: {
  network?: string;
  deploymentsFile?: string;
}): ContractAddresses {
  const envRegistry = process.env.ADDR_AGENT_REGISTRY;
  const envMarket = process.env.ADDR_PREDICTION_MARKET;
  if (isReal(envRegistry) && isReal(envMarket)) {
    return { agentRegistry: envRegistry, predictionMarket: envMarket };
  }

  const network = opts?.network ?? process.env.DEPLOY_NETWORK ?? "mantle-sepolia";
  const file =
    opts?.deploymentsFile ??
    process.env.DEPLOYMENTS_FILE ??
    resolve(process.cwd(), "..", "..", "contracts", "deployments", `${network}.json`);

  let json: Record<string, string>;
  try {
    json = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    throw new Error(
      `Could not resolve contract addresses. Set ADDR_AGENT_REGISTRY + ADDR_PREDICTION_MARKET, ` +
        `or ensure a deployments file exists at ${file} (set DEPLOYMENTS_FILE to override).`,
    );
  }

  const agentRegistry = envRegistry ?? json.AgentRegistry;
  const predictionMarket = envMarket ?? json.PredictionMarket;
  if (!isReal(agentRegistry) || !isReal(predictionMarket)) {
    throw new Error(`deployments file ${file} missing AgentRegistry/PredictionMarket addresses`);
  }
  return { agentRegistry, predictionMarket };
}
