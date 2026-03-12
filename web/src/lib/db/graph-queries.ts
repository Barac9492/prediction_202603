import { db } from "./index";
import {
  entities,
  theses,
  newsEvents,
  connections,
  backtestRuns,
} from "./schema";
import { eq, desc, and, sql } from "drizzle-orm";

// ── Entity queries ────────────────────────────────────────────────────────

export async function upsertEntity(data: {
  name: string;
  type: string;
  description?: string;
  aliases?: string[];
}) {
  const existing = await db
    .select()
    .from(entities)
    .where(eq(entities.name, data.name))
    .limit(1);
  if (existing.length > 0) {
    const [updated] = await db
      .update(entities)
      .set({ updatedAt: new Date(), ...data })
      .where(eq(entities.name, data.name))
      .returning();
    return updated;
  }
  const [created] = await db.insert(entities).values(data).returning();
  return created;
}

export async function listEntities(type?: string) {
  if (type) {
    return db.select().from(entities).where(eq(entities.type, type)).orderBy(entities.name);
  }
  return db.select().from(entities).orderBy(entities.name);
}

export async function getEntity(id: number) {
  const [entity] = await db.select().from(entities).where(eq(entities.id, id));
  return entity ?? null;
}

// ── Thesis queries ────────────────────────────────────────────────────────

export async function createThesis(data: {
  title: string;
  description: string;
  direction: string;
  domain?: string;
  tags?: string[];
}) {
  const [thesis] = await db.insert(theses).values(data).returning();
  return thesis;
}

export async function listTheses(activeOnly = false) {
  if (activeOnly) {
    return db.select().from(theses).where(eq(theses.isActive, true)).orderBy(desc(theses.createdAt));
  }
  return db.select().from(theses).orderBy(desc(theses.createdAt));
}

export async function getThesis(id: number) {
  const [thesis] = await db.select().from(theses).where(eq(theses.id, id));
  return thesis ?? null;
}

export async function updateThesis(
  id: number,
  data: Partial<{ title: string; description: string; direction: string; isActive: boolean }>
) {
  const [updated] = await db
    .update(theses)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(theses.id, id))
    .returning();
  return updated;
}

// ── News event queries ────────────────────────────────────────────────────

export async function insertNewsEvent(data: {
  title: string;
  url?: string;
  source?: string;
  content?: string;
  summary?: string;
  publishedAt?: Date;
}) {
  if (data.url) {
    const existing = await db
      .select({ id: newsEvents.id })
      .from(newsEvents)
      .where(eq(newsEvents.url, data.url))
      .limit(1);
    if (existing.length > 0) return null;
  }
  const [event] = await db.insert(newsEvents).values(data).returning();
  return event;
}

export async function listNewsEvents({
  limit = 50,
  unprocessedOnly = false,
  aiRelevanceMin,
}: { limit?: number; unprocessedOnly?: boolean; aiRelevanceMin?: number } = {}) {
  if (unprocessedOnly && aiRelevanceMin !== undefined) {
    return db.select().from(newsEvents)
      .where(and(eq(newsEvents.processed, false), sql`${newsEvents.aiRelevance} > ${aiRelevanceMin - 1}`))
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  if (unprocessedOnly) {
    return db.select().from(newsEvents).where(eq(newsEvents.processed, false))
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  if (aiRelevanceMin !== undefined) {
    return db.select().from(newsEvents)
      .where(sql`${newsEvents.aiRelevance} > ${aiRelevanceMin - 1}`)
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  return db.select().from(newsEvents).orderBy(desc(newsEvents.ingestedAt)).limit(limit);
}

export async function markNewsProcessed(
  id: number,
  data: { aiRelevance?: number; sentiment?: string; extractedEntities?: string[]; extractedThesisIds?: number[] }
) {
  await db.update(newsEvents).set({ processed: true, ...data }).where(eq(newsEvents.id, id));
}

export async function getNewsEvent(id: number) {
  const [event] = await db.select().from(newsEvents).where(eq(newsEvents.id, id));
  return event ?? null;
}

// ── Connection queries ────────────────────────────────────────────────────

export async function createConnection(data: {
  fromType: string; fromId: number; toType: string; toId: number;
  relation: string; direction?: string; confidence?: number; weight?: number;
  reasoning?: string; sourceNewsId?: number;
}) {
  const [conn] = await db.insert(connections).values(data).returning();
  return conn;
}

export async function getConnectionsFrom(fromType: string, fromId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.fromType, fromType), eq(connections.fromId, fromId)))
    .orderBy(desc(connections.weight));
}

export async function getConnectionsTo(toType: string, toId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.toType, toType), eq(connections.toId, toId)))
    .orderBy(desc(connections.weight));
}

export async function getThesisConnections(thesisId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.toType, "thesis"), eq(connections.toId, thesisId)))
    .orderBy(desc(connections.createdAt));
}

export async function getGraphData(opts?: { thesisIds?: number[]; since?: Date; limit?: number }) {
  const baseSelect = {
    id: newsEvents.id, title: newsEvents.title, url: newsEvents.url,
    source: newsEvents.source, sentiment: newsEvents.sentiment,
    aiRelevance: newsEvents.aiRelevance, publishedAt: newsEvents.publishedAt,
    ingestedAt: newsEvents.ingestedAt,
  };
  const newsNodes = await (opts?.since
    ? db.select(baseSelect).from(newsEvents)
        .where(and(eq(newsEvents.processed, true), sql`${newsEvents.ingestedAt} > ${opts.since}`))
        .orderBy(desc(newsEvents.ingestedAt)).limit(opts?.limit ?? 200)
    : db.select(baseSelect).from(newsEvents)
        .where(eq(newsEvents.processed, true))
        .orderBy(desc(newsEvents.ingestedAt)).limit(opts?.limit ?? 200));
  const entityNodes = await db.select().from(entities);
  const thesisNodes = await db.select().from(theses).where(eq(theses.isActive, true));
  const edges = await db.select().from(connections).orderBy(desc(connections.weight)).limit(500);
  return { newsNodes, entityNodes, thesisNodes, edges };
}

// ── Backtest queries ──────────────────────────────────────────────────────

export async function createBacktestRun(data: {
  name: string; thesisId?: number; startDate: Date; endDate: Date; parameters?: Record<string, unknown>;
}) {
  const [run] = await db.insert(backtestRuns).values(data).returning();
  return run;
}

export async function updateBacktestRun(
  id: number,
  data: Partial<{ results: Record<string, unknown>; accuracy: number; totalSignals: number; correctSignals: number; status: string; completedAt: Date }>
) {
  const [updated] = await db.update(backtestRuns).set(data).where(eq(backtestRuns.id, id)).returning();
  return updated;
}

export async function listBacktestRuns(thesisId?: number) {
  if (thesisId !== undefined) {
    return db.select().from(backtestRuns).where(eq(backtestRuns.thesisId, thesisId)).orderBy(desc(backtestRuns.createdAt));
  }
  return db.select().from(backtestRuns).orderBy(desc(backtestRuns.createdAt));
}

export async function reinforceConnection(connectionId: number, wasCorrect: boolean) {
  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!conn) return;
  const currentWeight = conn.adjustedWeight ?? conn.weight;
  const delta = wasCorrect ? 0.1 : -0.05;
  const newWeight = Math.max(0.1, Math.min(2.0, currentWeight + delta));
  await db.update(connections).set({ adjustedWeight: newWeight }).where(eq(connections.id, connectionId));
}
