import { NextResponse } from "next/server";
import { getProbabilityHistory } from "@/lib/db/probability";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId();
    const { id } = await params;
    const thesisId = Number(id);
    if (isNaN(thesisId)) {
      return NextResponse.json({ error: "Invalid thesis id" }, { status: 400 });
    }
    const history = await getProbabilityHistory(workspaceId, thesisId, 90);
    return NextResponse.json(history);
  } catch (err) {
    console.error("probability GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
