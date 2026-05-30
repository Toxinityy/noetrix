#!/usr/bin/env node
// Check MNT balances across every project wallet on Mantle Sepolia.
// Usage:  node scripts/check-balances.mjs
// Reads each wallet's private key from its package .env, derives the address, and queries balance.
// No keys are printed — only addresses + balances.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, defineChain, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RPC =
  process.env.MANTLE_SEPOLIA_RPC ||
  readEnv("contracts/.env", "MANTLE_SEPOLIA_RPC") ||
  "https://rpc.sepolia.mantle.xyz";

function readEnv(relPath, key) {
  const p = resolve(ROOT, relPath);
  if (!existsSync(p)) return undefined;
  const line = readFileSync(p, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(key + "="));
  if (!line) return undefined;
  const v = line.slice(key.length + 1).trim();
  return v || undefined;
}

function norm(k) {
  if (!k) return undefined;
  return k.startsWith("0x") ? k : "0x" + k;
}

// label → { envFile, keyVar }
const WALLETS = [
  { label: "deployer / treasury", envFile: "contracts/.env", keyVar: "PRIVATE_KEY" },
  { label: "arima controller", envFile: "agents/arima-baseline/.env", keyVar: "CONTROLLER_PRIVATE_KEY" },
  { label: "reasoner controller", envFile: "agents/claude-reasoner/.env", keyVar: "CONTROLLER_PRIVATE_KEY" },
  { label: "resolver bot", envFile: "agents/resolver/.env", keyVar: "RESOLVER_PRIVATE_KEY" },
  { label: "refresher bot", envFile: "agents/refresher/.env", keyVar: "REFRESHER_PRIVATE_KEY" },
];

const chain = defineChain({
  id: Number(process.env.CHAIN_ID || 5003),
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const client = createPublicClient({ chain, transport: http(RPC) });

console.log(`\nMNT balances — Mantle Sepolia (${RPC})\n`);
console.log("wallet                | address                                    | balance (MNT)");
console.log("-".repeat(94));

let total = 0n;
for (const w of WALLETS) {
  const key = norm(readEnv(w.envFile, w.keyVar));
  if (!key) {
    console.log(`${w.label.padEnd(21)} | ${"(no key in " + w.envFile + ")".padEnd(42)} | -`);
    continue;
  }
  let addr;
  try {
    addr = privateKeyToAccount(key).address;
  } catch {
    console.log(`${w.label.padEnd(21)} | (invalid key in ${w.envFile}) | -`);
    continue;
  }
  try {
    const bal = await client.getBalance({ address: addr });
    total += bal;
    const flag = bal === 0n ? "  ⚠ EMPTY" : "";
    console.log(`${w.label.padEnd(21)} | ${addr} | ${Number(formatEther(bal)).toFixed(4)}${flag}`);
  } catch (e) {
    console.log(`${w.label.padEnd(21)} | ${addr} | ERROR: ${e.shortMessage || e.message}`);
  }
}
console.log("-".repeat(94));
console.log(`${"TOTAL".padEnd(21)} | ${"".padEnd(42)} | ${Number(formatEther(total)).toFixed(4)}\n`);
