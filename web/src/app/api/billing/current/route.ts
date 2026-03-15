import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getWorkspacePlan } from "@/lib/billing";
import { db } from "@/lib/db";
import { theses, workspaceMembers } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/billing/current — current plan, limits, and usage */
export async function GET() {
  const workspaceId = await getWorkspaceId();
  const plan = await getWorkspacePlan(workspaceId);

  if (!plan) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const [{ activeTheses }] = await db
    .select({ activeTheses: sql<number>`count(*)::int` })
    .from(theses)
    .where(and(eq(theses.workspaceId, workspaceId), eq(theses.isActive, true)));

  const [{ seats }] = await db
    .select({ seats: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return NextResponse.json({
    plan: plan.plan,
    seatLimit: plan.seatLimit,
    thesisLimit: plan.thesisLimit,
    pipelineRunsPerDay: plan.pipelineRunsPerDay,
    usage: { activeTheses, seats },
  });
}
