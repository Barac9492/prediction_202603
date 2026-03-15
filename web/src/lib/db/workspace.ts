import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

const hasClerkKeys =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_");

/**
 * Resolve the current workspace ID from Clerk's organization context.
 * Falls back to "test-workspace" when Clerk is not configured.
 */
export async function getWorkspaceId(): Promise<string> {
  if (!hasClerkKeys) {
    return "test-workspace";
  }
  const { auth } = await import("@clerk/nextjs/server");
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
