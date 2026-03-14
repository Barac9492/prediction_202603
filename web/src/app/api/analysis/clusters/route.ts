import { NextRequest, NextResponse } from "next/server";
import { listSignalClusters, getClusterDetails } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const id = searchParams.get("id");

  if (id) {
    const details = await getClusterDetails(parseInt(id));
    if (!details) {
      return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
    }
    return NextResponse.json(details);
  }

  const clusters = await listSignalClusters(status);
  return NextResponse.json({ clusters });
}
