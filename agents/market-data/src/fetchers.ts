import { pickUsdyPool } from "./parsers.js";

const METH_POOL = "b9f2f00a-ba96-4589-a171-dde979a23d87";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json();
}

export async function fetchMethChart(): Promise<unknown> {
  return getJson(`https://yields.llama.fi/chart/${METH_POOL}`);
}

/// Resolve the Mantle USDY pool UUID from the (>10MB) /pools list, then fetch its chart.
export async function fetchUsdyChart(): Promise<unknown> {
  const pools = await getJson("https://yields.llama.fi/pools");
  const uuid = pickUsdyPool(pools);
  return getJson(`https://yields.llama.fi/chart/${uuid}`);
}

/// Aave-Mantle TVL from the (>10MB) protocol endpoint.
export async function fetchAaveProtocol(): Promise<unknown> {
  return getJson("https://api.llama.fi/protocol/aave-v3");
}

/// Longer-history Mantle chain-level TVL proxy.
export async function fetchChainTvl(): Promise<unknown> {
  return getJson("https://api.llama.fi/v2/historicalChainTvl/Mantle");
}

export async function fetchFearGreed(): Promise<unknown> {
  return getJson("https://api.alternative.me/fng/?limit=0&format=json");
}
