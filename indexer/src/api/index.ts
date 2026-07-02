import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { client, graphql, and, desc, eq } from "ponder";
import { keccak256, toBytes } from "viem";

const app = new Hono();

// Public read-only API: allow cross-origin reads (the Vercel-hosted frontend fetches this
// from visitors' browsers, which is a different origin than the tunneled indexer host).
app.use("*", cors());

// Built-in GraphQL + SQL-over-HTTP (handy for debugging / the frontend).
app.use("/sql/*", client({ db, schema }));
app.use("/graphql", graphql({ db, schema }));

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Accept either a raw bytes32 (0x…) or a category label ("METH_APR_24H"), matching the contract's
/// `keccak256("LABEL")` category id derivation.
function categoryHash(input: string): `0x${string}` {
  return (input.startsWith("0x") ? input.toLowerCase() : keccak256(toBytes(input))) as `0x${string}`;
}

/// Recursively stringify bigints so Hono's JSON serializer doesn't throw.
function serialize<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

// ─── REST (PRD §10) ───────────────────────────────────────────────────────────

// GET /leaderboard?category=METH_APR_24H&limit=10
app.get("/leaderboard", async (c) => {
  const category = c.req.query("category");
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  if (!category) return c.json({ error: "category required" }, 400);

  const hash = categoryHash(category);
  const rows = await db
    .select()
    .from(schema.reputations)
    .where(eq(schema.reputations.categoryId, hash))
    .orderBy(desc(schema.reputations.accuracyScore))
    .limit(limit);

  // Latest PREDICTION block per agent for this category. Reputation.lastUpdatedBlock only advances
  // on resolution (~24h later), so on its own an actively-forecasting agent reads as stale. Expose
  // the most recent commit so the frontend can show "last updated" as of the agent's last forecast.
  const preds = await db
    .select({ agentId: schema.predictions.agentId, commitBlock: schema.predictions.commitBlock })
    .from(schema.predictions)
    .where(eq(schema.predictions.categoryId, hash));
  const lastPredByAgent = new Map<string, bigint>();
  for (const p of preds) {
    const cur = lastPredByAgent.get(p.agentId) ?? 0n;
    if (p.commitBlock > cur) lastPredByAgent.set(p.agentId, p.commitBlock);
  }
  const leaderboard = rows.map((r) => ({
    ...r,
    lastPredictionBlock: lastPredByAgent.get(r.agentId) ?? 0n,
  }));

  return c.json(serialize({ category, count: leaderboard.length, leaderboard }));
});

// GET /agent/:id
app.get("/agent/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await db.select().from(schema.agents).where(eq(schema.agents.id, id)).limit(1);
  if (agent.length === 0) return c.json({ error: "agent not found" }, 404);

  const reps = await db
    .select()
    .from(schema.reputations)
    .where(eq(schema.reputations.agentId, id));

  return c.json(serialize({ agent: agent[0], reputations: reps }));
});

// GET /agent/:id/predictions?offset=&limit=&status=
app.get("/agent/:id/predictions", async (c) => {
  const id = c.req.param("id");
  const offset = Number(c.req.query("offset") ?? 0);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const status = c.req.query("status");

  const where = status
    ? and(eq(schema.predictions.agentId, id), eq(schema.predictions.status, status))
    : eq(schema.predictions.agentId, id);

  const rows = await db
    .select()
    .from(schema.predictions)
    .where(where)
    .orderBy(desc(schema.predictions.commitBlock))
    .limit(limit)
    .offset(offset);

  return c.json(serialize({ agentId: id, count: rows.length, predictions: rows }));
});

// GET /category/:id  → latest feed snapshot + contributor count
app.get("/category/:id", async (c) => {
  const hash = categoryHash(c.req.param("id"));

  const latest = await db
    .select()
    .from(schema.feedSnapshots)
    .where(eq(schema.feedSnapshots.categoryId, hash))
    .orderBy(desc(schema.feedSnapshots.snapshotBlock))
    .limit(1);

  const agentsInCategory = await db
    .select()
    .from(schema.reputations)
    .where(eq(schema.reputations.categoryId, hash));

  return c.json(
    serialize({
      categoryId: hash,
      latestSnapshot: latest[0] ?? null,
      agentCount: agentsInCategory.length,
    }),
  );
});

// GET /feed/:category/history?limit=
app.get("/feed/:category/history", async (c) => {
  const hash = categoryHash(c.req.param("category"));
  const limit = Math.min(Number(c.req.query("limit") ?? 100), 2200);

  const rows = await db
    .select()
    .from(schema.feedSnapshots)
    .where(eq(schema.feedSnapshots.categoryId, hash))
    .orderBy(desc(schema.feedSnapshots.snapshotBlock))
    .limit(limit);

  return c.json(serialize({ categoryId: hash, count: rows.length, history: rows }));
});

export default app;
