// Polls AgentRegistry.getReputation for agents 1 & 2 across the 3 categories every 45s.
// Exits 0 when every category has at least one agent with resolvedCount >= TARGET
// (so CompositeFeed.refresh will find a top-20 contributor). Safety cap ~50 min.
import { createPublicClient, http, keccak256, toBytes, defineChain } from "viem";

const RPC = process.env.RPC;
const REGISTRY = "0xf43f5b4E7Ab1F4dd69E35974Bc2fB47AC0311349";
const TARGET = Number(process.env.TARGET ?? 11);
const CATS = ["METH_APR_24H", "USDY_APY_24H", "AAVE_MANTLE_TVL_24H"];
const AGENTS = [1, 2];
const MAX_MS = 50 * 60 * 1000;

const chain = defineChain({ id: 5003, name: "ms", nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 }, rpcUrls: { default: { http: [] } } });
const client = createPublicClient({ chain, transport: http(RPC) });
const abi = [{ type: "function", name: "getReputation", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "bytes32" }], outputs: [{ type: "tuple", components: [
  { name: "accuracyScore", type: "int256" }, { name: "calibrationScore", type: "int256" }, { name: "resolvedCount", type: "uint256" },
  { name: "lastUpdatedBlock", type: "uint256" }, { name: "bucketAccuracy", type: "int256[10]" }, { name: "bucketCount", type: "uint256[10]" } ] }] }];

const start = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

while (true) {
  const lines = [];
  let allMet = true;
  for (const cat of CATS) {
    const id = keccak256(toBytes(cat));
    const counts = [];
    for (const a of AGENTS) {
      try {
        const rep = await client.readContract({ address: REGISTRY, abi, functionName: "getReputation", args: [BigInt(a), id] });
        counts.push(Number(rep.resolvedCount));
      } catch { counts.push(-1); }
    }
    const max = Math.max(...counts);
    if (max < TARGET) allMet = false;
    lines.push(`${cat}: a1=${counts[0]} a2=${counts[1]} (max ${max}/${TARGET}${max >= TARGET ? " OK" : ""})`);
  }
  const mins = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`[monitor +${mins}m] ${lines.join(" | ")}`);
  if (allMet) { console.log("[monitor] TARGET MET — all categories have a qualifying agent."); process.exit(0); }
  if (Date.now() - start > MAX_MS) { console.log("[monitor] TIMEOUT — safety cap reached."); process.exit(2); }
  await sleep(45000);
}
