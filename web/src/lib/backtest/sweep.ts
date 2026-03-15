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
  holdoutFraction?: number;
}

export const DEFAULT_SWEEP: Required<SweepConfig> = {
  decayRates: [0.01, 0.02, 0.03, 0.05, 0.1],
  modelWeights: [0.5, 0.6, 0.7, 0.8, 0.9],
  crossThesisCaps: [0, 0.05, 0.1, 0.15],
  neutralFactors: [0.1, 0.25, 0.4, 0.5],
  intervalHours: 24,
  holdoutFraction: 0.2,
};

export interface SweepResult {
  params: ProbabilityParams;
  aggregateBrier: number;
  thesisCount: number;
  testBrier?: number;
  overfitWarning?: boolean;
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
export async function runSweep(workspaceId: string, config: SweepConfig = {}): Promise<SweepResult[]> {
  const {
    decayRates = DEFAULT_SWEEP.decayRates,
    modelWeights = DEFAULT_SWEEP.modelWeights,
    crossThesisCaps = DEFAULT_SWEEP.crossThesisCaps,
    neutralFactors = DEFAULT_SWEEP.neutralFactors,
    intervalHours = DEFAULT_SWEEP.intervalHours,
    holdoutFraction = 0.2,
  } = config;

  const intervalMs = intervalHours * 60 * 60 * 1000;

  // Pre-load all data once
  const resolvedTheses = await db
    .select()
    .from(theses)
    .where(sql`${theses.workspaceId} = ${workspaceId} AND ${theses.status} LIKE 'resolved_%'`);

  if (resolvedTheses.length === 0) {
    return [];
  }

  const allConnections = await db.select().from(connections).where(sql`${connections.workspaceId} = ${workspaceId}`);

  // Pre-compute time ranges for each thesis
  const allThesisRanges = resolvedTheses
    .filter((t) => t.resolvedAt)
    .map((t) => ({
      thesis: t,
      outcome: t.status === "resolved_correct" ? 1 : 0,
      startTime: new Date(t.createdAt).getTime(),
      endTime: new Date(t.resolvedAt!).getTime(),
    }));

  // Deterministic train/test split: id % 5 === 0 → test set
  const trainRanges = allThesisRanges.filter((r) => r.thesis.id % 5 !== 0);
  const testRanges = allThesisRanges.filter((r) => r.thesis.id % 5 === 0);

  // Helper to compute per-thesis Brier scores for a given param set and thesis list
  async function computePerThesis(
    params: ProbabilityParams,
    ranges: typeof allThesisRanges,
  ): Promise<SweepResult["perThesis"]> {
    const perThesis: SweepResult["perThesis"] = [];
    for (const { thesis, outcome, startTime, endTime } of ranges) {
      let finalProbability = 0.5;
      for (let t = startTime; t <= endTime; t += intervalMs) {
        const computed = await computeThesisProbabilityAtTime(
          workspaceId,
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
    return perThesis;
  }

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

  // Sweep on train set only
  for (const params of combinations) {
    const perThesis = await computePerThesis(params, trainRanges);

    const aggregateBrier = perThesis.length > 0
      ? perThesis.reduce((s, r) => s + r.brierScore, 0) / perThesis.length
      : 0;

    results.push({ params, aggregateBrier, thesisCount: perThesis.length, perThesis });
  }

  // Sort by Brier score (lower is better)
  results.sort((a, b) => a.aggregateBrier - b.aggregateBrier);

  // Evaluate best params on test set
  if (results.length > 0 && testRanges.length > 0) {
    const best = results[0];
    const testPerThesis = await computePerThesis(best.params, testRanges);
    const testBrier = testPerThesis.reduce((s, r) => s + r.brierScore, 0) / testPerThesis.length;
    best.testBrier = testBrier;
    best.overfitWarning = testBrier > best.aggregateBrier * 1.2;
  }

  return results;
}
