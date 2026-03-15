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

// — workspace management ——————————————————————————————————————————

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(), // Clerk orgId
  name: text("name").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("trial"), // trial, analyst, team, fund, expired
  seatLimit: integer("seat_limit").notNull().default(3),
  thesisLimit: integer("thesis_limit").notNull().default(25),
  pipelineRunsPerDay: integer("pipeline_runs_per_day").notNull().default(4),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    clerkUserId: text("clerk_user_id").notNull(),
    role: text("role").notNull().default("analyst"), // admin, analyst, viewer
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("workspace_members_ws_idx").on(t.workspaceId),
    index("workspace_members_user_idx").on(t.clerkUserId),
  ]
);

// — existing tables ——————————————————————————————————————————————
export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
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
    deadline: timestamp("deadline"),
    resolutionCriteria: text("resolution_criteria"),
  },
  (t) => [index("predictions_ws_idx").on(t.workspaceId)]
);

export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    description: text("description").notNull(),
    direction: text("direction").notNull(),
    strength: integer("strength").notNull(),
    reasoning: text("reasoning").notNull(),
    sourceTitle: text("source_title"),
  },
  (t) => [index("signals_ws_idx").on(t.workspaceId)]
);

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    predictionId: integer("prediction_id")
      .notNull()
      .references(() => predictions.id),
    title: text("title"),
    url: text("url"),
    summary: text("summary"),
    relevanceScore: integer("relevance_score"),
    collectedAt: timestamp("collected_at"),
  },
  (t) => [index("sources_ws_idx").on(t.workspaceId)]
);

// — knowledge graph tables ——————————————————————————————————————

export const entities = pgTable(
  "entities",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    category: text("category"),
    description: text("description"),
    aliases: jsonb("aliases").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("entities_name_idx").on(t.name),
    index("entities_ws_idx").on(t.workspaceId),
    index("entities_ws_name_idx").on(t.workspaceId, t.name),
  ]
);

export const theses = pgTable(
  "theses",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    direction: text("direction").notNull(),
    domain: text("domain").notNull().default("AI"),
    tags: jsonb("tags").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    status: text("status").notNull().default("active"),
    aiRationale: text("ai_rationale"),
    deadline: timestamp("deadline"),
    resolutionCriteria: text("resolution_criteria"),
    resolutionSource: text("resolution_source"),
    resolvedAt: timestamp("resolved_at"),
    finalProbability: real("final_probability"),
    brierScore: real("brier_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("theses_ws_idx").on(t.workspaceId)]
);

export const newsEvents = pgTable(
  "news_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    source: text("source"),
    content: text("content"),
    summary: text("summary"),
    publishedAt: timestamp("published_at"),
    ingestedAt: timestamp("ingested_at").notNull().defaultNow(),
    processed: boolean("processed").notNull().default(false),
    aiRelevance: integer("ai_relevance"),
    sentiment: text("sentiment"),
    extractedEntities: jsonb("extracted_entities").$type<string[]>().default([]),
    extractedThesisIds: jsonb("extracted_thesis_ids")
      .$type<number[]>()
      .default([]),
  },
  (t) => [
    index("news_events_published_idx").on(t.publishedAt),
    index("news_events_processed_idx").on(t.processed),
    index("news_events_ws_idx").on(t.workspaceId),
  ]
);

export const connections = pgTable(
  "connections",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
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
    index("connections_ws_idx").on(t.workspaceId),
  ]
);

export const backtestRuns = pgTable(
  "backtest_runs",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    thesisId: integer("thesis_id").references(() => theses.id),
    name: text("name").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    parameters: jsonb("parameters")
      .$type<Record<string, unknown>>()
      .default({}),
    results: jsonb("results").$type<Record<string, unknown>>(),
    accuracy: real("accuracy"),
    totalSignals: integer("total_signals"),
    correctSignals: integer("correct_signals"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [index("backtest_runs_ws_idx").on(t.workspaceId)]
);

// — entity observations ——————————————————————————————————————————

export const entityObservations = pgTable(
  "entity_observations",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    entityId: integer("entity_id")
      .notNull()
      .references(() => entities.id),
    attribute: text("attribute").notNull(),
    value: text("value").notNull(),
    numericValue: real("numeric_value"),
    confidence: real("confidence").notNull().default(0.5),
    sourceNewsId: integer("source_news_id").references(() => newsEvents.id),
    observedAt: timestamp("observed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("entity_obs_entity_attr_idx").on(
      t.entityId,
      t.attribute,
      t.observedAt
    ),
    index("entity_obs_ws_idx").on(t.workspaceId),
  ]
);

// — signal clusters ——————————————————————————————————————————

export const signalClusters = pgTable(
  "signal_clusters",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    pattern: text("pattern").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    status: text("status").notNull().default("active"),
    connectionIds: jsonb("connection_ids").$type<number[]>().default([]),
    entityIds: jsonb("entity_ids").$type<number[]>().default([]),
    thesisIds: jsonb("thesis_ids").$type<number[]>().default([]),
    detectedAt: timestamp("detected_at").notNull().defaultNow(),
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  },
  (t) => [index("signal_clusters_ws_idx").on(t.workspaceId)]
);

// — recommendations ——————————————————————————————————————————

export const recommendations = pgTable(
  "recommendations",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    thesisId: integer("thesis_id").references(() => theses.id),
    action: text("action").notNull(),
    asset: text("asset").notNull(),
    conviction: real("conviction").notNull(),
    timeframeDays: integer("timeframe_days").notNull(),
    deadline: timestamp("deadline").notNull(),
    rationale: text("rationale").notNull(),
    status: text("status").notNull().default("active"),
    outcomeNotes: text("outcome_notes"),
    brierScore: real("brier_score"),
    resolvedAt: timestamp("resolved_at"),
    probabilityAtCreation: real("probability_at_creation"),
    probabilityAtResolution: real("probability_at_resolution"),
    ticker: text("ticker"),
    priceAtCreation: real("price_at_creation"),
    priceAtResolution: real("price_at_resolution"),
    actualReturn: real("actual_return"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("recommendations_ws_idx").on(t.workspaceId)]
);

// — price snapshots ——————————————————————————————————————————

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    ticker: text("ticker").notNull(),
    price: real("price").notNull(),
    volume: real("volume"),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
  },
  (t) => [
    index("price_snapshots_ticker_time_idx").on(t.ticker, t.capturedAt),
    index("price_snapshots_ws_idx").on(t.workspaceId),
  ]
);

// — probability tracking ——————————————————————————————————————————
export const thesisProbabilitySnapshots = pgTable(
  "thesis_probability_snapshots",
  {
    id: serial("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    thesisId: integer("thesis_id")
      .notNull()
      .references(() => theses.id),
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
    index("prob_snapshots_ws_idx").on(t.workspaceId),
  ]
);
