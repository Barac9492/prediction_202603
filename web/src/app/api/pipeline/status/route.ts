import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getLastPipelineRun, getRecentPipelineRuns } from "@/lib/db/pipeline";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspaceId = await getWorkspaceId();
  const [lastRun, recentRuns] = await Promise.all([
    getLastPipelineRun(workspaceId),
    getRecentPipelineRuns(workspaceId, 5),
  ]);

  return NextResponse.json({ lastRun, recentRuns });
}
