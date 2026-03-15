import { NextRequest, NextResponse } from "next/server";
import { listNewsEvents } from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";
import { ingestNews } from "@/lib/core/feed-ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/feed/ingest
 * Processes unprocessed news events through LLM to extract graph connections.
 * Call this periodically (e.g., via cron or manual trigger).
 */
export async function POST(req: NextRequest) {
  const workspaceId = await getWorkspaceId();
  const { limit = 10 } = await req.json().catch(() => ({}));

  const result = await ingestNews(workspaceId, limit);
  return NextResponse.json(result);
}

/** GET /api/feed/ingest - Returns unprocessed count */
export async function GET() {
  const workspaceId = await getWorkspaceId();
  const unprocessed = await listNewsEvents(workspaceId, { unprocessedOnly: true, limit: 1000 });
  const recent = await listNewsEvents(workspaceId, { limit: 20 });
  return NextResponse.json({
    unprocessedCount: unprocessed.length,
    recentEvents: recent,
  });
}
