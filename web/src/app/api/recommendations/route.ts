import { NextRequest, NextResponse } from "next/server";
import { listRecommendations } from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

/**
 * GET /api/recommendations?status=active&limit=50
 * List recommendations, optionally filtered by status.
 */
export async function GET(req: NextRequest) {
  const workspaceId = await getWorkspaceId();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const recs = await listRecommendations(workspaceId, { status, limit });
  return NextResponse.json({ recommendations: recs });
}
