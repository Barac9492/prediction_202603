import { db } from "./index";
import {
    entities,
    theses,
    newsEvents,
    connections,
    backtestRuns,
} from "./schema";
import { eq, desc, and, inArray, sql, lt, gt, isNull } from "drizzle-orm";

// ── Entity queries ─────────────────────────────────────────────────────────

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
    let query = db.select().from(entities);
    if (type) {
          query = query.where(eq(entities.type, type)) as typeof query;
    }
    return query.orderBy(entities.name);
}

export async function getEntity(id: number) {
    const [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, id));
    return entity ?? null;
}

// ── Thesis queries ─────────────────────────────────────────────────────────

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
    let query = db.select().from(theses);
    if (activeOnly) {
          query = query.where(eq(theses.isActive, true)) as typeof query;
    }
    return query.orderBy(desc(theses.createdAt));
}

export async function getThesis(id: number) {
    const [thesis] = await db
      .select()
      .from(theses)
      .where(eq(theses.id, id));
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

// ── News event queries ─────────────────────────────────────────────────────

export async function insertNewsEvent(data: {
    title: string;
    url?: string;
    source?: string;
    content?: string;
    summary?: string;
    publishedAt?: Date;
}) {
    // Deduplicate by URL
  if (data.url) {
        const existing = await db
          .select({ id: newsEvents.id })
          .from(newsEvents)
          .where(eq(newsEvents.url, data.url))
          .limit(1);
        if (existing.length > 0) return null; // already exists
  }
    const [event] = await db.insert(newsEvents).values(data).returning();
    return event;
}

export async function listNewsEvents({
    limit = 50,
    unprocessedOnly = false,
    aiRelevanceMin,
}: {
    limit?: number;
    unprocessedOnly?: boolean;
    aiRelevanceMin?: number;
} = {}) {
    let query = db.select().from(newsEvents);
    const conditions = [];
    if (unprocessedOnly) conditions.push(eq(newsEvents.processed, false));
    if (aiRelevanceMin) conditions.push(gt(newsEvents.aiRelevance, aiRelevanceMin - 1));
    if (conditions.length) {
          query = query.where(and(...conditions)) as typeof query;
    }
    return query.orderBy(desc(newsEvents.ingestedAt)).limit(limit);
}

export async function markNewsProcessed(
    id: number,
    data: {
          aiRelevance?: number;
          sentiment?: string;
          extractedEntities?: string[];
          extractedThesisIds?: number[];
    }
  ) {
    await db
      .update(newsEvents)
      .set({ processed: true, ...data })
      .where(eq(newsEvents.id, id));
}

export async function getNewsEvent(id: number) {
    const [event] = await db
      .select()
      .from(newsEvents)
      .where(eq(newsEvents.id, id));
    return event ?? null;
}

// ── Connection (graph edge) queries ───────────────────────────────────────

export async function createConnection(data: {
    fromType: string;
    fromId: number;
    toType: string;
    toId: number;
    relation: string;
    direction?: string;
    confidence?: number;
    weight?: number;
    reasoning?: string;
    sourceNewsId?: number;
}) {
    const [conn] = await db.insert(connections).values(data).returning();
    return conn;
}

export async function getConnectionsFrom(fromType: string, fromId: number) {
    return db
      .select()
      .from(connections)
      .where(and(eq(connections.fromType, fromType), eq(connections.fromId, fromId)))
      .orderBy(desc(connections.weight));
}

export async function getConnectionsTo(toType: string, toId: number) {
    return db
      .select()
      .from(connections)
      .where(and(eq(connections.toType, toType), eq(connections.toId, toId)))
      .orderBy(desc(connections.weight));
}

export async function getThesisConnections(thesisId: number) {
    // All news events connected to this thesis
  return db
      .select()
      .from(connections)
      .where(
              and(
                        eq(connections.toType, "thesis"),
                        eq(connections.toId, thesisId)
                      )
            )
      .orderBy(desc(connections.createdAt));
}

/** Get full graph for rendering: all nodes + edges, optionally filtered by time */
export async function getGraphData(opts?: {
    thesisIds?: number[];
    since?: Date;
    limit?: number;
}) {
    let newsQuery = db
      .select({
              id: newsEvents.id,
              title: newsEvents.title,
              url: newsEvents.url,
              source: newsEvents.source,
              sentiment: newsEvents.sentiment,
              aiRelevance: newsEvents.aiRelevance,
              publishedAt: newsEvents.publishedAt,
              ingestedAt: newsEvents.ingestedAt,
      })
      .from(newsEvents)
      .where(eq(newsEvents.processed, true));

  if (opts?.since) {
        newsQuery = newsQuery.where(gt(newsEvents.ingestedAt, opts.since)) as typeof newsQuery;
  }

  const newsNodes = await newsQuery
      .orderBy(desc(newsEvents.ingestedAt))
      .limit(opts?.limit ?? 200);

  const entityNodes = await db.select().from(entities);
    const thesisNodes = await db
      .select()
      .from(theses)
      .where(eq(theses.isActive, true));

  const edgeQuery = db.select().from(connections).orderBy(desc(connections.weight));
    const edges = await edgeQuery.limit(500);

  return { newsNodes, entityNodes, thesisNodes, edges };
}

// ── Backtest queries ───────────────────────────────────────────────────────

export async function createBacktestRun(data: {
    name: string;
    thesisId?: number;
    startDate: Date;
    endDate: Date;
    parameters?: Record<string, unknown>;
}) {
    const [run] = await db.insert(backtestRuns).values(data).returning();
    return run;
}

export async function updateBacktestRun(
    id: number,
    data: Partial<{
          results: Record<string, unknown>;
          accuracy: number;
          totalSignals: number;
          correctSignals: number;
          status: string;
          completedAt: Date;
    }>
  ) {
    const [updated] = await db
      .update(backtestRuns)
      .set(data)
      .where(eq(backtestRuns.id, id))
      .returning();
    return updated;
}

export async function listBacktestRuns(thesisId?: number) {
    let query = db.select().from(backtestRuns);
    if (thesisId) {
          query = query.where(eq(backtestRuns.thesisId, thesisId)) as typeof query;
    }
    return query.orderBy(desc(backtestRuns.createdAt));
}

/** Reinforcement: bump connection weight when backtest confirms it was predictive */
export async function reinforceConnection(
    connectionId: number,
    wasCorrect: boolean
  ) {
    const [conn] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, connectionId));
    if (!conn) return;

  const currentWeight = conn.adjustedWeight ?? conn.weight;
    // Bayesian-style update: correct prediction increases weight, wrong decreases
  const delta = wasCorrect ? 0.1 : -0.05;
    const newWeight = Math.max(0.1, Math.min(2.0, currentWeight + delta));

  await db
      .update(connections)
      .set({ adjustedWeight: newWeight })
      .where(eq(connections.id, connectionId));
}
