import {
  pgTable,
  serial,
  text,
  real,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  direction: text("direction").notNull(), // bullish, bearish, neutral
  confidence: real("confidence").notNull(),
  weightedScore: real("weighted_score").notNull(),
  topReasons: jsonb("top_reasons").notNull().$type<string[]>(),
  signalCount: integer("signal_count").notNull(),
  bullishCount: integer("bullish_count").notNull(),
  bearishCount: integer("bearish_count").notNull(),
  neutralCount: integer("neutral_count").notNull(),
  contradictions: jsonb("contradictions").$type<string[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  actualOutcome: text("actual_outcome"),
  outcomeNotes: text("outcome_notes"),
  resolvedAt: timestamp("resolved_at"),
});

export const signals = pgTable("signals", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id")
    .notNull()
    .references(() => predictions.id),
  description: text("description").notNull(),
  direction: text("direction").notNull(),
  strength: integer("strength").notNull(),
  reasoning: text("reasoning").notNull(),
  sourceTitle: text("source_title"),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id")
    .notNull()
    .references(() => predictions.id),
  title: text("title"),
  url: text("url"),
  summary: text("summary"),
  relevanceScore: integer("relevance_score"),
  collectedAt: timestamp("collected_at"),
});
