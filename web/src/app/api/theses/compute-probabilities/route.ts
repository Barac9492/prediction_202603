import { NextResponse } from "next/server";
import { snapshotAllProbabilities } from "@/lib/db/probability";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await snapshotAllProbabilities();
    return NextResponse.json({ ok: true, computed: results.length, results });
  } catch (err) {
    console.error("compute-probabilities error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
