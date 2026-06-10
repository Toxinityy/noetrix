#!/usr/bin/env bash
# Verify every deployed Predictor Index contract on the explorer via the Etherscan V2 multichain
# endpoint (Mantlescan's standalone V1 API is dead — see foundry.toml [etherscan]). Idempotent:
# re-verifying an already-verified contract is a no-op, so this is safe to re-run. See docs/DEPLOY.md.
#
# Prereqs: forge + cast (foundry), jq, and:
#   export ETHERSCAN_API_KEY=...   # an etherscan.io V2 API key (one key, multichain via ?chainid=)
#   export DEPLOYER=0x...          # the address that deployed the contracts (constructor owner/treasury)
# Optional: DEPLOY_NETWORK (default mantle-sepolia), CHAIN_ID (default 5003).
#
# Run from the contracts/ dir:  ./verify.sh
set -euo pipefail
cd "$(dirname "$0")" # -> contracts/

: "${ETHERSCAN_API_KEY:?set ETHERSCAN_API_KEY (an etherscan.io V2 key)}"
: "${DEPLOYER:?set DEPLOYER=0x... (the deployer / constructor-owner address)}"
NET="${DEPLOY_NETWORK:-mantle-sepolia}"
CHAIN="${CHAIN_ID:-5003}"
JSON="deployments/${NET}.json"
VERIFIER_URL="https://api.etherscan.io/v2/api"

[ -f "$JSON" ] || { echo "missing $JSON — deploy first"; exit 1; }
addr() { jq -er ".$1" "$JSON"; }
enc() { cast abi-encode "$@"; }

# Category ids — must match Deploy.s.sol / RedeployFeed.s.sol.
METH=$(cast keccak "METH_APR_24H")
USDY=$(cast keccak "USDY_APY_24H")

AGENT_REGISTRY=$(addr AgentRegistry)
PREDICTION_MARKET=$(addr PredictionMarket)
COMPOSITE_FEED=$(addr CompositeFeed)
METH_ORACLE=$(addr MockMethRateOracle)
USDY_ORACLE=$(addr UsdyOracle)
AAVE_POOL=$(addr MockAavePool)

verify() { # <address> <path:Name> [encoded-constructor-args]
  local address="$1" target="$2" args="${3:-}"
  echo ">>> $target @ $address"
  if [ -n "$args" ]; then
    forge verify-contract "$address" "$target" --chain "$CHAIN" \
      --verifier-url "$VERIFIER_URL" --etherscan-api-key "$ETHERSCAN_API_KEY" \
      --constructor-args "$args" --watch || echo "!! $target verify failed (continuing)"
  else
    forge verify-contract "$address" "$target" --chain "$CHAIN" \
      --verifier-url "$VERIFIER_URL" --etherscan-api-key "$ETHERSCAN_API_KEY" \
      --watch || echo "!! $target verify failed (continuing)"
  fi
}

# Core
verify "$AGENT_REGISTRY"             src/AgentRegistry.sol:AgentRegistry                       "$(enc 'constructor(address,address)' "$DEPLOYER" "$DEPLOYER")"
verify "$PREDICTION_MARKET"          src/PredictionMarket.sol:PredictionMarket                 "$(enc 'constructor(address,address)' "$DEPLOYER" "$AGENT_REGISTRY")"
verify "$(addr BonusDistributor)"    src/BonusDistributor.sol:BonusDistributor                "$(enc 'constructor(address,address)' "$DEPLOYER" "$AGENT_REGISTRY")"
verify "$(addr ScoringEngine)"       src/ScoringEngine.sol:ScoringEngine                       "$(enc 'constructor(address,address,address)' "$DEPLOYER" "$PREDICTION_MARKET" "$AGENT_REGISTRY")"
verify "$(addr RangeCrpsScorer)"     src/scorers/RangeCrpsScorer.sol:RangeCrpsScorer
verify "$(addr ResolutionEngine)"    src/ResolutionEngine.sol:ResolutionEngine                "$(enc 'constructor(address,address)' "$DEPLOYER" "$PREDICTION_MARKET")"

# Oracles + resolvers (mETH and USDY both use the generic MockMethRateOracle)
verify "$METH_ORACLE"                src/mocks/MockMethRateOracle.sol:MockMethRateOracle       "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$USDY_ORACLE"                src/mocks/MockMethRateOracle.sol:MockMethRateOracle       "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$AAVE_POOL"                  src/mocks/MockAavePool.sol:MockAavePool                   "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$(addr MethAprResolver)"     src/resolvers/MethAprResolver.sol:MethAprResolver         "$(enc 'constructor(address)' "$METH_ORACLE")"
verify "$(addr AaveMantleTvlResolver)" src/resolvers/AaveMantleTvlResolver.sol:AaveMantleTvlResolver "$(enc 'constructor(address,address)' "$AAVE_POOL" "$AAVE_POOL")"
verify "$(addr UsdyApyResolver)"     src/resolvers/UsdyApyResolver.sol:UsdyApyResolver         "$(enc 'constructor(address)' "$USDY_ORACLE")"

# Feed + gate + consumers (the feed/consumers also auto-verify via RedeployFeed --verify; re-running is harmless)
verify "$(addr SubscriptionGate)"    src/SubscriptionGate.sol:SubscriptionGate                 "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$COMPOSITE_FEED"             src/CompositeFeed.sol:CompositeFeed                       "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$(addr DemoFeedConsumer)"    src/examples/DemoFeedConsumer.sol:DemoFeedConsumer        "$(enc 'constructor(address)' "$COMPOSITE_FEED")"
verify "$(addr YieldAllocator)"      src/examples/YieldAllocator.sol:YieldAllocator            "$(enc 'constructor(address,bytes32,bytes32)' "$COMPOSITE_FEED" "$METH" "$USDY")"
verify "$(addr RiskManager)"         src/examples/RiskManager.sol:RiskManager                  "$(enc 'constructor(address,address)' "$COMPOSITE_FEED" "$DEPLOYER")"

# Swarm stress contracts (constructor args per Deploy.s.sol lines 147-149)
SENTIMENT_ORACLE=$(addr SentimentOracle)
verify "$SENTIMENT_ORACLE"           src/mocks/SentimentOracle.sol:SentimentOracle              "$(enc 'constructor(address)' "$DEPLOYER")"
verify "$(addr MarketStressMonitor)" src/examples/MarketStressMonitor.sol:MarketStressMonitor   "$(enc 'constructor(address,address,address,address)' "$COMPOSITE_FEED" "$(addr ResolutionEngine)" "$SENTIMENT_ORACLE" "$DEPLOYER")"

echo "Done. Spot-check: https://sepolia.mantlescan.xyz/address/${COMPOSITE_FEED}#code"
