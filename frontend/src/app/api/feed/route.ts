// Public, CORS-open composite-feed read for AI agents. Live on-chain read of CompositeFeed.read
// (the same value consumers see), with a clear error if the feed address isn't configured.
import { createPublicClient, http, decodeAbiParameters } from "viem";
import { compositeFeedAbi, categoryHash } from "@/lib/contracts";
import { env, hasFeed } from "@/lib/env";

export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=15",
};

const VALID = new Set(["METH_APR_24H", "USDY_APY_24H", "AAVE_MANTLE_TVL_24H"]);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const category = new URL(req.url).searchParams.get("category") ?? "METH_APR_24H";
  if (!VALID.has(category)) {
    return Response.json({ error: "unknown category", valid: [...VALID] }, { status: 400, headers: CORS });
  }
  if (!hasFeed) {
    return Response.json({ error: "feed address not configured in this deployment" }, { status: 503, headers: CORS });
  }

  try {
    const client = createPublicClient({ transport: http(env.rpcUrl) });
    const res = (await client.readContract({
      address: env.addresses.compositeFeed as `0x${string}`,
      abi: compositeFeedAbi,
      functionName: "read",
      args: [categoryHash(category)],
    })) as { value: `0x${string}`; confidence: number; contributingAgents: bigint; lastUpdatedBlock: bigint };

    let value = BigInt(0);
    try {
      value = decodeAbiParameters([{ type: "uint256" }], res.value)[0] as bigint;
    } catch {
      value = BigInt(0);
    }

    return Response.json(
      {
        source: "chain",
        chainId: env.chainId,
        category,
        categoryId: categoryHash(category),
        value: value.toString(),
        confidenceBps: Number(res.confidence),
        contributingAgents: Number(res.contributingAgents),
        lastUpdatedBlock: Number(res.lastUpdatedBlock),
        compositeFeed: env.addresses.compositeFeed,
      },
      { headers: CORS },
    );
  } catch (e) {
    return Response.json({ error: "on-chain read failed", detail: (e as Error).message }, { status: 502, headers: CORS });
  }
}
