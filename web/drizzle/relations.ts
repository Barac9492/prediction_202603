import { relations } from "drizzle-orm/relations";
import { predictions, signals, sources, newsEvents, connections, theses, backtestRuns, thesisProbabilitySnapshots } from "./schema";

export const signalsRelations = relations(signals, ({one}) => ({
	prediction: one(predictions, {
		fields: [signals.predictionId],
		references: [predictions.id]
	}),
}));

export const predictionsRelations = relations(predictions, ({many}) => ({
	signals: many(signals),
	sources: many(sources),
}));

export const sourcesRelations = relations(sources, ({one}) => ({
	prediction: one(predictions, {
		fields: [sources.predictionId],
		references: [predictions.id]
	}),
}));

export const connectionsRelations = relations(connections, ({one}) => ({
	newsEvent: one(newsEvents, {
		fields: [connections.sourceNewsId],
		references: [newsEvents.id]
	}),
}));

export const newsEventsRelations = relations(newsEvents, ({many}) => ({
	connections: many(connections),
}));

export const backtestRunsRelations = relations(backtestRuns, ({one}) => ({
	thesis: one(theses, {
		fields: [backtestRuns.thesisId],
		references: [theses.id]
	}),
}));

export const thesesRelations = relations(theses, ({many}) => ({
	backtestRuns: many(backtestRuns),
	thesisProbabilitySnapshots: many(thesisProbabilitySnapshots),
}));

export const thesisProbabilitySnapshotsRelations = relations(thesisProbabilitySnapshots, ({one}) => ({
	thesis: one(theses, {
		fields: [thesisProbabilitySnapshots.thesisId],
		references: [theses.id]
	}),
}));