"use server";

import { resolvePrediction } from "@/lib/db/queries";
import {
  updateThesis,
  getConnectionsTo,
  reinforceConnection,
  createBacktestRun,
  updateBacktestRun,
} from "@/lib/db/graph-queries";
import { db } from "@/lib/db";
import { thesisProbabilitySnapshots } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getWorkspaceId } from "@/lib/db/workspace";

export async function resolveAction(
  predictionId: number,
  outcome: string,
  notes: string
) {
  const workspaceId = await getWorkspaceId();
  await resolvePrediction(workspaceId, predictionId, outcome, notes);
  revalidatePath("/log");
  revalidatePath(`/predictions/${predictionId}`);
  revalidatePath("/dashboard");
}

export async function resolveThesisAction(workspaceId: string, thesisId: number, wasCorrect: boolean, resolutionSource?: string) {
  const status = wasCorrect ? "resolved_correct" : "resolved_incorrect";

  // Fetch most recent probability snapshot for Brier score
  const [latestSnapshot] = await db
    .select({ probability: thesisProbabilitySnapshots.probability })
    .from(thesisProbabilitySnapshots)
    .where(and(eq(thesisProbabilitySnapshots.workspaceId, workspaceId), eq(thesisProbabilitySnapshots.thesisId, thesisId)))
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(1);

  const finalProbability = latestSnapshot?.probability ?? null;
  const outcome = wasCorrect ? 1 : 0;
  const brierScore = finalProbability != null ? (finalProbability - outcome) ** 2 : null;

  // Update thesis status with scoring data
  await updateThesis(workspaceId, thesisId, {
    status,
    isActive: false,
    resolvedAt: new Date(),
    ...(finalProbability != null && { finalProbability }),
    ...(brierScore != null && { brierScore }),
    ...(resolutionSource && { resolutionSource }),
  });

  // Reinforce all connections pointing to this thesis
  const conns = await getConnectionsTo(workspaceId, "thesis", thesisId);
  for (const conn of conns) {
    // For SUPPORTS connections: correct thesis → reward; incorrect → penalize
    // For CONTRADICTS connections: correct thesis → penalize; incorrect → reward
    const connCorrect =
      conn.relation === "CONTRADICTS" ? !wasCorrect : wasCorrect;
    await reinforceConnection(workspaceId, conn.id, connCorrect);
  }

  // Record a backtest run capturing the outcome
  const now = new Date();
  const run = await createBacktestRun(workspaceId, {
    name: `Thesis #${thesisId} resolution: ${status}`,
    thesisId,
    startDate: now,
    endDate: now,
    parameters: { wasCorrect, connectionCount: conns.length },
  });
  await updateBacktestRun(workspaceId, run.id, {
    status: "completed",
    completedAt: now,
    totalSignals: conns.length,
    correctSignals: conns.filter((c) =>
      c.relation === "CONTRADICTS" ? !wasCorrect : wasCorrect
    ).length,
    accuracy:
      conns.length > 0
        ? conns.filter((c) =>
            c.relation === "CONTRADICTS" ? !wasCorrect : wasCorrect
          ).length / conns.length
        : 0,
  });

  revalidatePath("/thesis");
  revalidatePath("/dashboard");
}
