import { db } from "@/lib/db";
import { backtestRuns } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { runSweep } from "./sweep";
import { DEFAULT_PARAMS, type ProbabilityParams } from "@/lib/db/probability";

const IMPROVEMENT_THRESHOLD = 0.05; // 5% improvement required

/**
 * Get the currently active probability params.
 * Reads from the latest successful refinement in backtestRuns,
 * falling back to DEFAULT_PARAMS.
 */
export async function getActiveParams(): Promise<ProbabilityParams> {
  const [latest] = await db
    .select()
    .from(backtestRuns)
    .where(sql`${backtestRuns.name} = 'refinement' AND ${backtestRuns.status} = 'completed'`)
    .orderBy(desc(backtestRuns.completedAt))
    .limit(1);

  if (!latest?.parameters) {
    return DEFAULT_PARAMS;
  }

  const p = latest.parameters as Record<string, unknown>;
  return {
    decayRate: (p.decayRate as number) ?? DEFAULT_PARAMS.decayRate,
    modelWeight: (p.modelWeight as number) ?? DEFAULT_PARAMS.modelWeight,
    marketWeight: (p.marketWeight as number) ?? DEFAULT_PARAMS.marketWeight,
    crossThesisCap: (p.crossThesisCap as number) ?? DEFAULT_PARAMS.crossThesisCap,
    neutralFactor: (p.neutralFactor as number) ?? DEFAULT_PARAMS.neutralFactor,
  };
}

/**
 * Run a parameter sweep and apply the best params if they beat the current ones
 * by more than the improvement threshold.
 */
export async function refineParams(): Promise<{
  improved: boolean;
  currentBrier: number | null;
  bestBrier: number | null;
  bestParams: ProbabilityParams | null;
  message: string;
}> {
  const sweepResults = await runSweep();

  if (sweepResults.length === 0) {
    return {
      improved: false,
      currentBrier: null,
      bestBrier: null,
      bestParams: null,
      message: "No resolved theses to sweep against",
    };
  }

  const best = sweepResults[0];
  const currentParams = await getActiveParams();

  // Find current params' score in the sweep (or re-run with current)
  const currentResult = sweepResults.find(
    (r) =>
      r.params.decayRate === currentParams.decayRate &&
      r.params.modelWeight === currentParams.modelWeight &&
      r.params.crossThesisCap === currentParams.crossThesisCap &&
      r.params.neutralFactor === currentParams.neutralFactor
  );

  const currentBrier = currentResult?.aggregateBrier ?? best.aggregateBrier;
  const improvement =
    currentBrier > 0
      ? (currentBrier - best.aggregateBrier) / currentBrier
      : 0;

  if (improvement > IMPROVEMENT_THRESHOLD) {
    // Persist winning params
    await db.insert(backtestRuns).values({
      name: "refinement",
      startDate: new Date(),
      endDate: new Date(),
      parameters: best.params as unknown as Record<string, unknown>,
      results: {
        aggregateBrier: best.aggregateBrier,
        thesisCount: best.thesisCount,
        improvement: improvement,
        previousBrier: currentBrier,
        testBrier: best.testBrier ?? null,
        overfitWarning: best.overfitWarning ?? false,
      },
      accuracy: 1 - best.aggregateBrier,
      totalSignals: best.thesisCount,
      status: "completed",
      completedAt: new Date(),
    });

    return {
      improved: true,
      currentBrier,
      bestBrier: best.aggregateBrier,
      bestParams: best.params,
      message: `Improved by ${(improvement * 100).toFixed(1)}%: Brier ${currentBrier.toFixed(4)} → ${best.aggregateBrier.toFixed(4)}`,
    };
  }

  return {
    improved: false,
    currentBrier,
    bestBrier: best.aggregateBrier,
    bestParams: best.params,
    message: `Best improvement ${(improvement * 100).toFixed(1)}% below ${(IMPROVEMENT_THRESHOLD * 100).toFixed(0)}% threshold`,
  };
}
