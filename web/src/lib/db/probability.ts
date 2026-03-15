import { db } from "./index";
import { theses, connections, newsEvents, thesisProbabilitySnapshots } from "./schema";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import { getThesisInteractions, getMarketSignals } from "./graph-queries";
import { computeSourceCredibility, getCredibilityForSource } from "./source-credibility";

export interface ProbabilityParams {
  decayRate: number;       // exponential decay per day (default 0.03)
  modelWeight: number;     // weight for model probability (default 0.7)
  marketWeight: number;    // weight for market signal (default 0.3)
  crossThesisCap: number;  // max ±adjustment from cross-thesis (default 0.1)
  neutralFactor: number;   // how much neutral signals contribute to bullish side (default 0.25)
}

export const DEFAULT_PARAMS: ProbabilityParams = {
  decayRate: 0.03,
  modelWeight: 0.7,
  marketWeight: 0.3,
  crossThesisCap: 0.1,
  neutralFactor: 0.25,
};

export interface ProbabilityResult {
  probability: number;
  bullishWeight: number;
  bearishWeight: number;
  neutralWeight: number;
  signalCount: number;
  topNewsIds: number[];
}

/**
 * Compute thesis probability at a specific point in time with configurable parameters.
 * If `allConnections` is provided, filters in-memory instead of querying DB.
 * If `skipCrossThesis` is true, skips cross-thesis influence lookup.
 */
export async function computeThesisProbabilityAtTime(
  workspaceId: string,
  thesisId: number,
  asOfDate: Date,
  params: ProbabilityParams = DEFAULT_PARAMS,
  options?: {
    allConnections?: typeof connections.$inferSelect[];
    skipCrossThesis?: boolean;
    skipMarketBlend?: boolean;
    credibilityMap?: Map<string, number>;
    newsSourceMap?: Map<number, string>;
  },
): Promise<ProbabilityResult> {
  const asOf = asOfDate.getTime();

  // Get connections: either filter from pre-loaded set or query DB
  let conns: typeof connections.$inferSelect[];
  if (options?.allConnections) {
    conns = options.allConnections.filter(
      (c) => c.toType === "thesis" && c.toId === thesisId && new Date(c.createdAt).getTime() <= asOf
    );
  } else {
    conns = await db
      .select()
      .from(connections)
      .where(and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.toType, "thesis"),
        eq(connections.toId, thesisId),
        lte(connections.createdAt, asOfDate),
      ));
  }

  if (conns.length === 0) {
    return { probability: 0.5, bullishWeight: 0, bearishWeight: 0, neutralWeight: 0, signalCount: 0, topNewsIds: [] };
  }

  // Build credibility and news-source maps if not provided
  let credMap: Map<string, number>;
  let newsSourceMap: Map<number, string>;
  if (options?.credibilityMap && options?.newsSourceMap) {
    credMap = options.credibilityMap;
    newsSourceMap = options.newsSourceMap;
  } else {
    credMap = await computeSourceCredibility(workspaceId);
    const sourceNewsIds = conns.map((c) => c.sourceNewsId).filter((id): id is number => id !== null);
    if (sourceNewsIds.length > 0) {
      const newsRows = await db
        .select({ id: newsEvents.id, source: newsEvents.source })
        .from(newsEvents)
        .where(eq(newsEvents.workspaceId, workspaceId));
      newsSourceMap = new Map(newsRows.map((r) => [r.id, r.source ?? ""]));
    } else {
      newsSourceMap = new Map();
    }
  }

  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  const newsIdSet = new Set<number>();

  for (const conn of conns) {
    const sourceNewsId = conn.sourceNewsId;
    const source = sourceNewsId ? (newsSourceMap.get(sourceNewsId) ?? null) : null;
    const credibility = getCredibilityForSource(credMap, source);
    const rawWeight = (conn.adjustedWeight ?? conn.weight) * conn.confidence * credibility;
    const ageMs = asOf - new Date(conn.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-ageDays * params.decayRate);
    const score = rawWeight * decayFactor;

    if (conn.direction === "bullish") {
      bullish += score;
    } else if (conn.direction === "bearish") {
      bearish += score;
    } else {
      neutral += score;
    }

    if (conn.sourceNewsId) newsIdSet.add(conn.sourceNewsId);
  }

  // Bayesian log-odds updating: net directional evidence drives probability via sigmoid.
  // Scale factor (0.15) accounts for signal correlation — news-derived signals aren't independent.
  const EVIDENCE_SCALE = 0.15;
  const netEvidence = (bullish - bearish + neutral * params.neutralFactor) * EVIDENCE_SCALE;
  let probability = 1 / (1 + Math.exp(-netEvidence));
  probability = Math.max(0.05, Math.min(0.95, probability));

  // Cross-thesis influence
  if (!options?.skipCrossThesis) {
    const interactions = await getThesisInteractions(workspaceId, thesisId);
    if (interactions.length > 0) {
      let crossAdjustment = 0;
      for (const inter of interactions) {
        const linkedThesisId = inter.fromId === thesisId ? inter.toId : inter.fromId;
        const [linkedSnapshot] = await db
          .select({ probability: thesisProbabilitySnapshots.probability })
          .from(thesisProbabilitySnapshots)
          .where(and(
            eq(thesisProbabilitySnapshots.thesisId, linkedThesisId),
            lte(thesisProbabilitySnapshots.computedAt, asOfDate),
          ))
          .orderBy(desc(thesisProbabilitySnapshots.computedAt))
          .limit(1);

        if (!linkedSnapshot) continue;
        const linkedProb = linkedSnapshot.probability;
        const influence = inter.confidence * params.crossThesisCap;

        if (inter.relation === "REINFORCES") {
          crossAdjustment += influence * (linkedProb - 0.5);
        } else if (inter.relation === "CONTRADICTS") {
          crossAdjustment -= influence * (linkedProb - 0.5);
        }
      }
      crossAdjustment = Math.max(-params.crossThesisCap, Math.min(params.crossThesisCap, crossAdjustment));
      probability = Math.max(0.05, Math.min(0.95, probability + crossAdjustment));
    }
  }

  // Market signal blending
  if (!options?.skipMarketBlend) {
    const marketSignals = await getMarketSignals(workspaceId, thesisId);
    if (marketSignals.length > 0) {
      const marketAvg =
        marketSignals.reduce((sum, ms) => sum + ms.confidence, 0) / marketSignals.length;
      probability = params.modelWeight * probability + params.marketWeight * marketAvg;
      probability = Math.max(0.05, Math.min(0.95, probability));
    }
  }

  return {
    probability,
    bullishWeight: bullish,
    bearishWeight: bearish,
    neutralWeight: neutral,
    signalCount: conns.length,
    topNewsIds: [...newsIdSet].slice(0, 10),
  };
}

