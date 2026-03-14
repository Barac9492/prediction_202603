import { pgTable, serial, text, real, jsonb, integer, timestamp, foreignKey, index, unique, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const predictions = pgTable("predictions", {
	id: serial().primaryKey().notNull(),
	topic: text().notNull(),
	direction: text().notNull(),
	confidence: real().notNull(),
	weightedScore: real("weighted_score").notNull(),
	topReasons: jsonb("top_reasons").notNull(),
	signalCount: integer("signal_count").notNull(),
	bullishCount: integer("bullish_count").notNull(),
	bearishCount: integer("bearish_count").notNull(),
	neutralCount: integer("neutral_count").notNull(),
	contradictions: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	actualOutcome: text("actual_outcome"),
	outcomeNotes: text("outcome_notes"),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
});

export const signals = pgTable("signals", {
	id: serial().primaryKey().notNull(),
	predictionId: integer("prediction_id").notNull(),
	description: text().notNull(),
	direction: text().notNull(),
	strength: integer().notNull(),
	reasoning: text().notNull(),
	sourceTitle: text("source_title"),
}, (table) => [
	foreignKey({
			columns: [table.predictionId],
			foreignColumns: [predictions.id],
			name: "signals_prediction_id_predictions_id_fk"
		}),
]);

export const sources = pgTable("sources", {
	id: serial().primaryKey().notNull(),
	predictionId: integer("prediction_id").notNull(),
	title: text(),
	url: text(),
	summary: text(),
	relevanceScore: integer("relevance_score"),
	collectedAt: timestamp("collected_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.predictionId],
			foreignColumns: [predictions.id],
			name: "sources_prediction_id_predictions_id_fk"
		}),
]);

export const newsEvents = pgTable("news_events", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	url: text(),
	source: text(),
	content: text(),
	summary: text(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	ingestedAt: timestamp("ingested_at", { mode: 'string' }).defaultNow().notNull(),
	processed: boolean().default(false).notNull(),
	aiRelevance: integer("ai_relevance"),
	sentiment: text(),
	extractedEntities: jsonb("extracted_entities").default([]),
	extractedThesisIds: jsonb("extracted_thesis_ids").default([]),
}, (table) => [
	index("news_events_processed_idx").using("btree", table.processed.asc().nullsLast().op("bool_ops")),
	index("news_events_published_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamp_ops")),
	unique("news_events_url_unique").on(table.url),
]);

export const theses = pgTable("theses", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	direction: text().notNull(),
	domain: text().default('AI').notNull(),
	tags: jsonb().default([]),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	status: text().default('active').notNull(),
	aiRationale: text("ai_rationale"),
});

export const entities = pgTable("entities", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	description: text(),
	aliases: jsonb().default([]),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("entities_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("entities_name_unique").on(table.name),
]);

export const connections = pgTable("connections", {
	id: serial().primaryKey().notNull(),
	fromType: text("from_type").notNull(),
	fromId: integer("from_id").notNull(),
	toType: text("to_type").notNull(),
	toId: integer("to_id").notNull(),
	relation: text().notNull(),
	direction: text(),
	confidence: real().default(0.5).notNull(),
	weight: real().default(1).notNull(),
	reasoning: text(),
	sourceNewsId: integer("source_news_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	adjustedWeight: real("adjusted_weight"),
}, (table) => [
	index("connections_from_idx").using("btree", table.fromType.asc().nullsLast().op("int4_ops"), table.fromId.asc().nullsLast().op("text_ops")),
	index("connections_to_idx").using("btree", table.toType.asc().nullsLast().op("int4_ops"), table.toId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.sourceNewsId],
			foreignColumns: [newsEvents.id],
			name: "connections_source_news_id_news_events_id_fk"
		}),
]);

export const backtestRuns = pgTable("backtest_runs", {
	id: serial().primaryKey().notNull(),
	thesisId: integer("thesis_id"),
	name: text().notNull(),
	startDate: timestamp("start_date", { mode: 'string' }).notNull(),
	endDate: timestamp("end_date", { mode: 'string' }).notNull(),
	parameters: jsonb().default({}),
	results: jsonb(),
	accuracy: real(),
	totalSignals: integer("total_signals"),
	correctSignals: integer("correct_signals"),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.thesisId],
			foreignColumns: [theses.id],
			name: "backtest_runs_thesis_id_theses_id_fk"
		}),
]);

export const thesisProbabilitySnapshots = pgTable("thesis_probability_snapshots", {
	id: serial().primaryKey().notNull(),
	thesisId: integer("thesis_id").notNull(),
	probability: real().notNull(),
	bullishWeight: real("bullish_weight").default(0).notNull(),
	bearishWeight: real("bearish_weight").default(0).notNull(),
	neutralWeight: real("neutral_weight").default(0).notNull(),
	signalCount: integer("signal_count").default(0).notNull(),
	momentum: real(),
	computedAt: timestamp("computed_at", { mode: 'string' }).defaultNow().notNull(),
	topNewsIds: jsonb("top_news_ids").default([]),
}, (table) => [
	index("prob_snapshots_thesis_idx").using("btree", table.thesisId.asc().nullsLast().op("int4_ops")),
	index("prob_snapshots_time_idx").using("btree", table.computedAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.thesisId],
			foreignColumns: [theses.id],
			name: "thesis_probability_snapshots_thesis_id_theses_id_fk"
		}),
]);
