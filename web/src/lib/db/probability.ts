import { db } from "./index";
import { theses, connections, newsEvents, thesisProbabilitySnapshots } from "./schema";
import { eq, desc, and, sql } from "drizzle-orm";

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
