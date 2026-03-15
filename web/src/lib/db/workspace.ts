import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

/**
 * Returns the hardcoded workspace ID (single-user app).
 */
export async function getWorkspaceId(): Promise<string> {
  return "test-workspace";
}

/**
 * List all workspace IDs. Used by cron/pipeline routes that run
 * outside a user session and need to iterate every workspace.
 */
export async function getAllWorkspaceIds(): Promise<string[]> {
  const rows = await db.select({ id: workspaces.id }).from(workspaces);
  return rows.map((r) => r.id);
}
