import { NextResponse } from "next/server";
import { fetchFeeds } from "@/lib/core/feed-fetch";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/feed/fetch - Fetch RSS feeds and store new AI-relevant news events */
export async function POST() {
  const workspaceId = await getWorkspaceId();
  const result = await fetchFeeds(workspaceId);
  return NextResponse.json(result);
}

/** GET /api/feed/fetch - Check feeds without storing */
export async function GET() {
  return NextResponse.json({ message: "POST to this endpoint to fetch and store RSS feeds" });
}