/** Convenience wrapper: compute probability at current time with active params */
export async function computeThesisProbability(workspaceId: string, thesisId: number): Promise<ProbabilityResult> {
  // Lazy import to avoid circular dependency
  const { getActiveParams } = await import("@/lib/backtest/refiner");
  const params = await getActiveParams(workspaceId);
  return computeThesisProbabilityAtTime(workspaceId, thesisId, new Date(), params);
}

export async function snapshotAllProbabilities(workspaceId: string): Promise<Array<{
  thesisId: number;
  title: string;
  probability: number;
  momentum: number | null;
}>> {
  const activeTheses = await db
    .select()
    .from(theses)
    .where(and(eq(theses.isActive, true), eq(theses.workspaceId, workspaceId)));

  // Pre-compute credibility and news-source maps for all theses
  const { getActiveParams } = await import("@/lib/backtest/refiner");
  const params = await getActiveParams(workspaceId);
  const credibilityMap = await computeSourceCredibility(workspaceId);
  const newsSourceRows = await db
    .select({ id: newsEvents.id, source: newsEvents.source })
    .from(newsEvents)
    .where(eq(newsEvents.workspaceId, workspaceId));
  const newsSourceMap = new Map(newsSourceRows.map((r) => [r.id, r.source ?? ""]));

  const results = [];

  for (const thesis of activeTheses) {
    const computed = await computeThesisProbabilityAtTime(workspaceId, thesis.id, new Date(), params, {
      credibilityMap,
      newsSourceMap,
    });

    const [prevSnapshot] = await db
      .select()
      .from(thesisProbabilitySnapshots)
      .where(and(
        eq(thesisProbabilitySnapshots.thesisId, thesis.id),
        eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
      ))
      .orderBy(desc(thesisProbabilitySnapshots.computedAt))
      .limit(1);

    const momentum = prevSnapshot
      ? computed.probability - prevSnapshot.probability
      : null;

    await db.insert(thesisProbabilitySnapshots).values({
      thesisId: thesis.id,
      workspaceId,
      probability: computed.probability,
      bullishWeight: computed.bullishWeight,
      bearishWeight: computed.bearishWeight,
      neutralWeight: computed.neutralWeight,
      signalCount: computed.signalCount,
      momentum: momentum ?? undefined,
      topNewsIds: computed.topNewsIds,
    });

    results.push({
      thesisId: thesis.id,
      title: thesis.title,
      probability: computed.probability,
      momentum,
    });
  }

  return results;
}

