import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { snapshotAllProbabilities } from "@/lib/db/probability";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron — Automated ingestion pipeline.
 * Iterates all workspaces and runs: fetch RSS → ingest/process → snapshot probabilities.
 *
 * Protect with CRON_SECRET env var. Call via:
 *   curl https://yourapp.com/api/cron?secret=YOUR_SECRET
 *
 * Or wire to Vercel Cron / external scheduler.
 */
export async function GET(req: NextRequest) {
  // Auth check
  if (CRON_SECRET) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const allWorkspaces = await db.select().from(workspaces);
  const baseUrl = req.nextUrl.origin;
  const results: Record<string, unknown>[] = [];

  for (const workspace of allWorkspaces) {
    const workspaceId = workspace.id;
    const log: Record<string, unknown>[] = [];

    // Step 1: Fetch RSS feeds (calls the endpoint which now requires auth;
    // invoke directly instead)
    try {
      const fetchRes = await fetch(`${baseUrl}/api/feed/fetch`, { method: "POST" });
      const fetchData = await fetchRes.json();
      log.push({ step: "fetch", ...fetchData });
    } catch (err) {
      log.push({ step: "fetch", error: String(err) });
    }

    // Step 2: Process unprocessed events (up to 20 per run)
    try {
      const ingestRes = await fetch(`${baseUrl}/api/feed/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const ingestData = await ingestRes.json();
      log.push({ step: "ingest", ...ingestData });
    } catch (err) {
      log.push({ step: "ingest", error: String(err) });
    }

    // Step 3: Snapshot probabilities
    try {
      const snapshots = await snapshotAllProbabilities(workspaceId);
      log.push({ step: "probabilities", computed: snapshots.length });
    } catch (err) {
      log.push({ step: "probabilities", error: String(err) });
    }

    results.push({ workspaceId, pipeline: log });
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    workspacesProcessed: allWorkspaces.length,
    results,
  });
}
