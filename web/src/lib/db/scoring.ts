import { db } from "./index";
import { theses, connections, newsEvents } from "./schema";
import { sql, desc, eq, and } from "drizzle-orm";
import { getCalibrationStats } from "./queries";

export async function getResolvedTheses(workspaceId: string) {
  return db
    .select()
    .from(theses)
    .where(and(eq(theses.workspaceId, workspaceId), sql`${theses.status} LIKE 'resolved_%'`))
    .orderBy(desc(theses.resolvedAt));
}

export async function getOverallBrierScore(workspaceId: string) {
  const resolved = await db
    .select({
      domain: theses.domain,
      brierScore: theses.brierScore,
    })
    .from(theses)
    .where(
      and(
        eq(theses.workspaceId, workspaceId),
        sql`${theses.status} LIKE 'resolved_%'`,
        sql`${theses.brierScore} IS NOT NULL`
      )
    );

  if (!resolved.length) {
    return { overall: null, byDomain: {}, count: 0 };
  }

  const sum = resolved.reduce((s, r) => s + (r.brierScore ?? 0), 0);
  const overall = sum / resolved.length;

  const domainMap: Record<string, { sum: number; count: number }> = {};
  for (const r of resolved) {
    const d = r.domain;
    if (!domainMap[d]) domainMap[d] = { sum: 0, count: 0 };
    domainMap[d].sum += r.brierScore ?? 0;
    domainMap[d].count++;
  }

  const byDomain = Object.fromEntries(
    Object.entries(domainMap).map(([k, v]) => [
      k,
      { avgBrier: v.sum / v.count, count: v.count },
    ])
  );

  return { overall, byDomain, count: resolved.length };
}

export async function getProbabilityCalibration(workspaceId: string) {
  const resolved = await db
    .select({
      finalProbability: theses.finalProbability,
      status: theses.status,
    })
    .from(theses)
    .where(
      and(
        eq(theses.workspaceId, workspaceId),
        sql`${theses.status} LIKE 'resolved_%'`,
        sql`${theses.finalProbability} IS NOT NULL`
      )
    );

  const buckets = [
    { label: "0-20%", min: 0, max: 0.2, correct: 0, total: 0 },
    { label: "20-40%", min: 0.2, max: 0.4, correct: 0, total: 0 },
    { label: "40-60%", min: 0.4, max: 0.6, correct: 0, total: 0 },
    { label: "60-80%", min: 0.6, max: 0.8, correct: 0, total: 0 },
    { label: "80-100%", min: 0.8, max: 1.01, correct: 0, total: 0 },
  ];

  for (const r of resolved) {
    const p = r.finalProbability!;
    const bucket = buckets.find((b) => p >= b.min && p < b.max);
    if (bucket) {
      bucket.total++;
      if (r.status === "resolved_correct") bucket.correct++;
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    predicted: (b.min + b.max) / 2,
    actual: b.total > 0 ? b.correct / b.total : 0,
    count: b.total,
  }));
}

export async function getSignalQuality(workspaceId: string) {
  // For resolved theses, join connections → newsEvents.source
  // Group by source, compute avg adjustedWeight for correct vs incorrect
  const rows = await db
    .select({
      source: newsEvents.source,
      adjustedWeight: connections.adjustedWeight,
      weight: connections.weight,
      thesisStatus: theses.status,
    })
    .from(connections)
    .innerJoin(theses, and(eq(connections.toType, sql`'thesis'`), eq(connections.toId, theses.id)))
    .innerJoin(newsEvents, eq(connections.sourceNewsId, newsEvents.id))
    .where(and(eq(connections.workspaceId, workspaceId), sql`${theses.status} LIKE 'resolved_%'`));

  const sourceMap: Record<
    string,
    { correctWeights: number[]; incorrectWeights: number[]; count: number }
  > = {};

  for (const r of rows) {
    const src = r.source ?? "Unknown";
    if (!sourceMap[src]) sourceMap[src] = { correctWeights: [], incorrectWeights: [], count: 0 };
    sourceMap[src].count++;
    const w = r.adjustedWeight ?? r.weight;
    if (r.thesisStatus === "resolved_correct") {
      sourceMap[src].correctWeights.push(w);
    } else {
      sourceMap[src].incorrectWeights.push(w);
    }
  }

  return Object.entries(sourceMap)
    .map(([source, data]) => ({
      source,
      connectionCount: data.count,
      avgWeightCorrect:
        data.correctWeights.length > 0
          ? data.correctWeights.reduce((a, b) => a + b, 0) / data.correctWeights.length
          : null,
      avgWeightIncorrect:
        data.incorrectWeights.length > 0
          ? data.incorrectWeights.reduce((a, b) => a + b, 0) / data.incorrectWeights.length
          : null,
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount);
}

export async function getTrackRecordSummary(workspaceId: string) {
  const [calibration, brier, resolved] = await Promise.all([
    getCalibrationStats(workspaceId),
    getOverallBrierScore(workspaceId),
    getResolvedTheses(workspaceId),
  ]);

  const correctTheses = resolved.filter((t) => t.status === "resolved_correct");
  const incorrectTheses = resolved.filter((t) => t.status === "resolved_incorrect");

  const avgProbCorrect =
    correctTheses.length > 0
      ? correctTheses.reduce((s, t) => s + (t.finalProbability ?? 0), 0) / correctTheses.length
      : null;
  const avgProbIncorrect =
    incorrectTheses.length > 0
      ? incorrectTheses.reduce((s, t) => s + (t.finalProbability ?? 0), 0) / incorrectTheses.length
      : null;

  return {
    system1: calibration,
    system2: {
      brierScore: brier.overall,
      resolvedCount: resolved.length,
      byDomain: brier.byDomain,
    },
    avgProbCorrect,
    avgProbIncorrect,
  };
}
