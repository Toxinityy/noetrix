#!/usr/bin/env bash
# Daily keeper: post the live Crypto Fear & Greed index to SentimentOracle, then poke
# MarketStressMonitor for all 3 categories (emits StressWarning on level transitions).
#
# Run by pm2 (deploy/ecosystem.config.js: once at start + daily cron). Addresses come from
# the committed deployments JSON, so a redeploy needs no edit here; the signing key + RPC
# come from deploy/keeper.env (gitignored — copy keeper.env.example).
#
# IMPORTANT: setFearGreed is onlyKeeper. Either use the OWNER (deployer) key here, or
# authorize the keeper wallet once:  cast send $ORACLE "setKeeper(address,bool)" $ADDR true
set -euo pipefail
cd "$(dirname "$0")"

[ -f ./keeper.env ] || { echo "[keeper] missing deploy/keeper.env (copy keeper.env.example)"; exit 1; }
set -a; . ./keeper.env; set +a
: "${KEEPER_PRIVATE_KEY:?set KEEPER_PRIVATE_KEY in deploy/keeper.env}"
: "${MANTLE_SEPOLIA_RPC:?set MANTLE_SEPOLIA_RPC in deploy/keeper.env}"

JSON="../contracts/deployments/${DEPLOY_NETWORK:-mantle-sepolia}.json"
ORACLE=$(jq -er .SentimentOracle "$JSON")
MONITOR=$(jq -er .MarketStressMonitor "$JSON")

FG=$(curl -fsS --max-time 20 'https://api.alternative.me/fng/?limit=1' | jq -er '.data[0].value | tonumber')
[ "$FG" -ge 0 ] && [ "$FG" -le 100 ] || { echo "[keeper] bad F&G value: $FG"; exit 1; }

echo "[keeper] $(date -u +%FT%TZ) posting Fear&Greed=$FG to $ORACLE"
cast send "$ORACLE" "setFearGreed(uint8)" "$FG" \
  --rpc-url "$MANTLE_SEPOLIA_RPC" --private-key "$KEEPER_PRIVATE_KEY" >/dev/null

for LABEL in METH_APR_24H AAVE_MANTLE_TVL_24H USDY_APY_24H; do
  ID=$(cast keccak "$LABEL")
  echo "[keeper] poke($LABEL)"
  cast send "$MONITOR" "poke(bytes32)" "$ID" \
    --rpc-url "$MANTLE_SEPOLIA_RPC" --private-key "$KEEPER_PRIVATE_KEY" >/dev/null
done
echo "[keeper] done"
