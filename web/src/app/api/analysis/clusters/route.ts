import { NextRequest, NextResponse } from "next/server";
import { listSignalClusters, getClusterDetails } from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const workspaceId = await getWorkspaceId();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const id = searchParams.get("id");

  if (id) {
    const details = await getClusterDetails(workspaceId, parseInt(id));
    if (!details) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }
    return NextResponse.json(details);
  }

  const clusters = await listSignalClusters(workspaceId, status);
  return NextResponse.json({ clusters });
}
