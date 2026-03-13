import {
  pgTable,
  serial,
  text,
  real,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// — existing tables ——————————————————————————————————————————————
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  direction: text("direction").notNull(),
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
  predictionId: integer("prediction_id").notNull().references(() => predictions.id),
  description: text("description").notNull(),
  direction: text("direction").notNull(),
  strength: integer("strength").notNull(),
  reasoning: text("reasoning").notNull(),
  sourceTitle: text("source_title"),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  predictionId: integer("prediction_id").notNull().references(() => predictions.id),
  title: text("title"),
  url: text("url"),
  summary: text("summary"),
  relevanceScore: integer("relevance_score"),
  collectedAt: timestamp("collected_at"),
});

// — knowledge graph tables ——————————————————————————————————————

export const entities = pgTable(
  "entities",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    type: text("type").notNull(),
    description: text("description"),
    aliases: jsonb("aliases").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("entities_name_idx").on(t.name)]
);

export const theses = pgTable("theses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  direction: text("direction").notNull(),
  domain: text("domain").notNull().default("AI"),
  tags: jsonb("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"),
  aiRationale: text("ai_rationale"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const newsEvents = pgTable(
  "news_events",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    url: text("url").unique(),
    source: text("source"),
    content: text("content"),
    summary: text("summary"),
    publishedAt: timestamp("published_at"),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
    processed: boolean("processed").notNull().default(false),
    aiRelevance: integer("ai_relevance"),
    sentiment: text("sentiment"),
    extractedEntities: jsonb("extracted_entities").$type<string[]>().default([]),
    extractedThesisIds: jsonb("extracted_thesis_ids").$type<number[]>().default([]),
  },
  (t) => [
    index("news_events_published_idx").on(t.publishedAt),
    index("news_events_processed_idx").on(t.processed),
  ]
);

export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    fromType: text("from_type").notNull(),
    fromId: integer("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: integer("to_id").notNull(),
    relation: text("relation").notNull(),
    direction: text("direction"),
    confidence: real("confidence").notNull().default(0.5),
    weight: real("weight").notNull().default(1.0),
    reasoning: text("reasoning"),
    sourceNewsId: integer("source_news_id").references(() => newsEvents.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    adjustedWeight: real("adjusted_weight"),
  },
  (t) => [
    index("connections_from_idx").on(t.fromType, t.fromId),
    index("connections_to_idx").on(t.toType, t.toId),
  ]
);

export const backtestRuns = pgTable("backtest_runs", {
  id: serial("id").primaryKey(),
  thesisId: integer("thesis_id").references(() => theses.id),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().default({}),
  results: jsonb("results").$type<Record<string, unknown>>(),
  accuracy: real("accuracy"),
  totalSignals: integer("total_signals"),
  correctSignals: integer("correct_signals"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// — probability tracking ——————————————————————————————————————————
export const thesisProbabilitySnapshots = pgTable(
  "thesis_probability_snapshots",
  {
    id: serial("id").primaryKey(),
    thesisId: integer("thesis_id").notNull().references(() => theses.id),
    probability: real("probability").notNull(),
    bullishWeight: real("bullish_weight").notNull().default(0),
    bearishWeight: real("bearish_weight").notNull().default(0),
    neutralWeight: real("neutral_weight").notNull().default(0),
    signalCount: integer("signal_count").notNull().default(0),
    momentum: real("momentum"),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    topNewsIds: jsonb("top_news_ids").$type<number[]>().default([]),
  },
  (t) => [
    index("prob_snapshots_thesis_idx").on(t.thesisId),
    index("prob_snapshots_time_idx").on(t.computedAt),
  ]
);
