import { NextRequest, NextResponse } from "next/server";
import { snapshotAllProbabilities } from "@/lib/db/probability";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/pipeline/run
 * Full pipeline: fetch RSS → LLM ingest → fetch markets → snapshot probabilities.
 * Protected by CRON_SECRET env var.
 */
export async function POST(req: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const steps: Record<string, unknown> = {};

  // Step 1: Fetch RSS feeds
  try {
    const { POST: fetchFeeds } = await import("@/app/api/feed/fetch/route");
    const feedRes = await fetchFeeds();
    steps.feedFetch = await feedRes.json();
  } catch (err) {
    steps.feedFetch = { error: String(err) };
  }

  // Step 2: LLM ingest unprocessed events
  try {
    const { POST: ingestFeeds } = await import("@/app/api/feed/ingest/route");
    const ingestReq = new Request("http://localhost/api/feed/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 }),
    });
    const ingestRes = await ingestFeeds(ingestReq as NextRequest);
    steps.feedIngest = await ingestRes.json();
  } catch (err) {
    steps.feedIngest = { error: String(err) };
  }

  // Step 3: Fetch Polymarket data
  try {
    const { POST: fetchMarkets } = await import("@/app/api/markets/fetch/route");
    const marketRes = await fetchMarkets();
    steps.marketFetch = await marketRes.json();
  } catch (err) {
    steps.marketFetch = { error: String(err) };
  }

  // Step 4: Snapshot all probabilities
  try {
    const snapshots = await snapshotAllProbabilities();
    steps.probabilitySnapshot = {
      count: snapshots.length,
      theses: snapshots,
    };
  } catch (err) {
    steps.probabilitySnapshot = { error: String(err) };
  }

  // Step 5: Signal fusion — detect entity co-occurrence clusters
  try {
    const { detectClusters } = await import("@/lib/analysis/signal-fusion");
    const fusionResult = await detectClusters(7);
    steps.signalFusion = fusionResult;
  } catch (err) {
    steps.signalFusion = { error: String(err) };
  }

  return NextResponse.json({
    completedAt: new Date().toISOString(),
    steps,
  });
}
