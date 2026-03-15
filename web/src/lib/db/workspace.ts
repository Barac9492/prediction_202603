import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

/**
 * Resolve the current workspace ID from Clerk's organization context.
 * Throws if no org is selected (user must be in an org to use the app).
 */
export async function getWorkspaceId(): Promise<string> {
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error("No workspace selected. Please select an organization.");
  }
  return orgId;
}

/**
 * List all workspace IDs. Used by cron/pipeline routes that run
 * outside a user session and need to iterate every workspace.
 */
export async function getAllWorkspaceIds(): Promise<string[]> {
  const rows = await db.select({ id: workspaces.id }).from(workspaces);
  return rows.map((r) => r.id);
}
