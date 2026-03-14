import { db } from "@/lib/db";
import { theses, connections } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import {
  computeThesisProbabilityAtTime,
  type ProbabilityParams,
} from "@/lib/db/probability";

export interface SweepConfig {
  decayRates?: number[];
  modelWeights?: number[];
  crossThesisCaps?: number[];
  neutralFactors?: number[];
  intervalHours?: number;
}

export const DEFAULT_SWEEP: Required<SweepConfig> = {
  decayRates: [0.01, 0.02, 0.03, 0.05, 0.1],
  modelWeights: [0.5, 0.6, 0.7, 0.8, 0.9],
  crossThesisCaps: [0, 0.05, 0.1, 0.15],
  neutralFactors: [0.1, 0.25, 0.4, 0.5],
  intervalHours: 24,
};

export interface SweepResult {
  params: ProbabilityParams;
  aggregateBrier: number;
  thesisCount: number;
  perThesis: Array<{
    thesisId: number;
    title: string;
    brierScore: number;
    finalProbability: number;
    outcome: number;
  }>;
}

/**
 * Run a parameter sweep: cartesian product of all parameter ranges.
 * Pre-loads all data once and computes everything in-memory.
 * Returns results sorted by Brier score (best first).
 */
export async function runSweep(config: SweepConfig = {}): Promise<SweepResult[]> {
  const {
    decayRates = DEFAULT_SWEEP.decayRates,
    modelWeights = DEFAULT_SWEEP.modelWeights,
    crossThesisCaps = DEFAULT_SWEEP.crossThesisCaps,
    neutralFactors = DEFAULT_SWEEP.neutralFactors,
    intervalHours = DEFAULT_SWEEP.intervalHours,
  } = config;

  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Pre-load all data once
  const resolvedTheses = await db
    .select()
    .from(theses)
    .where(sql`${theses.status} LIKE 'resolved_%'`);

  if (resolvedTheses.length === 0) {
    return [];
  }

  const allConnections = await db.select().from(connections);

  // Pre-compute time ranges for each thesis
  const thesisRanges = resolvedTheses
    .filter((t) => t.resolvedAt)
    .map((t) => ({
      thesis: t,
      outcome: t.status === "resolved_correct" ? 1 : 0,
      startTime: new Date(t.createdAt).getTime(),
      endTime: new Date(t.resolvedAt!).getTime(),
    }));

  // Generate cartesian product
  const combinations: ProbabilityParams[] = [];
  for (const decayRate of decayRates) {
    for (const modelWeight of modelWeights) {
      for (const crossThesisCap of crossThesisCaps) {
        for (const neutralFactor of neutralFactors) {
          combinations.push({
            decayRate,
            modelWeight,
            marketWeight: 1 - modelWeight,
            crossThesisCap,
            neutralFactor,
          });
        }
      }
    }
  }

  const results: SweepResult[] = [];

  for (const params of combinations) {
    const perThesis: SweepResult["perThesis"] = [];

    for (const { thesis, outcome, startTime, endTime } of thesisRanges) {
      // Compute final probability at resolution time
      let finalProbability = 0.5;

      // Walk through time to get final probability
      for (let t = startTime; t <= endTime; t += intervalMs) {
        const computed = await computeThesisProbabilityAtTime(
          thesis.id,
          new Date(t),
          params,
          {
            allConnections,
            skipCrossThesis: true,
            skipMarketBlend: true,
          },
        );
        finalProbability = computed.probability;
      }

      const brierScore = Math.pow(finalProbability - outcome, 2);

      perThesis.push({
        thesisId: thesis.id,
        title: thesis.title,
        brierScore,
        finalProbability,
        outcome,
      });
    }

    const aggregateBrier = perThesis.length > 0
      ? perThesis.reduce((s, r) => s + r.brierScore, 0) / perThesis.length
      : 0;

    results.push({ params, aggregateBrier, thesisCount: perThesis.length, perThesis });
  }

  // Sort by Brier score (lower is better)
  results.sort((a, b) => a.aggregateBrier - b.aggregateBrier);

  return results;
}
