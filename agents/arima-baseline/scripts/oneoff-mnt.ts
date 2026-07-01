// One-off: execute the MNT_USD_SPOT keeper flow end-to-end so the Pyth category stops being
// dormant scaffolding — agent-1 commits+reveals a forecast, then the keeper records the real Pyth
// snapshot at the resolution block, resolves it (CRPS-scored), and refreshes the feed.
//
// Run from the arima package so @predictor-index/sdk resolves:
//   KEEPER_PRIVATE_KEY=0x... pnpm --filter @predictor-index/arima-baseline exec tsx scripts/oneoff-mnt.ts
// arima/.env supplies CONTROLLER_PRIVATE_KEY (agent 1) + RPC; KEEPER_PRIVATE_KEY is the deployer/keeper.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Agent, loadAddresses, resolveCategory } from "@predictor-index/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  parseEther,
  defineChain,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz";
const CHAIN_ID = 5003;
const HERMES = "https://hermes.pyth.network";
const FEED_ID = "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585" as Hex;
const PYTH_RESOLVER = "0x5CEa3D924c3f0Ac02BA4F17526c087D381bC5fF4" as Hex;
const PYTH = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603" as Hex;

const arimaKey = process.env.CONTROLLER_PRIVATE_KEY as Hex;
const keeperKey = process.env.KEEPER_PRIVATE_KEY as Hex;
if (!arimaKey || !keeperKey) throw new Error("need CONTROLLER_PRIVATE_KEY (arima) + KEEPER_PRIVATE_KEY (deployer)");

const dep = JSON.parse(readFileSync(new URL("../../../contracts/deployments/mantle-sepolia.json", import.meta.url), "utf8"));
const RESOLUTION_ENGINE = dep.ResolutionEngine as Hex;
const COMPOSITE_FEED = dep.CompositeFeed as Hex;
const PREDICTION_MARKET = dep.PredictionMarket as Hex;

const chain = defineChain({
  id: CHAIN_ID,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });
const keeper = createWalletClient({ account: privateKeyToAccount(keeperKey), chain, transport: http(RPC) });

