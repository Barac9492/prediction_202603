-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "predictions" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic" text NOT NULL,
	"direction" text NOT NULL,
	"confidence" real NOT NULL,
	"weighted_score" real NOT NULL,
	"top_reasons" jsonb NOT NULL,
	"signal_count" integer NOT NULL,
	"bullish_count" integer NOT NULL,
	"bearish_count" integer NOT NULL,
	"neutral_count" integer NOT NULL,
	"contradictions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"actual_outcome" text,
	"outcome_notes" text,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"prediction_id" integer NOT NULL,
	"description" text NOT NULL,
	"direction" text NOT NULL,
	"strength" integer NOT NULL,
	"reasoning" text NOT NULL,
	"source_title" text
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"prediction_id" integer NOT NULL,
	"title" text,
	"url" text,
	"summary" text,
	"relevance_score" integer,
	"collected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "news_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"source" text,
	"content" text,
	"summary" text,
	"published_at" timestamp,
	"ingested_at" timestamp DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"ai_relevance" integer,
	"sentiment" text,
	"extracted_entities" jsonb DEFAULT '[]'::jsonb,
	"extracted_thesis_ids" jsonb DEFAULT '[]'::jsonb,
	CONSTRAINT "news_events_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "theses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"direction" text NOT NULL,
	"domain" text DEFAULT 'AI' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ai_rationale" text
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_type" text NOT NULL,
	"from_id" integer NOT NULL,
	"to_type" text NOT NULL,
	"to_id" integer NOT NULL,
	"relation" text NOT NULL,
	"direction" text,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"reasoning" text,
	"source_news_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"adjusted_weight" real
);
--> statement-breakpoint
CREATE TABLE "backtest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"thesis_id" integer,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb,
	"results" jsonb,
	"accuracy" real,
	"total_signals" integer,
	"correct_signals" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "thesis_probability_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"thesis_id" integer NOT NULL,
	"probability" real NOT NULL,
	"bullish_weight" real DEFAULT 0 NOT NULL,
	"bearish_weight" real DEFAULT 0 NOT NULL,
	"neutral_weight" real DEFAULT 0 NOT NULL,
	"signal_count" integer DEFAULT 0 NOT NULL,
	"momentum" real,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"top_news_ids" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_prediction_id_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_source_news_id_news_events_id_fk" FOREIGN KEY ("source_news_id") REFERENCES "public"."news_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thesis_probability_snapshots" ADD CONSTRAINT "thesis_probability_snapshots_thesis_id_theses_id_fk" FOREIGN KEY ("thesis_id") REFERENCES "public"."theses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "news_events_processed_idx" ON "news_events" USING btree ("processed" bool_ops);--> statement-breakpoint
CREATE INDEX "news_events_published_idx" ON "news_events" USING btree ("published_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "connections_from_idx" ON "connections" USING btree ("from_type" int4_ops,"from_id" text_ops);--> statement-breakpoint
CREATE INDEX "connections_to_idx" ON "connections" USING btree ("to_type" int4_ops,"to_id" int4_ops);--> statement-breakpoint
CREATE INDEX "prob_snapshots_thesis_idx" ON "thesis_probability_snapshots" USING btree ("thesis_id" int4_ops);--> statement-breakpoint
CREATE INDEX "prob_snapshots_time_idx" ON "thesis_probability_snapshots" USING btree ("computed_at" timestamp_ops);
*/