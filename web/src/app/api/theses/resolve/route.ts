import { NextRequest, NextResponse } from "next/server";
import { resolveThesisAction } from "@/lib/actions/resolve";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id, wasCorrect, resolutionSource } = await req.json();
    if (typeof id !== "number" || typeof wasCorrect !== "boolean") {
      return NextResponse.json(
        { error: "Required: id (number), wasCorrect (boolean)" },
        { status: 400 }
      );
    }
    await resolveThesisAction(id, wasCorrect, resolutionSource);
    return NextResponse.json({ success: true, id, status: wasCorrect ? "resolved_correct" : "resolved_incorrect" });
  } catch (err) {
    console.error("Failed to resolve thesis:", err);
    return NextResponse.json({ error: "Failed to resolve thesis" }, { status: 500 });
  }
}
