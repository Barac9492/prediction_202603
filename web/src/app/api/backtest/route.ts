import { NextRequest, NextResponse } from "next/server";
import { runAndStoreBacktest } from "@/lib/backtest/engine";
import { listBacktestRuns } from "@/lib/db/graph-queries";
import { DEFAULT_PARAMS, type ProbabilityParams } from "@/lib/db/probability";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/backtest - Run a single backtest with given parameters */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const params: ProbabilityParams = {
      decayRate: body.decayRate ?? DEFAULT_PARAMS.decayRate,
      modelWeight: body.modelWeight ?? DEFAULT_PARAMS.modelWeight,
      marketWeight: body.marketWeight ?? DEFAULT_PARAMS.marketWeight,
      crossThesisCap: body.crossThesisCap ?? DEFAULT_PARAMS.crossThesisCap,
      neutralFactor: body.neutralFactor ?? DEFAULT_PARAMS.neutralFactor,
    };

    const { runId, result } = await runAndStoreBacktest({
      name: body.name,
      params,
      intervalHours: body.intervalHours,
    });

    return NextResponse.json({
      runId,
      aggregateBrier: result.aggregateBrier,
      thesisCount: result.thesisResults.length,
      calibrationBuckets: result.calibrationBuckets,
      thesisResults: result.thesisResults.map((r) => ({
        thesisId: r.thesisId,
        title: r.title,
        brierScore: r.brierScore,
        finalProbability: r.finalProbability,
        outcome: r.outcome,
        snapshotCount: r.snapshotCount,
      })),
    });
  } catch (err) {
    console.error("Backtest failed:", err);
    return NextResponse.json({ error: "Backtest failed" }, { status: 500 });
  }
}

/** GET /api/backtest - List past backtest runs */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const thesisId = url.searchParams.get("thesisId");

  const runs = await listBacktestRuns(
    thesisId ? parseInt(thesisId, 10) : undefined
  );

  return NextResponse.json({ runs });
}
