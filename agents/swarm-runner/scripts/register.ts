import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  Agent,
  loadAddresses,
  uploadContent,
  METH_APR_24H,
  AAVE_MANTLE_TVL_24H,
  USDY_APY_24H,
} from "@predictor-index/sdk";
import type { Hex } from "viem";
import { parseStrategy, STRATEGIES } from "../src/strategy.js";

/// Build the agent metadata (§8.1.1) for the configured STRATEGY, pin it to IPFS (if PINATA_JWT set),
/// register on-chain with the 0.1 MNT fee, then persist AGENT_ID to .env. Run once per strategy with
/// its own CONTROLLER_PRIVATE_KEY (separate hot wallet) — each mints a distinct swarm agent.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function persistAgentId(agentId: bigint): void {
  const envPath = resolve(process.cwd(), ".env");
  const line = `AGENT_ID=${agentId}`;
  let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (/^AGENT_ID=.*$/m.test(contents)) {
    contents = contents.replace(/^AGENT_ID=.*$/m, line);
  } else {
    contents += (contents.endsWith("\n") || contents === "" ? "" : "\n") + line + "\n";
  }
  writeFileSync(envPath, contents);
  console.log(`[register] wrote ${line} to ${envPath}`);
}

async function main(): Promise<void> {
  const strategy = parseStrategy(process.env.STRATEGY);
  const meta = STRATEGIES[strategy];
  const rpcUrl = process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz";
  const controllerPrivateKey = required("CONTROLLER_PRIVATE_KEY") as Hex;
  const addresses = loadAddresses();

  const metadata = {
    name: meta.name,
    description: `${meta.description} (swarm-runner reference agent; forecast logic in @predictor-index/forecasters)`,
    model: meta.model,
    operator: "Predictor Index reference team",
    categories: [METH_APR_24H.id, AAVE_MANTLE_TVL_24H.id, USDY_APY_24H.id],
    homepage: "https://github.com/predictor-index",
    version: "0.1.0",
    license: "MIT",
  };

  const { contentHash, cid } = await uploadContent(metadata);
  const finalURI = cid
    ? `ipfs://${cid}`
    : `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

  console.log(
    `[register] ${meta.name} metadata contentHash=${contentHash}${cid ? ` cid=${cid}` : " (no IPFS — using data URI)"}`,
  );

  // agentId unknown until minted; register() ignores the constructor agentId.
  const agent = new Agent({
    agentId: 0n,
    controllerPrivateKey,
    rpcUrl,
    contractAddresses: addresses,
    chainId: Number(process.env.CHAIN_ID ?? 5003),
  });

  console.log(`[register] controller=${agent.account.address} — sending register() with 0.1 MNT fee`);
  const agentId = await agent.register(finalURI);
  console.log(`[register] minted agentId=${agentId} for ${meta.name}`);
  persistAgentId(agentId);
}

main().catch((err) => {
  console.error("[register] failed:", err);
  process.exit(1);
});
