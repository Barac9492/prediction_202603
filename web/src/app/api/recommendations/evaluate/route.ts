import { NextResponse } from "next/server";
import { evaluateExpiredRecs } from "@/lib/recommendations/evaluator";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/recommendations/evaluate
 * Evaluate expired recommendations and compute Brier scores.
 */
export async function POST() {
  try {
    const workspaceId = await getWorkspaceId();
    const result = await evaluateExpiredRecs(workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommendation evaluation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Evaluation failed" },
      { status: 500 }
    );
  }
}