const resolverAbi = parseAbi([
  "function record(uint256 resolutionBlock, bytes[] updateData) payable",
  "function recorded(uint256 resolutionBlock) view returns (bool)",
  "function snapshotPrice(uint256 resolutionBlock) view returns (uint256)",
]);
const pythAbi = parseAbi(["function getUpdateFee(bytes[] updateData) view returns (uint256)"]);
const reAbi = parseAbi(["function resolve(uint256 predictionId)"]);
const feedAbi = parseAbi([
  "function refresh(bytes32 categoryId)",
  "function read(bytes32 categoryId) view returns ((bytes value, uint16 confidence, uint256 contributingAgents, uint256 lastUpdatedBlock, uint32 disagreementBps))",
]);
const pmAbi = parseAbi([
  "function getPrediction(uint256 id) view returns ((uint256 agentId, bytes32 categoryId, bytes32 commitHash, bytes value, uint16 confidence, bytes32 contentHash, uint256 stake, uint256 commitBlock, uint256 resolutionBlock, uint8 status, int256 score))",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function hermesUpdate(): Promise<Hex[]> {
  const id = FEED_ID.slice(2);
  const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${id}&encoding=hex`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const json = (await res.json()) as { binary?: { data?: string[] }; parsed?: Array<{ price: { price: string; expo: number } }> };
  const data = json.binary?.data ?? [];
  if (!data.length) throw new Error("hermes: no update data");
  const p = json.parsed?.[0]?.price;
  const usd8 = p ? Math.round(Number(p.price) * 10 ** (p.expo + 8)) : 0;
  return Object.assign(data.map((d) => (d.startsWith("0x") ? d : `0x${d}`) as Hex), { usd8 } as never);
}

async function main() {
  const MNT = resolveCategory("MNT_USD_SPOT").id;
  const addresses = loadAddresses();
  const agent = new Agent({ agentId: 1n, controllerPrivateKey: arimaKey, rpcUrl: RPC, contractAddresses: addresses, chainId: CHAIN_ID });

  // Band around the real MNT/USD (8-dec), ±4% so a normal ~12-min drift still lands in-range.
  const live = await hermesUpdate();
  const spot = (live as unknown as { usd8: number }).usd8;
  const low = BigInt(Math.round(spot * 0.96));
  const high = BigInt(Math.round(spot * 1.04));
  console.log(`[oneoff] live MNT/USD = ${(spot / 1e8).toFixed(4)} → band [${(Number(low) / 1e8).toFixed(4)}, ${(Number(high) / 1e8).toFixed(4)}]`);

  const head = await pub.getBlockNumber();
  const resolutionBlock = head + 350n; // seed-like; > 300 min offset, < 50000 window
  const contentHash = keccak256(toHex(JSON.stringify({ agent: 1, category: "MNT_USD_SPOT", band: [low.toString(), high.toString()], note: "one-off keeper demo", head: head.toString() })));

  console.log(`[oneoff] head=${head} resolutionBlock=${resolutionBlock} — committing…`);
  const { predictionId, commitTx, revealTx } = await agent.submitFullCycle("MNT_USD_SPOT", { low, high }, 6500, resolutionBlock, contentHash, { stake: parseEther("0.05") });
  console.log(`[oneoff] prediction ${predictionId} committed (${commitTx.slice(0, 12)}) + revealed (${revealTx.slice(0, 12)})`);

  console.log(`[oneoff] waiting for block > ${resolutionBlock} (~12 min)…`);
  for (;;) {
    const b = await pub.getBlockNumber();
    if (b > resolutionBlock) break;
    console.log(`[oneoff]   block ${b} / ${resolutionBlock} (${Number(resolutionBlock - b) * 2}s to go)`);
    await sleep(30_000);
  }

  // Keeper: pin the real Pyth snapshot for the resolution block (first write wins).
  const already = await pub.readContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "recorded", args: [resolutionBlock] });
  if (!already) {
    const updateData = await hermesUpdate();
    const fee = await pub.readContract({ address: PYTH, abi: pythAbi, functionName: "getUpdateFee", args: [updateData] });
    console.log(`[oneoff] keeper record{value:${fee}}(${resolutionBlock})…`);
    const tx = await keeper.writeContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "record", args: [resolutionBlock, updateData], value: fee, gas: 3_000_000n });
    const rc = await pub.waitForTransactionReceipt({ hash: tx });
    console.log(`[oneoff] record ${rc.status} (${tx.slice(0, 12)})`);
  } else {
    console.log(`[oneoff] snapshot already recorded for ${resolutionBlock}`);
  }
  const snap = await pub.readContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "snapshotPrice", args: [resolutionBlock] });
  console.log(`[oneoff] pinned snapshotPrice = ${(Number(snap) / 1e8).toFixed(4)} USD`);

  console.log(`[oneoff] resolve(${predictionId})…`);
  const rtx = await keeper.writeContract({ address: RESOLUTION_ENGINE, abi: reAbi, functionName: "resolve", args: [predictionId], gas: 3_000_000n });
  const rrc = await pub.waitForTransactionReceipt({ hash: rtx });
  console.log(`[oneoff] resolve ${rrc.status} (${rtx.slice(0, 12)})`);

  console.log(`[oneoff] refresh(MNT_USD_SPOT)…`);
  try {
    const ftx = await keeper.writeContract({ address: COMPOSITE_FEED, abi: feedAbi, functionName: "refresh", args: [MNT], gas: 3_000_000n });
    await pub.waitForTransactionReceipt({ hash: ftx });
    console.log(`[oneoff] refresh ok (${ftx.slice(0, 12)})`);
  } catch (e) {
    console.log(`[oneoff] refresh skipped: ${(e as Error).message.split("\n")[0]}`);
  }

  const p = await pub.readContract({ address: PREDICTION_MARKET, abi: pmAbi, functionName: "getPrediction", args: [predictionId] });
  const feed = await pub.readContract({ address: COMPOSITE_FEED, abi: feedAbi, functionName: "read", args: [MNT] });
  console.log(`\n[oneoff] DONE — prediction ${predictionId}: status=${p.status} (2=Resolved) score=${p.score}`);
  console.log(`[oneoff] CompositeFeed.read(MNT): contributors=${feed.contributingAgents} lastUpdatedBlock=${feed.lastUpdatedBlock}`);
}

main().catch((e) => {
  console.error("[oneoff] FAILED:", e);
  process.exit(1);
});
