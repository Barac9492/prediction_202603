import { db } from "./db";
import { workspaces } from "./db/schema";
import { eq } from "drizzle-orm";

// Plan limits configuration
const PLAN_LIMITS = {
  trial: { seats: 3, theses: 25, pipelineRunsPerDay: 4 },
  analyst: { seats: 3, theses: 25, pipelineRunsPerDay: 4 },
  team: { seats: 10, theses: 100, pipelineRunsPerDay: 12 },
  fund: { seats: Infinity, theses: Infinity, pipelineRunsPerDay: Infinity },
  expired: { seats: 0, theses: 0, pipelineRunsPerDay: 0 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as PlanId] ?? PLAN_LIMITS.expired;
}

export async function getWorkspacePlan(workspaceId: string) {
  const [ws] = await db
    .select({
      plan: workspaces.plan,
      stripeCustomerId: workspaces.stripeCustomerId,
      stripeSubscriptionId: workspaces.stripeSubscriptionId,
      seatLimit: workspaces.seatLimit,
      thesisLimit: workspaces.thesisLimit,
      pipelineRunsPerDay: workspaces.pipelineRunsPerDay,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  return ws ?? null;
}

export async function updateWorkspacePlan(
  workspaceId: string,
  data: {
    plan: string;
    paddleSubscriptionId?: string;
    paddleCustomerId?: string;
  }
) {
  const limits = getPlanLimits(data.plan);
  await db
    .update(workspaces)
    .set({
      plan: data.plan,
      stripeSubscriptionId: data.paddleSubscriptionId,
      stripeCustomerId: data.paddleCustomerId,
      seatLimit: limits.seats === Infinity ? 999 : limits.seats,
      thesisLimit: limits.theses === Infinity ? 99999 : limits.theses,
      pipelineRunsPerDay:
        limits.pipelineRunsPerDay === Infinity
          ? 99999
          : limits.pipelineRunsPerDay,
    })
    .where(eq(workspaces.id, workspaceId));
}
