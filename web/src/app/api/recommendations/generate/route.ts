import { NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/recommendations/generator";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/recommendations/generate
 * Generate investment recommendations from active thesis state.
 */
export async function POST() {
  try {
    const workspaceId = await getWorkspaceId();
    const result = await generateRecommendations(workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
