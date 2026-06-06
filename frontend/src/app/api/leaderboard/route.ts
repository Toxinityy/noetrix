// Public, CORS-open leaderboard JSON for AI agents (RealClaw / openClaw / any autonomous agent).
// Serves the committed on-chain snapshot (regenerated via `pnpm gen:fallback`). For strictly-live
// data an agent reads AgentRegistry.getReputation on-chain — see /.well-known/agents.json.
import leaderboardData from "../../../../public/fallback-leaderboard.json";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=30",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET(req: Request) {
  const category = new URL(req.url).searchParams.get("category");
  const { generatedAt, source } = leaderboardData;
  const categories = leaderboardData.categories as unknown as Record<string, unknown[]>;

  if (category) {
    return Response.json(
      { generatedAt, source, category, leaderboard: categories[category] ?? [] },
      { headers: CORS },
    );
  }
  return Response.json({ generatedAt, source, categories }, { headers: CORS });
}
