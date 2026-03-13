"use server";

import { resolvePrediction } from "@/lib/db/queries";
import {
  updateThesis,
  getConnectionsTo,
  reinforceConnection,
  createBacktestRun,
  updateBacktestRun,
} from "@/lib/db/graph-queries";
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

export async function resolveThesisAction(thesisId: number, wasCorrect: boolean) {
  const status = wasCorrect ? "resolved_correct" : "resolved_incorrect";

  // Update thesis status
  await updateThesis(thesisId, { status, isActive: false });

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
