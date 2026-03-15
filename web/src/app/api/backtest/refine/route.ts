import { NextResponse } from "next/server";
import { refineParams } from "@/lib/backtest/refiner";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/backtest/refine
 * Run parameter sweep and apply best params if improvement exceeds threshold.
 */
export async function POST() {
  const workspaceId = await getWorkspaceId();
  const result = await refineParams(workspaceId);
  return NextResponse.json(result);
}
