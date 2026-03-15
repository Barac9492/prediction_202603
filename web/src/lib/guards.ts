import { db } from "./db";
import { workspaces, workspaceMembers, theses } from "./db/schema";
import { eq, and, sql } from "drizzle-orm";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function requireActivePlan(workspaceId: string) {
  const [ws] = await db
    .select({ plan: workspaces.plan })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!ws || ws.plan === "expired") {
    throw new PlanLimitError(
      "Your subscription has expired. Please upgrade to continue."
    );
  }
}

export async function checkThesisLimit(workspaceId: string) {
  const [ws] = await db
    .select({ thesisLimit: workspaces.thesisLimit })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!ws) throw new PlanLimitError("Workspace not found");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(theses)
    .where(
      and(eq(theses.workspaceId, workspaceId), eq(theses.isActive, true))
    );

  if (count >= ws.thesisLimit) {
    throw new PlanLimitError(
      `Active thesis limit reached (${ws.thesisLimit}). Please upgrade your plan.`
    );
  }
}

export async function checkSeatLimit(workspaceId: string) {
  const [ws] = await db
    .select({ seatLimit: workspaces.seatLimit })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!ws) throw new PlanLimitError("Workspace not found");

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  if (count >= ws.seatLimit) {
    throw new PlanLimitError(
      `Seat limit reached (${ws.seatLimit}). Please upgrade your plan.`
    );
  }
}
