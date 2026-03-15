import { db } from "./index";
import { pipelineRuns } from "./schema";
import { eq, desc } from "drizzle-orm";

export async function createPipelineRun(
  workspaceId: string,
  triggeredBy: "cron" | "manual"
) {
  const [run] = await db
    .insert(pipelineRuns)
    .values({ workspaceId, triggeredBy, status: "running" })
    .returning();
  return run;
}

export async function completePipelineRun(
  runId: number,
  status: "completed" | "failed",
  steps: Record<string, unknown>
) {
  await db
    .update(pipelineRuns)
    .set({ completedAt: new Date(), status, steps })
    .where(eq(pipelineRuns.id, runId));
}

export async function getLastPipelineRun(workspaceId: string) {
  const [row] = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.workspaceId, workspaceId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(1);
  return row ?? null;
}

export async function getRecentPipelineRuns(
  workspaceId: string,
  limit = 5
) {
  return db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.workspaceId, workspaceId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(limit);
}
