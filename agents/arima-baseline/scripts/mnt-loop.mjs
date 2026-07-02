// Durable MNT_USD_SPOT accrual loop — keeps the Pyth spot category live so its on-chain track
// record grows on its own (was a one-off; this repeats it forever).
//
// Each cycle: agent commits+reveals a live-priced band → refreshes the feed (captures the Revealed
// forecast once the agent clears the ≥10-resolved top-agent gate) → waits for the resolution block →
// keeper pins the real Pyth snapshot (first-write-wins) → resolves (CRPS-scored). ~12 min/cycle.
//
// Run from the arima package dir so @predictor-index/sdk + viem + dotenv resolve:
//   cd agents/arima-baseline && nohup node scripts/mnt-loop.mjs > /tmp/mnt-loop.log 2>&1 &
// arima/.env supplies CONTROLLER_PRIVATE_KEY (agent 1) + ADDR_* + RPC (via dotenv/config, cwd=arima).
// The keeper key is read from ../resolver/.env (RESOLVER_PRIVATE_KEY) — that wallet is the on-chain
// keeper, kept separate from the agent so the "referee" isn't the "player".
//
// ponytail: agent 1 + resolver keys are each also used by their own running bots (arima / resolver).
// Cross-process nonce collisions are possible but rare (cycles are ~350 blocks apart); a failed cycle
// is caught and retried. Upgrade to a dedicated key only if collisions actually bite.
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
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.MANTLE_SEPOLIA_RPC ?? "https://rpc.sepolia.mantle.xyz";
const CHAIN_ID = 5003;
const HERMES = "https://hermes.pyth.network";
const FEED_ID = "0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585";
const PYTH_RESOLVER = "0x5CEa3D924c3f0Ac02BA4F17526c087D381bC5fF4";
const PYTH = "0x98046Bd286715D3B0BC227Dd7a956b83D8978603";
const RESOLUTION_ENGINE = "0xBB62C1948D35DCf60259c2003bbf3d9578DDB825";
const COMPOSITE_FEED = "0x695aC1428FcFAb4406468A664FD7670b968aB689";
const PREDICTION_MARKET = "0xaa92b0434F89a17F2275b655c6fA459C43813f22";
const AGENT_ID = BigInt(process.env.AGENT_ID ?? "1");
const STAKE = parseEther(process.env.MNT_STAKE ?? "0.05");
const OFFSET = BigInt(process.env.MNT_OFFSET ?? "350"); // blocks; > MIN_RESOLUTION_OFFSET (300)

