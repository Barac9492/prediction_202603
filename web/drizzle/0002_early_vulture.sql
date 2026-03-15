-- Create workspace tables
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'trial' NOT NULL,
	"seat_limit" integer DEFAULT 3 NOT NULL,
	"thesis_limit" integer DEFAULT 25 NOT NULL,
	"pipeline_runs_per_day" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text DEFAULT 'analyst' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create default workspace for existing data migration
INSERT INTO "workspaces" ("id", "name") VALUES ('ws_default', 'Default Workspace') ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- Recreate price_snapshots with workspace_id (was previously dropped/recreated)
CREATE TABLE IF NOT EXISTS "price_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL DEFAULT 'ws_default',
	"ticker" text NOT NULL,
	"price" real NOT NULL,
	"volume" real,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Drop unique constraints that are now per-workspace
ALTER TABLE "entities" DROP CONSTRAINT IF EXISTS "entities_name_unique";
--> statement-breakpoint
ALTER TABLE "news_events" DROP CONSTRAINT IF EXISTS "news_events_url_unique";
--> statement-breakpoint

-- Add workspace_id columns (nullable first, then backfill, then NOT NULL)
ALTER TABLE "backtest_runs" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "backtest_runs" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "backtest_runs" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "connections" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "connections" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "connections" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "entities" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "entities" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "entity_observations" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "entity_observations" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "entity_observations" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "news_events" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "news_events" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "news_events" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "predictions" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "predictions" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "recommendations" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "recommendations" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "signal_clusters" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "signal_clusters" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "signal_clusters" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "signals" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "signals" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "sources" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "sources" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "theses" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "theses" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "theses" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "thesis_probability_snapshots" ADD COLUMN IF NOT EXISTS "workspace_id" text DEFAULT 'ws_default';
UPDATE "thesis_probability_snapshots" SET "workspace_id" = 'ws_default' WHERE "workspace_id" IS NULL;
ALTER TABLE "thesis_probability_snapshots" ALTER COLUMN "workspace_id" SET NOT NULL;
--> statement-breakpoint

-- Add missing columns to recommendations (if needed)
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "ticker" text;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "price_at_creation" real;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "price_at_resolution" real;
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "actual_return" real;
--> statement-breakpoint

-- Foreign keys
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Drop defaults now that backfill is done
ALTER TABLE "backtest_runs" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "connections" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "entities" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "entity_observations" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "news_events" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "predictions" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "recommendations" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "signal_clusters" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "signals" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "sources" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "theses" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "thesis_probability_snapshots" ALTER COLUMN "workspace_id" DROP DEFAULT;
ALTER TABLE "price_snapshots" ALTER COLUMN "workspace_id" DROP DEFAULT;
--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "price_snapshots_ticker_time_idx" ON "price_snapshots" USING btree ("ticker","captured_at");
CREATE INDEX IF NOT EXISTS "price_snapshots_ws_idx" ON "price_snapshots" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_members_ws_idx" ON "workspace_members" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members" USING btree ("clerk_user_id");
CREATE INDEX IF NOT EXISTS "backtest_runs_ws_idx" ON "backtest_runs" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "connections_ws_idx" ON "connections" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "entities_ws_idx" ON "entities" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "entities_ws_name_idx" ON "entities" USING btree ("workspace_id","name");
CREATE INDEX IF NOT EXISTS "entity_obs_ws_idx" ON "entity_observations" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "news_events_ws_idx" ON "news_events" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "predictions_ws_idx" ON "predictions" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "recommendations_ws_idx" ON "recommendations" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "signal_clusters_ws_idx" ON "signal_clusters" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "signals_ws_idx" ON "signals" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "sources_ws_idx" ON "sources" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "theses_ws_idx" ON "theses" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "prob_snapshots_ws_idx" ON "thesis_probability_snapshots" USING btree ("workspace_id");
