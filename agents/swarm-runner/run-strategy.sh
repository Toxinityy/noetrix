#!/usr/bin/env bash
# Register or run ONE swarm strategy as its own process.
#
#   ./run-strategy.sh <strategy> register   # mint the agent NFT (once, after contracts deploy)
#   ./run-strategy.sh <strategy> start       # run the live forecast loop (needs `pnpm build` first)
#
# strategy ∈ { mean-reversion | momentum | ewma-vol | sentiment }
#
# Each strategy reads its key/AGENT_ID/STRATEGY from .env.<strategy>.local (gitignored).
# Sourcing that file exports real env vars, which dotenv will NOT override — so the single
# package dir cleanly runs all four strategies as separate processes.
set -euo pipefail
cd "$(dirname "$0")"

STRAT="${1:?usage: ./run-strategy.sh <strategy> [register|start]}"
CMD="${2:-start}"
ENVFILE=".env.${STRAT}.local"
[ -f "$ENVFILE" ] || { echo "missing $ENVFILE (run the env setup first)"; exit 1; }

set -a; . "./$ENVFILE"; set +a   # export so the agent's dotenv won't clobber these

if [ "$CMD" = "register" ]; then
  OUT="$(pnpm -s register 2>&1)"; echo "$OUT"
  ID="$(printf '%s' "$OUT" | grep -oE 'minted agentId=[0-9]+' | grep -oE '[0-9]+' | head -1 || true)"
  if [ -n "$ID" ]; then
    if grep -qE '^AGENT_ID=' "$ENVFILE"; then
      sed -i '' -E "s/^AGENT_ID=.*/AGENT_ID=${ID}/" "$ENVFILE"
    else
      printf 'AGENT_ID=%s\n' "$ID" >> "$ENVFILE"
    fi
    echo "[run-strategy] recorded AGENT_ID=${ID} into ${ENVFILE}"
  else
    echo "[run-strategy] WARNING: could not parse minted agentId — set AGENT_ID in ${ENVFILE} by hand."
  fi
elif [ "$CMD" = "start" ]; then
  node dist/src/index.js
else
  echo "unknown command '$CMD' (use: register | start)"; exit 1
fi
