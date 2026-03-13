import { NextResponse } from "next/server";
import { getProbabilityHistory } from "@/lib/db/probability";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const thesisId = Number(id);
    if (isNaN(thesisId)) {
      return NextResponse.json({ error: "Invalid thesis id" }, { status: 400 });
    }
    const history = await getProbabilityHistory(thesisId, 90);
    return NextResponse.json(history);
  } catch (err) {
    console.error("probability GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
