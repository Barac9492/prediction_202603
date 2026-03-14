CREATE TABLE "entity_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_id" integer NOT NULL,
	"attribute" text NOT NULL,
	"value" text NOT NULL,
	"numeric_value" real,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"source_news_id" integer,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"thesis_id" integer,
	"action" text NOT NULL,
	"asset" text NOT NULL,
	"conviction" real NOT NULL,
	"timeframe_days" integer NOT NULL,
	"deadline" timestamp NOT NULL,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"outcome_notes" text,
	"brier_score" real,
	"resolved_at" timestamp,
	"probability_at_creation" real,
	"probability_at_resolution" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"pattern" text NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"connection_ids" jsonb DEFAULT '[]'::jsonb,
	"entity_ids" jsonb DEFAULT '[]'::jsonb,
	"thesis_ids" jsonb DEFAULT '[]'::jsonb,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
DROP INDEX "news_events_processed_idx";--> statement-breakpoint
DROP INDEX "news_events_published_idx";--> statement-breakpoint
DROP INDEX "entities_name_idx";--> statement-breakpoint
DROP INDEX "connections_from_idx";--> statement-breakpoint
DROP INDEX "connections_to_idx";--> statement-breakpoint
DROP INDEX "prob_snapshots_thesis_idx";--> statement-breakpoint
DROP INDEX "prob_snapshots_time_idx";--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "resolution_criteria" text;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "deadline" timestamp;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "resolution_criteria" text;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "resolution_source" text;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "final_probability" real;--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN "brier_score" real;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "entity_observations" ADD CONSTRAINT "entity_observations_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_observations" ADD CONSTRAINT "entity_observations_source_news_id_news_events_id_fk" FOREIGN KEY ("source_news_id") REFERENCES "public"."news_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_obs_entity_attr_idx" ON "entity_observations" USING btree ("entity_id","attribute","observed_at");--> statement-breakpoint
CREATE INDEX "news_events_processed_idx" ON "news_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "news_events_published_idx" ON "news_events" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "connections_from_idx" ON "connections" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "connections_to_idx" ON "connections" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "prob_snapshots_thesis_idx" ON "thesis_probability_snapshots" USING btree ("thesis_id");--> statement-breakpoint
CREATE INDEX "prob_snapshots_time_idx" ON "thesis_probability_snapshots" USING btree ("computed_at");