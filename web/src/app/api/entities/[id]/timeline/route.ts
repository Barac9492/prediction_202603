import { NextRequest, NextResponse } from "next/server";
import { getEntityTimeline, getEntity } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entityId = parseInt(id);
  const entity = await getEntity(entityId);
  if (!entity) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const attribute = searchParams.get("attribute") || undefined;

  const timeline = await getEntityTimeline(entityId, attribute);
  return NextResponse.json({ entity, timeline });
}
