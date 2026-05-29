/**
 * Generate public/fallback-leaderboard.json — the static dataset the frontend serves when the
 * indexer is unreachable (demo-safety, PRD Prompt 13 Part B).
 *
 * Usage:
 *   tsx scripts/gen-fallback.ts                  → build from curated mock data (no indexer)
 *   INDEXER_URL=https://… tsx scripts/gen-fallback.ts  → pre-fetch live leaderboards from the indexer
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AGENTS, CATEGORIES, type CategoryId } from "../src/lib/mockData";

interface LeaderRow {
  id: number;
  name: string;
  kind: string;
  accuracyScore: number;
  calibrationScore: number;
  resolvedCount: number;
  lastUpdatedBlock: number;
  controller?: string;
}

const categories = Object.keys(CATEGORIES) as CategoryId[];

function fromMock(category: CategoryId): LeaderRow[] {
  return AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    accuracyScore: a.reputation[category].accuracyScore,
    calibrationScore: a.reputation[category].calibrationScore,
    resolvedCount: a.reputation[category].resolvedCount,
    lastUpdatedBlock: a.reputation[category].lastUpdatedBlock,
    controller: a.controller,
  })).sort((x, y) => y.accuracyScore - x.accuracyScore);
}

async function fromIndexer(base: string, category: CategoryId): Promise<LeaderRow[]> {
  const res = await fetch(`${base.replace(/\/$/, "")}/leaderboard?category=${category}&limit=50`);
  if (!res.ok) throw new Error(`indexer ${res.status} for ${category}`);
  const json = (await res.json()) as { leaderboard: Array<Record<string, string>> };
  return (json.leaderboard ?? []).map((r) => {
    const id = Number(r.agentId);
    return {
      id,
      name: `agent #${id}`,
      kind: "QUANT",
      accuracyScore: Number(r.accuracyScore),
      calibrationScore: Number(r.calibrationScore),
      resolvedCount: Number(r.resolvedCount),
      lastUpdatedBlock: Number(r.lastUpdatedBlock),
    };
  });
}

async function main() {
  const base = process.env.INDEXER_URL;
  const out: { generatedAt: string; source: string; categories: Record<string, LeaderRow[]> } = {
    generatedAt: new Date().toISOString(),
    source: base ? "indexer" : "mock",
    categories: {},
  };

  for (const category of categories) {
    out.categories[category] = base ? await fromIndexer(base, category) : fromMock(category);
  }

  const dir = resolve(process.cwd(), "public");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "fallback-leaderboard.json");
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`[gen-fallback] wrote ${path} (source=${out.source})`);
}

main().catch((err) => {
  console.error("[gen-fallback] failed:", err);
  process.exit(1);
});