export async function getProbabilityHistory(
  workspaceId: string,
  thesisId: number,
  limit = 90
): Promise<Array<{
  probability: number;
  bullishWeight: number;
  bearishWeight: number;
  neutralWeight: number;
  signalCount: number;
  momentum: number | null;
  computedAt: Date;
}>> {
  const rows = await db
    .select()
    .from(thesisProbabilitySnapshots)
    .where(and(
      eq(thesisProbabilitySnapshots.thesisId, thesisId),
      eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
    ))
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(limit);

  return rows.reverse();
}

export async function getCurrentProbabilities(workspaceId: string): Promise<Array<{
  thesisId: number;
  title: string;
  direction: string;
  domain: string;
  tags: string[];
  probability: number;
  momentum: number | null;
  signalCount: number;
  computedAt: Date | null;
}>> {
  const activeTheses = await db
    .select()
    .from(theses)
    .where(and(eq(theses.isActive, true), eq(theses.workspaceId, workspaceId)))
    .orderBy(desc(theses.createdAt));

  const out = [];
  for (const t of activeTheses) {
    const [latest] = await db
      .select()
      .from(thesisProbabilitySnapshots)
      .where(and(
        eq(thesisProbabilitySnapshots.thesisId, t.id),
        eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
      ))
      .orderBy(desc(thesisProbabilitySnapshots.computedAt))
      .limit(1);

    out.push({
      thesisId: t.id,
      title: t.title,
      direction: t.direction,
      domain: t.domain,
      tags: (t.tags as string[]) ?? [],
      probability: latest?.probability ?? 0.5,
      momentum: latest?.momentum ?? null,
      signalCount: latest?.signalCount ?? 0,
      computedAt: latest?.computedAt ?? null,
    });
  }
  return out;
}

export async function getBatchProbabilityHistory(
  workspaceId: string,
  thesisIds: number[],
  limit = 30
): Promise<Record<number, Array<{ probability: number; computedAt: Date }>>> {
  if (thesisIds.length === 0) return {};

  const rows = await db
    .select({
      thesisId: thesisProbabilitySnapshots.thesisId,
      probability: thesisProbabilitySnapshots.probability,
      computedAt: thesisProbabilitySnapshots.computedAt,
    })
    .from(thesisProbabilitySnapshots)
    .where(
      and(
        eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
        sql`${thesisProbabilitySnapshots.thesisId} IN (${sql.join(
          thesisIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
      )
    )
    .orderBy(desc(thesisProbabilitySnapshots.computedAt));

  // Group by thesisId, take latest `limit` per thesis, reverse to chronological
  const grouped: Record<number, Array<{ probability: number; computedAt: Date }>> = {};
  const counts: Record<number, number> = {};
  for (const row of rows) {
    counts[row.thesisId] = (counts[row.thesisId] ?? 0) + 1;
    if (counts[row.thesisId] > limit) continue;
    if (!grouped[row.thesisId]) grouped[row.thesisId] = [];
    grouped[row.thesisId].push({
      probability: row.probability,
      computedAt: row.computedAt,
    });
  }
  // Reverse each array to chronological order
  for (const id of Object.keys(grouped)) {
    grouped[Number(id)].reverse();
  }
  return grouped;
}
