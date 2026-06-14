#!/usr/bin/env bash
# Daily real-rate keeper: refresh live mETH / USDY / Aave-TVL / Fear&Greed data, then re-seed
# the on-chain oracles via SeedFromReal so RESOLVED OUTCOMES track REAL yields instead of a
# stale synthetic curve. This is the durability wire that deploy/keeper.sh lacks — keeper.sh
# only posts Fear&Greed + pokes the stress monitor; it never re-seeds the rate oracles, so
# without this the ground truth seeds once and then drifts stale.
#
# Runs as its OWN pm2 app (deploy/ecosystem.config.js → "seed-rates"), separate from keeper.sh,
# so a failure here can never endanger the working Fear&Greed / stress-poke path.
#
# Key requirement: setSynthetic is onlyOwner, so this needs the ORACLE OWNER (deployer) key,
# NOT the keeper hot wallet. SeedFromReal reads it from the PRIVATE_KEY env var.
#
# Dependency: SeedFromReal extracts the latest real value with FFI `jq`. If jq is absent it
# falls back to its committed baseline (still real, just not the freshest point) — install jq
# on the box for fresh values.
#
# NOT `set -e`: a network hiccup or a failed broadcast must degrade safely (keep the last good
# on-chain curve) — never crash the box or leave the pipeline wedged.
set -uo pipefail

cd "$(dirname "$0")/.."  # repo root

echo "[seed-rates] $(date -u +%FT%TZ) start"

# 1. Refresh the committed real market data (best-effort). On failure SeedFromReal still runs
#    against the last-committed data / its fallbacks, so a flaky DefiLlama never blocks the seed.
if ! pnpm --filter @predictor-index/market-data refresh; then
  echo "[seed-rates] WARN: market-data refresh failed — seeding from last-committed data"
fi

# 2. Load secrets (gitignored deploy/keeper.env). Owner key may be PRIVATE_KEY or ORACLE_OWNER_KEY.
if [ -f deploy/keeper.env ]; then set -a; . deploy/keeper.env; set +a; fi
: "${MANTLE_SEPOLIA_RPC:?set MANTLE_SEPOLIA_RPC in deploy/keeper.env}"
# Prefer an explicit owner key; fall back to PRIVATE_KEY (what SeedFromReal reads natively).
export PRIVATE_KEY="${ORACLE_OWNER_KEY:-${PRIVATE_KEY:?set ORACLE_OWNER_KEY (or PRIVATE_KEY) = oracle owner/deployer key}}"

# 3. Re-seed the mETH + USDY synthetic curves (and Fear&Greed) from the refreshed real data.
cd contracts
if forge script script/SeedFromReal.s.sol:SeedFromReal \
    --rpc-url "$MANTLE_SEPOLIA_RPC" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --sig "run()"; then
  echo "[seed-rates] re-seeded oracles from real data"
else
  echo "[seed-rates] WARN: SeedFromReal broadcast failed — last good on-chain curve retained"
fi

echo "[seed-rates] $(date -u +%FT%TZ) done"
