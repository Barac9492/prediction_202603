import { db } from "@/lib/db";
import { theses, connections, backtestRuns } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  computeThesisProbabilityAtTime,
  DEFAULT_PARAMS,
  type ProbabilityParams,
} from "@/lib/db/probability";
import { createBacktestRun, updateBacktestRun } from "@/lib/db/graph-queries";

export interface BacktestConfig {
  name?: string;
  params: ProbabilityParams;
  intervalHours?: number; // default 24
}

export interface ThesisBacktestResult {
  thesisId: number;
  title: string;
  direction: string;
  outcome: number; // 1 = correct, 0 = incorrect
  finalProbability: number;
  brierScore: number;
  snapshotCount: number;
  probabilities: Array<{ timestamp: string; probability: number }>;
}

export interface BacktestResult {
  thesisResults: ThesisBacktestResult[];
  aggregateBrier: number;
  calibrationBuckets: Array<{
    bucket: string;
    range: [number, number];
    count: number;
    avgPredicted: number;
    avgActual: number;
  }>;
}

/**
 * Run a backtest: replay probability computation for all resolved theses
 * using the given parameters.
 */
export async function runBacktest(workspaceId: string, config: BacktestConfig): Promise<BacktestResult> {
  const { params, intervalHours = 24 } = config;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Get all resolved theses
  const resolvedTheses = await db
    .select()
    .from(theses)
    .where(sql`${theses.workspaceId} = ${workspaceId} AND ${theses.status} LIKE 'resolved_%'`);

  if (resolvedTheses.length === 0) {
    return { thesisResults: [], aggregateBrier: 0, calibrationBuckets: [] };
  }

  // Pre-load all connections once
  const allConnections = await db.select().from(connections).where(sql`${connections.workspaceId} = ${workspaceId}`);

  const thesisResults: ThesisBacktestResult[] = [];

  for (const thesis of resolvedTheses) {
    if (!thesis.resolvedAt) continue;

    const outcome = thesis.status === "resolved_correct" ? 1 : 0;
    const startTime = new Date(thesis.createdAt).getTime();
    const endTime = new Date(thesis.resolvedAt).getTime();

    const probabilities: Array<{ timestamp: string; probability: number }> = [];

    for (let t = startTime; t <= endTime; t += intervalMs) {
      const asOfDate = new Date(t);
      const computed = await computeThesisProbabilityAtTime(
        workspaceId,
        thesis.id,
        asOfDate,
        params,
        {
          allConnections,
          skipCrossThesis: true,
          skipMarketBlend: true,
        },
      );
      probabilities.push({
        timestamp: asOfDate.toISOString(),
        probability: computed.probability,
      });
    }

    // Final probability is the last computed value
    const finalProbability = probabilities.length > 0
      ? probabilities[probabilities.length - 1].probability
      : 0.5;

    // Brier score: (prediction - outcome)^2
    const brierScore = Math.pow(finalProbability - outcome, 2);

    thesisResults.push({
      thesisId: thesis.id,
      title: thesis.title,
      direction: thesis.direction,
      outcome,
      finalProbability,
      brierScore,
      snapshotCount: probabilities.length,
      probabilities,
    });
  }

  // Aggregate Brier score
  const aggregateBrier = thesisResults.length > 0
    ? thesisResults.reduce((sum, r) => sum + r.brierScore, 0) / thesisResults.length
    : 0;

  // Calibration buckets
  const bucketDefs = [
    { bucket: "0-20%", range: [0, 0.2] as [number, number] },
    { bucket: "20-40%", range: [0.2, 0.4] as [number, number] },
    { bucket: "40-60%", range: [0.4, 0.6] as [number, number] },
    { bucket: "60-80%", range: [0.6, 0.8] as [number, number] },
    { bucket: "80-100%", range: [0.8, 1.0] as [number, number] },
  ];

  const calibrationBuckets = bucketDefs.map(({ bucket, range }) => {
    const inBucket = thesisResults.filter(
      (r) => r.finalProbability >= range[0] && r.finalProbability < (range[1] === 1.0 ? 1.01 : range[1])
    );
    return {
      bucket,
      range,
      count: inBucket.length,
      avgPredicted: inBucket.length > 0
        ? inBucket.reduce((s, r) => s + r.finalProbability, 0) / inBucket.length
        : 0,
      avgActual: inBucket.length > 0
        ? inBucket.reduce((s, r) => s + r.outcome, 0) / inBucket.length
        : 0,
    };
  });

  return { thesisResults, aggregateBrier, calibrationBuckets };
}

/**
 * Run a backtest and persist the results to the backtestRuns table.
 */
export async function runAndStoreBacktest(workspaceId: string, config: BacktestConfig): Promise<{
  runId: number;
  result: BacktestResult;
}> {
  const name = config.name || `Backtest ${new Date().toISOString()}`;

  const run = await createBacktestRun(workspaceId, {
    name,
    startDate: new Date(),
    endDate: new Date(),
    parameters: config.params as unknown as Record<string, unknown>,
  });

  const result = await runBacktest(workspaceId, config);

  await updateBacktestRun(workspaceId, run.id, {
    results: {
      aggregateBrier: result.aggregateBrier,
      calibrationBuckets: result.calibrationBuckets,
      thesisCount: result.thesisResults.length,
      thesisSummaries: result.thesisResults.map((r) => ({
        thesisId: r.thesisId,
        title: r.title,
        brierScore: r.brierScore,
        finalProbability: r.finalProbability,
        outcome: r.outcome,
      })),
    },
    accuracy: 1 - result.aggregateBrier, // inverse Brier as rough accuracy
    totalSignals: result.thesisResults.reduce((s, r) => s + r.snapshotCount, 0),
    status: "complete",
    completedAt: new Date(),
  });

  return { runId: run.id, result };
}
