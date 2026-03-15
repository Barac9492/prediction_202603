import { NextResponse } from "next/server";
import { snapshotAllProbabilities } from "@/lib/db/probability";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const workspaceId = await getWorkspaceId();
    const results = await snapshotAllProbabilities(workspaceId);
    return NextResponse.json({ ok: true, computed: results.length, results });
  } catch (err) {
    console.error("compute-probabilities error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
