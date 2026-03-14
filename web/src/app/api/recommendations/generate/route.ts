import { NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/recommendations/generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/recommendations/generate
 * Generate investment recommendations from active thesis state.
 */
export async function POST() {
  try {
    const result = await generateRecommendations();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Recommendation generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
