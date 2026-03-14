import { NextResponse } from "next/server";
import { evaluateExpiredRecs } from "@/lib/recommendations/evaluator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/recommendations/evaluate
 * Evaluate expired recommendations and compute Brier scores.
 */
export async function POST() {
  const result = await evaluateExpiredRecs();
  return NextResponse.json(result);
}
