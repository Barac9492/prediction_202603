DROP INDEX "entities_ws_name_idx";--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "trial_expires_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "entities_ws_name_uniq" ON "entities" USING btree ("workspace_id","name");