import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { snapshotAllProbabilities } from "@/lib/db/probability";
import { createPipelineRun, completePipelineRun } from "@/lib/db/pipeline";
import { fetchFeeds } from "@/lib/core/feed-fetch";
import { ingestNews } from "@/lib/core/feed-ingest";
import { fetchMarkets } from "@/lib/core/markets-fetch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron — Full automated pipeline.
 * Runs all 9 steps for every workspace: vault → RSS → ingest → markets →
 * probabilities → fusion → interactions → recs → deadlines.
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
  const results: Record<string, unknown>[] = [];

  for (const workspace of allWorkspaces) {
    const workspaceId = workspace.id;
    const steps: Record<string, unknown> = {};
    let hasError = false;

    // Record pipeline run start
    const run = await createPipelineRun(workspaceId, "cron");

    // Step 0: Ingest Obsidian vault notes
    try {
      const { ingestVault } = await import("@/lib/core/vault-ingest");
      steps.vaultIngest = await ingestVault(workspaceId);
    } catch (err) {
      steps.vaultIngest = { error: String(err) };
      hasError = true;
    }

    // Step 1: Fetch RSS feeds
    try {
      steps.feedFetch = await fetchFeeds(workspaceId);
    } catch (err) {
      steps.feedFetch = { error: String(err) };
      hasError = true;
    }

    // Step 2: LLM ingest unprocessed events
    try {
      steps.feedIngest = await ingestNews(workspaceId, 20);
    } catch (err) {
      steps.feedIngest = { error: String(err) };
      hasError = true;
    }

    // Step 3: Fetch Polymarket data
    try {
      steps.marketFetch = await fetchMarkets(workspaceId);
    } catch (err) {
      steps.marketFetch = { error: String(err) };
      hasError = true;
    }

    // Step 4: Snapshot all probabilities
    try {
      const snapshots = await snapshotAllProbabilities(workspaceId);
      steps.probabilitySnapshot = { count: snapshots.length };
    } catch (err) {
      steps.probabilitySnapshot = { error: String(err) };
      hasError = true;
    }

    // Step 5: Signal fusion — detect entity co-occurrence clusters
    try {
      const { detectClusters } = await import("@/lib/analysis/signal-fusion");
      steps.signalFusion = await detectClusters(workspaceId, 7);
    } catch (err) {
      steps.signalFusion = { error: String(err) };
      hasError = true;
    }

    // Step 6: Detect thesis interactions (REINFORCES/CONTRADICTS)
    try {
      const { detectThesisInteractions } = await import("@/lib/analysis/thesis-interactions");
      steps.thesisInteractions = await detectThesisInteractions(workspaceId);
    } catch (err) {
      steps.thesisInteractions = { error: String(err) };
      hasError = true;
    }

    // Step 7: Evaluate expired recommendations + refine backtest params
    let resolvedCount = 0;
    try {
      const { evaluateExpiredRecs } = await import("@/lib/recommendations/evaluator");
      const evalResult = await evaluateExpiredRecs(workspaceId);
      steps.recEvaluate = evalResult;
      resolvedCount = evalResult.evaluated;
    } catch (err) {
      steps.recEvaluate = { error: String(err) };
      hasError = true;
    }

    // Step 8: Generate new recommendations
    try {
      const { generateRecommendations } = await import("@/lib/recommendations/generator");
      steps.recGenerate = await generateRecommendations(workspaceId);
    } catch (err) {
      steps.recGenerate = { error: String(err) };
      hasError = true;
    }

    // Step 8.5: Refine backtest params (if any recs were resolved)
    if (resolvedCount > 0) {
      try {
        const { refineParams } = await import("@/lib/backtest/refiner");
        steps.backtestRefine = await refineParams(workspaceId);
      } catch (err) {
        steps.backtestRefine = { error: String(err) };
        hasError = true;
      }
    }

    // Step 9: Check thesis deadlines
    try {
      const { checkThesisDeadlines } = await import("@/lib/analysis/thesis-lifecycle");
      steps.thesisDeadlines = await checkThesisDeadlines(workspaceId);
    } catch (err) {
      steps.thesisDeadlines = { error: String(err) };
      hasError = true;
    }

    // Record pipeline run completion
    await completePipelineRun(run.id, hasError ? "failed" : "completed", steps);

    results.push({ workspaceId, runId: run.id, pipeline: steps });
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    workspacesProcessed: allWorkspaces.length,
    results,
  });
}
