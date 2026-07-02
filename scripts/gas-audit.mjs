// Reproducible measurement behind the /terminal/pricing economics panel.
// Sums on-chain gas actually spent (gasUsed × gasPrice) per bot wallet via the
// Etherscan V2 API (Mantle Sepolia, chainId 5003). Every transaction it counts
// is publicly verifiable on https://sepolia.mantlescan.xyz.
//
// Usage: ESCAN_KEY=<etherscan-v2-api-key> node scripts/gas-audit.mjs
//
// Measured 2026-07-02 (30 May → 2 Jul, ~33 days): 233.5 MNT across 9,490 txs;
// the 5-min refresher was 81% of spend — since cut to hourly (+ daily forecasts).
const KEY = process.env.ESCAN_KEY;
if (!KEY) {
  console.error("Set ESCAN_KEY to an Etherscan V2 API key (free tier works).");
  process.exit(1);
}
const CHAIN = 5003;
const WALLETS = {
  arima: "0xD1bBf1B3BeCD81dc5659080c82d0d3A427526855",
  naive: "0x995FCB3339f885e254154e77e2f44720d5191d86",
  deepseek: "0xa833BA2E1Ae8e5a509F1FA9c8B9Fcf20358F7D5b",
  "swarm-mean-reversion": "0x35A869AA53f9e8a12fd2F808519Af207e745B771",
  "swarm-momentum": "0xE2F63a75D43d266A2aefD218EB41c62F4c2CD934",
  "swarm-ewma-vol": "0x186B1A311dF46Fb41917B467aCbCC6252fc1e6ac",
  "swarm-sentiment": "0x00e41456889c5e70C94872935D587962535874B6",
  resolver: "0xE028Ddfd1922270CF6b53341882192165139DbD5",
  refresher: "0x98163c037ABd980C5a42E9dD47599a3FeB5827Af",
  "keeper/deployer": "0x23015eEb4CDDBF71be80ea4259B5a32Cf1b60e60", // reported separately (one-time deploys)
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function txlistPage(addr, startblock) {
  const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN}&module=account&action=txlist&address=${addr}&startblock=${startblock}&endblock=99999999&page=1&offset=10000&sort=asc&apikey=${KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.status !== "1" && j.message !== "No transactions found") {
    if (String(j.result).includes("rate limit")) { await sleep(1200); return txlistPage(addr, startblock); }
  }
  return Array.isArray(j.result) ? j.result : [];
}

async function measure(addr) {
  const seen = new Set();
  let feeWei = 0n, sent = 0, firstTs = Infinity, lastTs = 0, startblock = 0, pages = 0;
  while (pages < 40) {
    const batch = await txlistPage(addr, startblock);
    pages++;
    for (const t of batch) {
      if (seen.has(t.hash)) continue;
      seen.add(t.hash);
      if ((t.from || "").toLowerCase() !== addr.toLowerCase()) continue; // gas is paid by the sender only
      feeWei += BigInt(t.gasUsed || 0) * BigInt(t.gasPrice || 0);
      sent++;
      const ts = Number(t.timeStamp);
      if (ts < firstTs) firstTs = ts;
      if (ts > lastTs) lastTs = ts;
    }
    if (batch.length < 10000) break;
    startblock = Number(batch[batch.length - 1].blockNumber); // cursor; dedupe handles the overlap
    await sleep(260);
  }
  return { feeWei, sent, firstTs: firstTs === Infinity ? 0 : firstTs, lastTs };
}

const MNT_USD = 0.42; // $-valuation assumption; the MNT + tx counts are the assumption-free facts
const mnt = (wei) => Number(wei) / 1e18;
let opWei = 0n, opSent = 0, gMin = Infinity, gMax = 0;
const rows = [];
for (const [name, addr] of Object.entries(WALLETS)) {
  const m = await measure(addr);
  rows.push({ name, ...m });
  if (name !== "keeper/deployer") {
    opWei += m.feeWei; opSent += m.sent;
    if (m.firstTs && m.firstTs < gMin) gMin = m.firstTs;
    if (m.lastTs > gMax) gMax = m.lastTs;
  }
  await sleep(260);
}

console.log("wallet".padEnd(22), "sent".padStart(7), "MNT gas".padStart(11), `$@${MNT_USD}`.padStart(9), "first→last (days)");
for (const r of rows) {
  const days = r.firstTs ? ((r.lastTs - r.firstTs) / 86400).toFixed(1) : "0";
  console.log(
    r.name.padEnd(22),
    String(r.sent).padStart(7),
    mnt(r.feeWei).toFixed(4).padStart(11),
    ("$" + (mnt(r.feeWei) * MNT_USD).toFixed(3)).padStart(9),
    days,
  );
}
const opDays = (gMax - gMin) / 86400;
console.log("\n=== OPERATIONAL (9 bots, excl keeper/deployer) ===");
console.log("total txs sent   :", opSent);
console.log("total MNT on gas :", mnt(opWei).toFixed(4), "MNT");
console.log("active window    :", opDays.toFixed(1), "days");
console.log("per-day gas      :", (mnt(opWei) / opDays).toFixed(5), "MNT/day");
console.log(`$/day @ $${MNT_USD}    : $` + ((mnt(opWei) / opDays) * MNT_USD).toFixed(4));
console.log(`$/year @ $${MNT_USD}   : $` + ((mnt(opWei) / opDays) * MNT_USD * 365).toFixed(2));
