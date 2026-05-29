import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Agent, loadAddresses, uploadContent, METH_APR_24H, AAVE_MANTLE_TVL_24H } from "@predictor-index/sdk";
import type { Hex } from "viem";

/// Build the agent metadata (§8.1.1), pin it to IPFS (if PINATA_JWT set), register on-chain with the
/// 0.1 MNT fee, then persist AGENT_ID to .env so the long-running agent can pick it up.

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
  const rpcUrl = process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz";
  const controllerPrivateKey = required("CONTROLLER_PRIVATE_KEY") as Hex;
  const addresses = loadAddresses();

  const metadata = {
    name: "ARIMA Baseline",
    description:
      "Statistical baseline agent. Fits ARIMA(1,1,1) on historical category outcomes and forecasts a 95% interval for the resolution block.",
    model: "ARIMA(1,1,1)",
    operator: "Predictor Index reference team",
    categories: [METH_APR_24H.id, AAVE_MANTLE_TVL_24H.id],
    homepage: "https://github.com/predictor-index",
    version: "0.1.0",
    license: "MIT",
  };

  const { contentHash, cid } = await uploadContent(metadata);
  // Prefer an ipfs:// URI when pinned; otherwise embed the JSON as a data URI so tokenURI still resolves.
  const finalURI = cid
    ? `ipfs://${cid}`
    : `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

  console.log(`[register] metadata contentHash=${contentHash}${cid ? ` cid=${cid}` : " (no IPFS — using data URI)"}`);

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
  console.log(`[register] minted agentId=${agentId}`);
  persistAgentId(agentId);
}

main().catch((err) => {
  console.error("[register] failed:", err);
  process.exit(1);
});
