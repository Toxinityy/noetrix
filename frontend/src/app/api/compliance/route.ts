// Public, CORS-open AI-assisted compliance screen for the RWA deposit boundary.
// Deterministic rule engine (sanctions/AML + KYC/transfer-restriction + live on-chain
// AI risk-state + transaction monitoring) plus an LLM "assist" memo. Agent-accessible.
import { createPublicClient, http } from "viem";
import { riskManagerAbi, categoryHash } from "@/lib/contracts";
import { env, hasRiskManager } from "@/lib/env";
import { openRouterFetcher } from "@/lib/narrate";
import {
  evaluateCompliance,
  screenSanctions,
  isAddress,
  assessWith,
  fallbackMemo,
  type ComplianceAsset,
  type ComplianceInput,
  type RiskState,
} from "@/lib/compliance";

export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

const CATEGORY: Record<ComplianceAsset, string> = {
  meth: "METH_APR_24H",
  usdy: "USDY_APY_24H",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function readRiskState(asset: ComplianceAsset): Promise<RiskState> {
  if (!hasRiskManager) return -1;
  try {
    const client = createPublicClient({ transport: http(env.rpcUrl) });
    const s = (await client.readContract({
      address: env.addresses.riskManager as `0x${string}`,
      abi: riskManagerAbi,
      functionName: "riskState",
      args: [categoryHash(CATEGORY[asset])],
    })) as number;
    return s === 0 || s === 1 || s === 2 ? (s as RiskState) : -1;
  } catch {
    return -1;
  }
}

async function screen(address: string, amountUsd: number, asset: ComplianceAsset, kycVerified: boolean) {
  const riskState = await readRiskState(asset);
  const input: ComplianceInput = {
    address,
    amountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
    asset,
    riskState,
    sanctioned: screenSanctions(address),
    kycVerified,
  };
  const result = evaluateCompliance(input);
  const aiConfigured = !!process.env.OPENROUTER_API_KEY;
  const memo = aiConfigured
    ? await assessWith(input, result, openRouterFetcher())
    : fallbackMemo(input, result);
  return {
    source: aiConfigured ? "ai-assisted" : "rule-based",
    chainId: env.chainId,
    address,
    asset,
    amountUsd: input.amountUsd,
    riskState,
    decision: result.decision,
    checks: result.checks,
    memo,
  };
}

function bad(msg: string) {
  return Response.json({ error: msg }, { status: 400, headers: CORS });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const address = (q.get("address") ?? "").trim();
  const asset = (q.get("asset") ?? "usdy") as ComplianceAsset;
  const amountUsd = Number(q.get("amountUsd") ?? "0");
  const kycVerified = q.get("kyc") === "true";
  if (!isAddress(address)) return bad("a valid ?address=0x… is required");
  if (asset !== "meth" && asset !== "usdy") return bad("asset must be 'meth' or 'usdy'");
  return Response.json(await screen(address, amountUsd, asset, kycVerified), { headers: CORS });
}

export async function POST(req: Request) {
  let body: { address?: string; asset?: string; amountUsd?: number; kycVerified?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("bad json");
  }
  const address = String(body.address ?? "").trim();
  const asset = (body.asset ?? "usdy") as ComplianceAsset;
  const amountUsd = Number(body.amountUsd ?? 0);
  const kycVerified = body.kycVerified === true;
  if (!isAddress(address)) return bad("a valid 'address' is required");
  if (asset !== "meth" && asset !== "usdy") return bad("asset must be 'meth' or 'usdy'");
  return Response.json(await screen(address, amountUsd, asset, kycVerified), { headers: CORS });
}
