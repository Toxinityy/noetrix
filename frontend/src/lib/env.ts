// Public runtime config. NEXT_PUBLIC_* vars are inlined by Next at build time, so each must be
// referenced statically (no dynamic process.env[key]).

function addr(v: string | undefined): `0x${string}` | "" {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : "";
}

export const env = {
  indexerUrl: (process.env.NEXT_PUBLIC_INDEXER_URL ?? "").replace(/\/$/, ""),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc.sepolia.mantle.xyz",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 5003),
  explorerUrl: (process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.mantlescan.xyz").replace(/\/$/, ""),
  addresses: {
    compositeFeed: addr(process.env.NEXT_PUBLIC_ADDR_COMPOSITE_FEED),
    demoConsumer: addr(process.env.NEXT_PUBLIC_ADDR_DEMO_CONSUMER),
    agentRegistry: addr(process.env.NEXT_PUBLIC_ADDR_AGENT_REGISTRY),
    predictionMarket: addr(process.env.NEXT_PUBLIC_ADDR_PREDICTION_MARKET),
  },
} as const;

/// Indexer REST is configured — hooks fetch live; otherwise they fall back to mock data.
export const hasIndexer = env.indexerUrl.length > 0;
/// CompositeFeed deployed — enables live on-chain reads + the manual refresh button.
export const hasFeed = env.addresses.compositeFeed !== "";

export function explorerAddress(address: string): string {
  return `${env.explorerUrl}/address/${address}`;
}
export function explorerBlock(block: number | bigint): string {
  return `${env.explorerUrl}/block/${block}`;
}
