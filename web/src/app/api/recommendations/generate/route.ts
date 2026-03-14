import { NextResponse } from "next/server";
import { generateRecommendations } from "@/lib/recommendations/generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/recommendations/generate
 * Generate investment recommendations from active thesis state.
 */
export async function POST() {
  const result = await generateRecommendations();
  return NextResponse.json(result);
}
