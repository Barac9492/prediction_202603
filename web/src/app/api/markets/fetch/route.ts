import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/core/markets-fetch";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const workspaceId = await getWorkspaceId();
    const result = await fetchMarkets(workspaceId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Market fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
