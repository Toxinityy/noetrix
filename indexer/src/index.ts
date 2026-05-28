import { ponder } from "ponder:registry";
import {
  agents,
  reputations,
  predictions,
  feedSnapshots,
  bonusDistributions,
} from "ponder:schema";

// ─── AgentRegistry ─────────────────────────────────────────────────────────

ponder.on("AgentRegistry:AgentRegistered", async ({ event, context }) => {
  await context.db.insert(agents).values({
    id: event.args.agentId.toString(),
    controller: event.args.controller,
    metadataURI: event.args.metadataURI,
    registeredAt: event.block.timestamp,
    totalPredictions: 0,
    totalResolved: 0,
  });
});

ponder.on("AgentRegistry:ControllerRotated", async ({ event, context }) => {
  await context.db
    .update(agents, { id: event.args.agentId.toString() })
    .set({ controller: event.args.newController });
});

ponder.on("AgentRegistry:ReputationUpdated", async ({ event, context }) => {
  const id = `${event.args.agentId.toString()}-${event.args.categoryId}`;
  const row = {
    id,
    agentId: event.args.agentId.toString(),
    categoryId: event.args.categoryId,
    accuracyScore: event.args.accuracyScore,
    calibrationScore: event.args.calibrationScore,
    resolvedCount: event.args.resolvedCount,
    lastUpdatedBlock: event.block.number,
  };
  await context.db
    .insert(reputations)
    .values(row)
    .onConflictDoUpdate({
      accuracyScore: row.accuracyScore,
      calibrationScore: row.calibrationScore,
      resolvedCount: row.resolvedCount,
      lastUpdatedBlock: row.lastUpdatedBlock,
    });
});

// ─── PredictionMarket ───────────────────────────────────────────────────────

ponder.on("PredictionMarket:PredictionCommitted", async ({ event, context }) => {
  await context.db.insert(predictions).values({
    id: event.args.predictionId.toString(),
    agentId: event.args.agentId.toString(),
    categoryId: event.args.categoryId,
    commitHash: event.args.commitHash,
    value: null,
    confidence: null,
    contentHash: event.args.contentHash,
    stake: event.args.stake,
    commitBlock: event.args.commitBlock,
    resolutionBlock: event.args.resolutionBlock,
    status: "Committed",
    score: null,
  });

  await context.db
    .update(agents, { id: event.args.agentId.toString() })
    .set((row) => ({ totalPredictions: row.totalPredictions + 1 }));
});

ponder.on("PredictionMarket:PredictionRevealed", async ({ event, context }) => {
  await context.db
    .update(predictions, { id: event.args.predictionId.toString() })
    .set({
      value: event.args.value,
      confidence: event.args.confidence,
      status: "Revealed",
    });
});

ponder.on("PredictionMarket:PredictionCancelled", async ({ event, context }) => {
  await context.db
    .update(predictions, { id: event.args.predictionId.toString() })
    .set({ status: "Cancelled" });
});

ponder.on("PredictionMarket:PredictionForfeited", async ({ event, context }) => {
  await context.db
    .update(predictions, { id: event.args.predictionId.toString() })
    .set({ status: "Forfeited" });
});

ponder.on("PredictionMarket:PredictionResolved", async ({ event, context }) => {
  const pred = await context.db.find(predictions, {
    id: event.args.predictionId.toString(),
  });

  await context.db
    .update(predictions, { id: event.args.predictionId.toString() })
    .set({ status: "Resolved", score: event.args.score });

  if (pred) {
    await context.db
      .update(agents, { id: pred.agentId })
      .set((row) => ({ totalResolved: row.totalResolved + 1 }));
  }
});

// ─── CompositeFeed ──────────────────────────────────────────────────────────

ponder.on("CompositeFeed:CompositeFeedRefreshed", async ({ event, context }) => {
  await context.db.insert(feedSnapshots).values({
    id: `${event.args.categoryId}-${event.args.blockNumber.toString()}`,
    categoryId: event.args.categoryId,
    value: event.args.value,
    confidence: event.args.confidence,
    contributingAgents: event.args.contributorCount,
    snapshotBlock: event.args.blockNumber,
  });
});

// ─── BonusDistributor ───────────────────────────────────────────────────────

ponder.on("BonusDistributor:EpochFinalized", async ({ event, context }) => {
  const id = `${event.args.categoryId}-${event.args.epoch.toString()}`;
  await context.db
    .insert(bonusDistributions)
    .values({
      id,
      categoryId: event.args.categoryId,
      epochNumber: event.args.epoch,
      totalPool: event.args.finalPool,
      agentBonuses: {},
    })
    .onConflictDoUpdate({ totalPool: event.args.finalPool });
});

ponder.on("BonusDistributor:BonusClaimed", async ({ event, context }) => {
  const id = `${event.args.categoryId}-${event.args.epoch.toString()}`;
  const existing = await context.db.find(bonusDistributions, { id });
  const bonuses = {
    ...((existing?.agentBonuses as Record<string, string>) ?? {}),
    [event.args.agentId.toString()]: event.args.amount.toString(),
  };

  if (existing) {
    await context.db
      .update(bonusDistributions, { id })
      .set({ agentBonuses: bonuses });
  } else {
    // Claim observed before finalize row (shouldn't happen on-chain, but stay resilient).
    await context.db.insert(bonusDistributions).values({
      id,
      categoryId: event.args.categoryId,
      epochNumber: event.args.epoch,
      totalPool: 0n,
      agentBonuses: bonuses,
    });
  }
});