const norm = (k) => (k?.startsWith("0x") ? k : `0x${k}`);
function envFrom(path, key) {
  const line = readFileSync(new URL(path, import.meta.url), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not in ${path}`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

const arimaKey = norm(process.env.CONTROLLER_PRIVATE_KEY);
const keeperKey = norm(envFrom("../../resolver/.env", "RESOLVER_PRIVATE_KEY"));
if (!process.env.CONTROLLER_PRIVATE_KEY) throw new Error("CONTROLLER_PRIVATE_KEY missing (run from arima dir)");

const chain = defineChain({
  id: CHAIN_ID,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });
const keeperAcct = privateKeyToAccount(keeperKey);
const keeper = createWalletClient({ account: keeperAcct, chain, transport: http(RPC) });

const resolverAbi = parseAbi([
  "function record(uint256 resolutionBlock, bytes[] updateData) payable",
  "function recorded(uint256 resolutionBlock) view returns (bool)",
  "function snapshotPrice(uint256 resolutionBlock) view returns (uint256)",
]);
const pythAbi = parseAbi(["function getUpdateFee(bytes[] updateData) view returns (uint256)"]);
const reAbi = parseAbi(["function resolve(uint256 predictionId)"]);
const feedAbi = parseAbi(["function refresh(bytes32 categoryId)"]);
const pmAbi = parseAbi([
  "function getPrediction(uint256 id) view returns ((uint256 agentId, bytes32 categoryId, bytes32 commitHash, bytes value, uint16 confidence, bytes32 contentHash, uint256 stake, uint256 commitBlock, uint256 resolutionBlock, uint8 status, int256 score))",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[mnt ${ts()}] ${m}`);

async function hermesUpdate() {
  const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=${FEED_ID.slice(2)}&encoding=hex`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const json = await res.json();
  const data = (json.binary?.data ?? []).map((d) => (d.startsWith("0x") ? d : `0x${d}`));
  if (!data.length) throw new Error("hermes: no update data");
  const p = json.parsed?.[0]?.price;
  const usd8 = p ? Math.round(Number(p.price) * 10 ** (p.expo + 8)) : 0;
  return { data, usd8 };
}

const MNT = resolveCategory("MNT_USD_SPOT").id;
const agent = new Agent({
  agentId: AGENT_ID,
  controllerPrivateKey: arimaKey,
  rpcUrl: RPC,
  contractAddresses: loadAddresses(),
  chainId: CHAIN_ID,
});

async function cycle(n) {
  const { usd8: spot } = await hermesUpdate();
  const low = BigInt(Math.round(spot * 0.96));
  const high = BigInt(Math.round(spot * 1.04));
  const head = await pub.getBlockNumber();
  const resolutionBlock = head + OFFSET;
  const contentHash = keccak256(
    toHex(JSON.stringify({ agent: Number(AGENT_ID), category: "MNT_USD_SPOT", band: [low.toString(), high.toString()], head: head.toString() })),
  );
  log(`#${n} spot=${(spot / 1e8).toFixed(4)} band=[${(Number(low) / 1e8).toFixed(4)},${(Number(high) / 1e8).toFixed(4)}] resBlock=${resolutionBlock} — committing`);

  const { predictionId } = await agent.submitFullCycle("MNT_USD_SPOT", { low, high }, 6500, resolutionBlock, contentHash, { stake: STAKE });
  log(`#${n} prediction ${predictionId} committed+revealed`);

  // Refresh while Revealed so the feed captures this forecast (once the agent has ≥10 resolved MNT).
  try {
    const ftx = await keeper.writeContract({ address: COMPOSITE_FEED, abi: feedAbi, functionName: "refresh", args: [MNT], gas: 3_000_000n });
    await pub.waitForTransactionReceipt({ hash: ftx });
    log(`#${n} feed refreshed`);
  } catch (e) {
    log(`#${n} refresh skipped: ${String(e.message).split("\n")[0]}`);
  }

  log(`#${n} waiting for block > ${resolutionBlock}`);
  for (;;) {
    const b = await pub.getBlockNumber();
    if (b > resolutionBlock) break;
    await sleep(30_000);
  }

  // Keeper pins the real Pyth snapshot (first-write-wins), then resolve → CRPS score.
  if (!(await pub.readContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "recorded", args: [resolutionBlock] }))) {
    const { data } = await hermesUpdate();
    const fee = await pub.readContract({ address: PYTH, abi: pythAbi, functionName: "getUpdateFee", args: [data] });
    const tx = await keeper.writeContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "record", args: [resolutionBlock, data], value: fee, gas: 3_000_000n });
    await pub.waitForTransactionReceipt({ hash: tx });
  }
  const snap = await pub.readContract({ address: PYTH_RESOLVER, abi: resolverAbi, functionName: "snapshotPrice", args: [resolutionBlock] });

  try {
    const rtx = await keeper.writeContract({ address: RESOLUTION_ENGINE, abi: reAbi, functionName: "resolve", args: [predictionId], gas: 3_000_000n });
    await pub.waitForTransactionReceipt({ hash: rtx });
  } catch (e) {
    // The running resolver bot may have resolved it first (permissionless) — that's fine.
    log(`#${n} resolve note: ${String(e.message).split("\n")[0]}`);
  }
  const p = await pub.readContract({ address: PREDICTION_MARKET, abi: pmAbi, functionName: "getPrediction", args: [predictionId] });
  log(`#${n} DONE prediction ${predictionId}: status=${p.status} (2=Resolved) score=${p.score} snapshot=${(Number(snap) / 1e8).toFixed(4)}`);
}

log(`start — agent=${AGENT_ID} keeper=${keeperAcct.address} MNT=${MNT}`);
let n = 0;
for (;;) {
  n += 1;
  try {
    await cycle(n);
  } catch (e) {
    log(`#${n} FAILED: ${String(e.message).split("\n")[0]} — retry in 60s`);
    await sleep(60_000);
  }
  await sleep(5_000);
}
