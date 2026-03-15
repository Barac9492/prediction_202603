import { NextRequest, NextResponse } from "next/server";
import { snapshotAllProbabilities } from "@/lib/db/probability";
import { getAllWorkspaceIds } from "@/lib/db/workspace";
import { ingestVault } from "@/lib/core/vault-ingest";
import { fetchFeeds } from "@/lib/core/feed-fetch";
import { ingestNews } from "@/lib/core/feed-ingest";
import { fetchMarkets } from "@/lib/core/markets-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/pipeline/run
 * Full pipeline: vault ingest → fetch RSS → LLM ingest → fetch markets → snapshot probabilities → fusion → recs.
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

  const workspaceIds = await getAllWorkspaceIds();
  const allSteps: Record<string, Record<string, unknown>> = {};

  for (const workspaceId of workspaceIds) {
    const steps: Record<string, unknown> = {};

    // Step 0: Ingest Obsidian vault notes
    try {
      steps.vaultIngest = await ingestVault(workspaceId);
    } catch (err) {
      steps.vaultIngest = { error: String(err) };
    }

    // Step 1: Fetch RSS feeds
    try {
      steps.feedFetch = await fetchFeeds(workspaceId);
    } catch (err) {
      steps.feedFetch = { error: String(err) };
    }

    // Step 2: LLM ingest unprocessed events
    try {
      steps.feedIngest = await ingestNews(workspaceId, 20);
    } catch (err) {
      steps.feedIngest = { error: String(err) };
    }

    // Step 3: Fetch Polymarket data
    try {
      steps.marketFetch = await fetchMarkets(workspaceId);
    } catch (err) {
      steps.marketFetch = { error: String(err) };
    }

    // Step 4: Snapshot all probabilities
    try {
      const snapshots = await snapshotAllProbabilities(workspaceId);
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
      const fusionResult = await detectClusters(workspaceId, 7);
      steps.signalFusion = fusionResult;
    } catch (err) {
      steps.signalFusion = { error: String(err) };
    }

    // Step 6: Evaluate expired recommendations
    let resolvedCount = 0;
    try {
      const { evaluateExpiredRecs } = await import("@/lib/recommendations/evaluator");
      const evalResult = await evaluateExpiredRecs(workspaceId);
      steps.recEvaluate = evalResult;
      resolvedCount = evalResult.evaluated;
    } catch (err) {
      steps.recEvaluate = { error: String(err) };
    }

    // Step 7: Generate new recommendations (if few active)
    try {
      const { generateRecommendations } = await import("@/lib/recommendations/generator");
      const genResult = await generateRecommendations(workspaceId);
      steps.recGenerate = genResult;
    } catch (err) {
      steps.recGenerate = { error: String(err) };
    }

    // Step 8: Refine backtest params (if any recs were resolved)
    if (resolvedCount > 0) {
      try {
        const { refineParams } = await import("@/lib/backtest/refiner");
        const refineResult = await refineParams(workspaceId);
        steps.backtestRefine = refineResult;
      } catch (err) {
        steps.backtestRefine = { error: String(err) };
      }
    }

    allSteps[workspaceId] = steps;
  }

  return NextResponse.json({
    completedAt: new Date().toISOString(),
    workspaces: allSteps,
  });
}
