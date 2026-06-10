// pm2 supervisor for the full Predictor Index off-chain stack: the Ponder indexer,
// all 7 forecasting agents, the resolver + refresher bots, and the daily keeper.
//
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup        # survive reboots
//
// No secrets live in this file. Each process loads its own gitignored .env from its cwd
// (dotenv), and the four swarm strategies get their per-strategy env injected here from
// agents/swarm-runner/.env.<strategy>.local — pm2 sets process.env BEFORE node starts, and
// dotenv never overrides existing vars, so the injected STRATEGY/key/AGENT_ID always win.
//
// Prereqs on the box: `pnpm install && pnpm -r build` (agents run from dist/), the .env
// files copied over (see docs/SERVER_DEPLOY.md §4), and indexer/.env.local configured.
//
// Restarting the indexer with a fresh Ponder schema (after a contract redeploy):
//   pm2 delete indexer && PONDER_SCHEMA=live2 pm2 start deploy/ecosystem.config.js --only indexer

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

/// Parse a KEY=VALUE env file into an object (comments/blank lines ignored; no expansion).
function envFile(file) {
  const out = {};
  if (!fs.existsSync(file)) {
    console.warn(`[ecosystem] missing ${file} — that process will fail to start`);
    return out;
  }
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const SWARM_DIR = path.join(ROOT, "agents", "swarm-runner");
const STRATEGIES = ["mean-reversion", "momentum", "ewma-vol", "sentiment"];

module.exports = {
  apps: [
    // ─── Indexer (Ponder; reads indexer/.env.local itself) ────────────────────
    {
      name: "indexer",
      cwd: path.join(ROOT, "indexer"),
      script: "node_modules/ponder/dist/esm/bin/ponder.js",
      args: `start --schema ${process.env.PONDER_SCHEMA || "live1"}`,
      max_memory_restart: "700M",
      time: true,
    },

    // ─── Named forecasters (each loads its own .env via dotenv) ───────────────
    ...[
      ["arima", "arima-baseline"],
      ["naive", "naive-baseline"],
      ["deepseek", "deepseek-reasoner"],
    ].map(([name, pkg]) => ({
      name,
      cwd: path.join(ROOT, "agents", pkg),
      script: "dist/src/index.js",
      max_memory_restart: "300M",
      time: true,
    })),

    // ─── Swarm strategies (one package, four processes, env injected per strategy) ──
    ...STRATEGIES.map((strategy) => ({
      name: `swarm-${strategy}`,
      cwd: SWARM_DIR,
      script: "dist/src/index.js",
      env: envFile(path.join(SWARM_DIR, `.env.${strategy}.local`)),
      max_memory_restart: "300M",
      time: true,
    })),

    // ─── Ops bots ──────────────────────────────────────────────────────────────
    {
      name: "resolver",
      cwd: path.join(ROOT, "agents", "resolver"),
      script: "dist/index.js",
      max_memory_restart: "300M",
      time: true,
    },
    {
      name: "refresher",
      cwd: path.join(ROOT, "agents", "refresher"),
      script: "dist/index.js",
      max_memory_restart: "300M",
      time: true,
    },

    // ─── Keeper (runs once at pm2 start, then daily at 09:00 server time) ──────
    {
      name: "keeper",
      cwd: __dirname,
      script: "./keeper.sh",
      interpreter: "bash",
      autorestart: false,
      cron_restart: "0 9 * * *",
      time: true,
    },
  ],
};
