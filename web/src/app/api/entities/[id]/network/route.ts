import { NextRequest, NextResponse } from "next/server";
import { getEntityNetwork } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entityId = parseInt(id);
  const { searchParams } = new URL(req.url);
  const depth = parseInt(searchParams.get("depth") || "1");

  const network = await getEntityNetwork(entityId, depth);
  if (!network) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json(network);
}
