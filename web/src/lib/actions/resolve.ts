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
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function resolveAction(
  predictionId: number,
  outcome: string,
  notes: string
) {
  await resolvePrediction(predictionId, outcome, notes);
  revalidatePath("/log");
  revalidatePath(`/predictions/${predictionId}`);
  revalidatePath("/dashboard");
}

export async function resolveThesisAction(thesisId: number, wasCorrect: boolean, resolutionSource?: string) {
  const status = wasCorrect ? "resolved_correct" : "resolved_incorrect";

  // Fetch most recent probability snapshot for Brier score
  const [latestSnapshot] = await db
    .select({ probability: thesisProbabilitySnapshots.probability })
    .from(thesisProbabilitySnapshots)
    .where(eq(thesisProbabilitySnapshots.thesisId, thesisId))
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(1);

  const finalProbability = latestSnapshot?.probability ?? null;
  const outcome = wasCorrect ? 1 : 0;
  const brierScore = finalProbability != null ? (finalProbability - outcome) ** 2 : null;

  // Update thesis status with scoring data
  await updateThesis(thesisId, {
    status,
    isActive: false,
    resolvedAt: new Date(),
    ...(finalProbability != null && { finalProbability }),
    ...(brierScore != null && { brierScore }),
    ...(resolutionSource && { resolutionSource }),
  });

  // Reinforce all connections pointing to this thesis
  const conns = await getConnectionsTo("thesis", thesisId);
  for (const conn of conns) {
    // For SUPPORTS connections: correct thesis → reward; incorrect → penalize
    // For CONTRADICTS connections: correct thesis → penalize; incorrect → reward
    const connCorrect =
      conn.relation === "CONTRADICTS" ? !wasCorrect : wasCorrect;
    await reinforceConnection(conn.id, connCorrect);
  }

  // Record a backtest run capturing the outcome
  const now = new Date();
  const run = await createBacktestRun({
    name: `Thesis #${thesisId} resolution: ${status}`,
    thesisId,
    startDate: now,
    endDate: now,
    parameters: { wasCorrect, connectionCount: conns.length },
  });
  await updateBacktestRun(run.id, {
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
