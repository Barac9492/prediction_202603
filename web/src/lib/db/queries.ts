import { db } from "./index";
import { predictions, signals, sources } from "./schema";
import { eq, desc, isNotNull, sql } from "drizzle-orm";
import type { Prediction, Signal, SourceData, ExtractionResult } from "../core/types";

export async function savePrediction(
  topic: string,
  prediction: Prediction,
  allSignals: Signal[],
  sourceResults: { source: SourceData; result: ExtractionResult }[]
): Promise<number> {
  const [pred] = await db
    .insert(predictions)
    .values({
      topic,
      direction: prediction.direction,
      confidence: prediction.confidence,
      weightedScore: prediction.weightedScore,
      topReasons: prediction.topReasons,
      signalCount: prediction.signalCount,
      bullishCount: prediction.bullishCount,
      bearishCount: prediction.bearishCount,
      neutralCount: prediction.neutralCount,
      contradictions: prediction.contradictions.map((c) => c.description),
    })
    .returning({ id: predictions.id });

  const predId = pred.id;

  if (allSignals.length) {
    await db.insert(signals).values(
      allSignals.map((s) => ({
        predictionId: predId,
        description: s.description,
        direction: s.direction,
        strength: s.strength,
        reasoning: s.reasoning,
        sourceTitle: s.sourceTitle,
      }))
    );
  }

  if (sourceResults.length) {
    await db.insert(sources).values(
      sourceResults.map(({ source, result }) => ({
        predictionId: predId,
        title: source.title,
        url: source.url || null,
        summary: result.sourceSummary,
        relevanceScore: result.relevanceScore,
        collectedAt: new Date(source.collectedAt),
      }))
    );
  }

  return predId;
}

export async function resolvePrediction(
  predictionId: number,
  actualOutcome: string,
  notes = ""
) {
  await db
    .update(predictions)
    .set({
      actualOutcome,
      outcomeNotes: notes,
      resolvedAt: new Date(),
    })
    .where(eq(predictions.id, predictionId));
}

export async function listPredictions(
  filter: "all" | "pending" | "resolved" = "all",
  limit = 50
) {
  let query = db.select().from(predictions);

  if (filter === "resolved") {
    query = query.where(isNotNull(predictions.actualOutcome)) as typeof query;
  } else if (filter === "pending") {
    query = query.where(sql`${predictions.actualOutcome} IS NULL`) as typeof query;
  }

  return query.orderBy(desc(predictions.createdAt)).limit(limit);
}

export async function getPredictionDetail(predictionId: number) {
  const [pred] = await db
    .select()
    .from(predictions)
    .where(eq(predictions.id, predictionId));
  if (!pred) return null;

  const sigs = await db
    .select()
    .from(signals)
    .where(eq(signals.predictionId, predictionId));

  const srcs = await db
    .select()
    .from(sources)
    .where(eq(sources.predictionId, predictionId));

  return { prediction: pred, signals: sigs, sources: srcs };
}

export async function getCalibrationStats() {
  const resolved = await db
    .select({
      direction: predictions.direction,
      confidence: predictions.confidence,
      actualOutcome: predictions.actualOutcome,
    })
    .from(predictions)
    .where(isNotNull(predictions.actualOutcome));

  if (!resolved.length) {
    return { total: 0, correct: 0, accuracy: 0, byConfidence: {} };
  }

  const correct = resolved.filter(
    (r) => r.direction === r.actualOutcome
  ).length;
  const total = resolved.length;

  const buckets: Record<string, { correct: number; total: number }> = {
    "0-25": { correct: 0, total: 0 },
    "25-50": { correct: 0, total: 0 },
    "50-75": { correct: 0, total: 0 },
    "75-100": { correct: 0, total: 0 },
  };

  for (const r of resolved) {
    const conf = r.confidence;
    const key =
      conf < 25 ? "0-25" : conf < 50 ? "25-50" : conf < 75 ? "50-75" : "75-100";
    buckets[key].total++;
    if (r.direction === r.actualOutcome) {
      buckets[key].correct++;
    }
  }

  const byConfidence = Object.fromEntries(
    Object.entries(buckets).map(([k, v]) => [
      k,
      {
        ...v,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
      },
    ])
  );

  return {
    total,
    correct,
    accuracy: Math.round((correct / total) * 1000) / 10,
    byConfidence,
  };
}
