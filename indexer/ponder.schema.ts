import { onchainTable } from "ponder";

/// Agent identity (ERC-8004 soulbound NFT). id = agentId as string.
export const agents = onchainTable("agents", (t) => ({
  id: t.text().primaryKey(),
  controller: t.hex().notNull(),
  metadataURI: t.text().notNull(),
  registeredAt: t.bigint().notNull(),
  totalPredictions: t.integer().notNull(),
  totalResolved: t.integer().notNull(),
}));

/// Per-agent, per-category reputation. id = `${agentId}-${categoryId}`.
export const reputations = onchainTable("reputations", (t) => ({
  id: t.text().primaryKey(),
  agentId: t.text().notNull(),
  categoryId: t.hex().notNull(),
  accuracyScore: t.bigint().notNull(),
  calibrationScore: t.bigint().notNull(),
  resolvedCount: t.bigint().notNull(),
  lastUpdatedBlock: t.bigint().notNull(),
}));

/// Prediction lifecycle. id = predictionId as string. value/confidence/score null until set.
export const predictions = onchainTable("predictions", (t) => ({
  id: t.text().primaryKey(),
  agentId: t.text().notNull(),
  categoryId: t.hex().notNull(),
  commitHash: t.hex().notNull(),
  value: t.hex(),
  confidence: t.integer(),
  contentHash: t.hex().notNull(),
  stake: t.bigint().notNull(),
  commitBlock: t.bigint().notNull(),
  resolutionBlock: t.bigint().notNull(),
  status: t.text().notNull(), // Committed | Revealed | Resolved | Cancelled | Forfeited
  score: t.bigint(),
}));

/// CompositeFeed refresh snapshots. id = `${categoryId}-${snapshotBlock}`.
export const feedSnapshots = onchainTable("feedSnapshots", (t) => ({
  id: t.text().primaryKey(),
  categoryId: t.hex().notNull(),
  value: t.bigint().notNull(),
  confidence: t.integer().notNull(),
  contributingAgents: t.bigint().notNull(),
  snapshotBlock: t.bigint().notNull(),
}));

/// Per-(category, epoch) finalized bonus pool + claims. id = `${categoryId}-${epochNumber}`.
export const bonusDistributions = onchainTable("bonusDistributions", (t) => ({
  id: t.text().primaryKey(),
  categoryId: t.hex().notNull(),
  epochNumber: t.bigint().notNull(),
  totalPool: t.bigint().notNull(),
  agentBonuses: t.json().notNull(), // { [agentId]: claimedAmountWei }
}));
