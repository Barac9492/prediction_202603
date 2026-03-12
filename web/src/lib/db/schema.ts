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

import {
  pgTable, serial, text, real, integer, jsonb,
  timestamp, boolean, index,
} from "drizzle-orm/pg-core";

// ── existing tables ────────────────────────────────────────────────────────
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

// ── knowledge graph tables ─────────────────────────────────────────────────

/** Canonical entities: companies, models, technologies, people */
export const entities = pgTable(
  "entities",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    type: text("type").notNull(), // company | model | technology | person | fund
    description: text("description"),
    aliases: jsonb("aliases").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("entities_name_idx").on(t.name)]
);

/** Investment theses — hypotheses being tracked.
 *  status: "pending_review" = AI-suggested, awaiting user approval
 *          "active"         = approved and being tracked
 *          "archived"       = retired / declined
 */
export const theses = pgTable("theses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  direction: text("direction").notNull(), // bullish | bearish | neutral
  domain: text("domain").notNull().default("AI"),
  tags: jsonb("tags").$type<string[]>().default([]),
  // "active" for backward compat — true when status = "active"
  isActive: boolean("is_active").notNull().default(true),
  // New: tracks lifecycle stage
  status: text("status").notNull().default("active"), // pending_review | active | archived
  // If AI-generated, store the reasoning so user can evaluate it
  aiRationale: text("ai_rationale"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Raw news events ingested from feeds / scrapers */
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
    // LLM-extracted metadata
    aiRelevance: integer("ai_relevance"), // 1-5
    sentiment: text("sentiment"),         // bullish | bearish | neutral
    extractedEntities: jsonb("extracted_entities").$type<string[]>().default([]),
    extractedThesisIds: jsonb("extracted_thesis_ids").$type<number[]>().default([]),
  },
  (t) => [
    index("news_events_published_idx").on(t.publishedAt),
    index("news_events_processed_idx").on(t.processed),
  ]
);

/** Graph edges — connections between any two nodes */
export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    fromType: text("from_type").notNull(), // news_event | entity | thesis | prediction
    fromId: integer("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: integer("to_id").notNull(),
    relation: text("relation").notNull(), // SUPPORTS | CONTRADICTS | AFFECTS | RELATED_TO | MENTIONS
    direction: text("direction"),         // bullish | bearish | neutral
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

/** Backtest runs */
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
  status: text("status").notNull().default("pending"), // pending | running | done | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

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

// ── knowledge graph tables ─────────────────────────────────────────────────

/** Canonical entities: companies, models, technologies, people */
export const entities = pgTable(
    "entities",
  {
        id: serial("id").primaryKey(),
        name: text("name").notNull().unique(),
        type: text("type").notNull(), // company | model | technology | person | fund
        description: text("description"),
        aliases: jsonb("aliases").$type<string[]>().default([]),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
    (t) => [index("entities_name_idx").on(t.name)]
  );

/** Investment theses — hypotheses being tracked */
export const theses = pgTable("theses", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    direction: text("direction").notNull(), // bullish | bearish | neutral
    domain: text("domain").notNull().default("AI"), // AI | SaaS | Infra | etc.
    tags: jsonb("tags").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Raw news events ingested from feeds / scrapers */
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
        // LLM-extracted metadata
        aiRelevance: integer("ai_relevance"), // 1-5
        sentiment: text("sentiment"), // bullish | bearish | neutral
        extractedEntities: jsonb("extracted_entities").$type<string[]>().default([]),
        extractedThesisIds: jsonb("extracted_thesis_ids").$type<number[]>().default([]),
  },
    (t) => [
          index("news_events_published_idx").on(t.publishedAt),
          index("news_events_processed_idx").on(t.processed),
        ]
  );

/** Graph edges — connections between any two nodes */
export const connections = pgTable(
    "connections",
  {
        id: serial("id").primaryKey(),
        // source node
        fromType: text("from_type").notNull(), // news_event | entity | thesis | prediction
        fromId: integer("from_id").notNull(),
        // target node
        toType: text("to_type").notNull(),
        toId: integer("to_id").notNull(),
        // edge semantics
        relation: text("relation").notNull(), // SUPPORTS | CONTRADICTS | AFFECTS | RELATED_TO | MENTIONS
        direction: text("direction"), // bullish | bearish | neutral (for thesis-affecting edges)
        confidence: real("confidence").notNull().default(0.5), // 0-1
        weight: real("weight").notNull().default(1.0),
        reasoning: text("reasoning"),
        // provenance
        sourceNewsId: integer("source_news_id").references(() => newsEvents.id),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        // self-reinforcement: adjusted by backtest outcomes
        adjustedWeight: real("adjusted_weight"),
  },
    (t) => [
          index("connections_from_idx").on(t.fromType, t.fromId),
          index("connections_to_idx").on(t.toType, t.toId),
        ]
  );

/** Backtest runs — replay graph at time T and compare to actual outcomes */
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
    status: text("status").notNull().default("pending"), // pending | running | done | failed
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
});
