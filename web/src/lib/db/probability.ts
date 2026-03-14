import { db } from "./index";
import { theses, connections, newsEvents, thesisProbabilitySnapshots } from "./schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { getThesisInteractions, getMarketSignals } from "./graph-queries";

export async function computeThesisProbability(thesisId: number): Promise<{
  probability: number;
  bullishWeight: number;
  bearishWeight: number;
  neutralWeight: number;
  signalCount: number;
  topNewsIds: number[];
}> {
  const conns = await db
    .select()
    .from(connections)
    .where(and(eq(connections.toType, "thesis"), eq(connections.toId, thesisId)));

  if (conns.length === 0) {
    return { probability: 0.5, bullishWeight: 0, bearishWeight: 0, neutralWeight: 0, signalCount: 0, topNewsIds: [] };
  }

  const now = Date.now();
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  const newsIdSet = new Set<number>();

  for (const conn of conns) {
    const rawWeight = (conn.adjustedWeight ?? conn.weight) * conn.confidence;
    const ageMs = now - new Date(conn.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-ageDays * 0.03);
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

  const total = bullish + bearish + neutral * 0.5;
  let probability: number;
  if (total === 0) {
    probability = 0.5;
  } else {
    probability = (bullish + neutral * 0.25) / total;
  }
  probability = Math.max(0.05, Math.min(0.95, probability));

  // Cross-thesis influence: adjust based on thesis↔thesis connections
  const interactions = await getThesisInteractions(thesisId);
  if (interactions.length > 0) {
    let crossAdjustment = 0;
    for (const inter of interactions) {
      // Get the linked thesis's latest probability from snapshots (avoids circular dependency)
      const linkedThesisId = inter.fromId === thesisId ? inter.toId : inter.fromId;
      const [linkedSnapshot] = await db
        .select({ probability: thesisProbabilitySnapshots.probability })
        .from(thesisProbabilitySnapshots)
        .where(eq(thesisProbabilitySnapshots.thesisId, linkedThesisId))
        .orderBy(desc(thesisProbabilitySnapshots.computedAt))
        .limit(1);

      if (!linkedSnapshot) continue;
      const linkedProb = linkedSnapshot.probability;
      const influence = inter.confidence * 0.1; // Max ±10% per interaction

      if (inter.relation === "REINFORCES") {
        // High linked probability → small boost
        crossAdjustment += influence * (linkedProb - 0.5);
      } else if (inter.relation === "CONTRADICTS") {
        // High linked probability → small dampening
        crossAdjustment -= influence * (linkedProb - 0.5);
      }
    }
    // Cap total cross-thesis adjustment at ±10%
    crossAdjustment = Math.max(-0.1, Math.min(0.1, crossAdjustment));
    probability = Math.max(0.05, Math.min(0.95, probability + crossAdjustment));
  }

  // Market signal blending: weighted average with market consensus
  const marketSignals = await getMarketSignals(thesisId);
  if (marketSignals.length > 0) {
    const marketAvg =
      marketSignals.reduce((sum, ms) => sum + ms.confidence, 0) / marketSignals.length;
    // 70% model, 30% market when market data exists
    probability = 0.7 * probability + 0.3 * marketAvg;
    probability = Math.max(0.05, Math.min(0.95, probability));
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

export async function snapshotAllProbabilities(): Promise<Array<{
  thesisId: number;
  title: string;
  probability: number;
  momentum: number | null;
}>> {
  const activeTheses = await db
    .select()
    .from(theses)
    .where(eq(theses.isActive, true));

  const results = [];

  for (const thesis of activeTheses) {
    const computed = await computeThesisProbability(thesis.id);

    const [prevSnapshot] = await db
      .select()
      .from(thesisProbabilitySnapshots)
      .where(eq(thesisProbabilitySnapshots.thesisId, thesis.id))
      .orderBy(desc(thesisProbabilitySnapshots.computedAt))
      .limit(1);

    const momentum = prevSnapshot
      ? computed.probability - prevSnapshot.probability
      : null;

    await db.insert(thesisProbabilitySnapshots).values({
      thesisId: thesis.id,
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
    .where(eq(thesisProbabilitySnapshots.thesisId, thesisId))
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(limit);

  return rows.reverse();
}

export async function getCurrentProbabilities(): Promise<Array<{
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
    .where(eq(theses.isActive, true))
    .orderBy(desc(theses.createdAt));

  const out = [];
  for (const t of activeTheses) {
    const [latest] = await db
      .select()
      .from(thesisProbabilitySnapshots)
      .where(eq(thesisProbabilitySnapshots.thesisId, t.id))
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
