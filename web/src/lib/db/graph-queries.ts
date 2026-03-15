import { db } from "./index";
import {
  entities,
  theses,
  newsEvents,
  connections,
  backtestRuns,
  entityObservations,
  signalClusters,
  recommendations,
  priceSnapshots,
  thesisProbabilitySnapshots,
} from "./schema";
import { eq, desc, and, sql, lte } from "drizzle-orm";

// — Entity queries ————————————————————————————————————————————

export async function upsertEntity(workspaceId: string, data: {
  name: string;
  type: string;
  category?: string;
  description?: string;
  aliases?: string[];
}) {
  const existing = await db
    .select()
    .from(entities)
    .where(and(eq(entities.workspaceId, workspaceId), eq(entities.name, data.name)))
    .limit(1);
  if (existing.length > 0) {
    const [updated] = await db
      .update(entities)
      .set({ updatedAt: new Date(), ...data })
      .where(and(eq(entities.workspaceId, workspaceId), eq(entities.name, data.name)))
      .returning();
    return updated;
  }
  const [created] = await db.insert(entities).values({ workspaceId, ...data }).returning();
  return created;
}

export async function listEntities(workspaceId: string, type?: string) {
  if (type) {
    return db.select().from(entities).where(and(eq(entities.workspaceId, workspaceId), eq(entities.type, type))).orderBy(entities.name);
  }
  return db.select().from(entities).where(eq(entities.workspaceId, workspaceId)).orderBy(entities.name);
}

export async function getEntity(workspaceId: string, id: number) {
  const [entity] = await db.select().from(entities).where(and(eq(entities.workspaceId, workspaceId), eq(entities.id, id)));
  return entity ?? null;
}

// — Thesis queries ————————————————————————————————————————————

export async function createThesis(workspaceId: string, data: {
  title: string;
  description: string;
  direction: string;
  domain?: string;
  tags?: string[];
  status?: string;
  aiRationale?: string;
  isActive?: boolean;
  deadline?: Date | null;
  resolutionCriteria?: string;
}) {
  const [thesis] = await db.insert(theses).values({ workspaceId, ...data }).returning();
  return thesis;
}

export async function listTheses(workspaceId: string, activeOnly = false) {
  if (activeOnly) {
    return db.select().from(theses).where(and(eq(theses.workspaceId, workspaceId), eq(theses.isActive, true))).orderBy(desc(theses.createdAt));
  }
  return db.select().from(theses).where(eq(theses.workspaceId, workspaceId)).orderBy(desc(theses.createdAt));
}

export async function listPendingTheses(workspaceId: string) {
  return db.select().from(theses).where(and(eq(theses.workspaceId, workspaceId), eq(theses.status, "pending_review"))).orderBy(desc(theses.createdAt));
}

export async function getThesis(workspaceId: string, id: number) {
  const [thesis] = await db.select().from(theses).where(and(eq(theses.workspaceId, workspaceId), eq(theses.id, id)));
  return thesis ?? null;
}

export async function updateThesis(
  workspaceId: string,
  id: number,
  data: Partial<{
    title: string; description: string; direction: string; isActive: boolean;
    status: string; aiRationale: string; deadline: Date | null; resolutionCriteria: string;
    resolutionSource: string; resolvedAt: Date; finalProbability: number; brierScore: number;
  }>
) {
  const [updated] = await db
    .update(theses)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(theses.workspaceId, workspaceId), eq(theses.id, id)))
    .returning();
  return updated;
}

// — News event queries ————————————————————————————————————————

export async function insertNewsEvent(workspaceId: string, data: {
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
      .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.url, data.url)))
      .limit(1);
    if (existing.length > 0) return null;
  }
  const [event] = await db.insert(newsEvents).values({ workspaceId, ...data }).returning();
  return event;
}

export async function listNewsEvents(workspaceId: string, {
  limit = 50,
  unprocessedOnly = false,
  aiRelevanceMin,
}: { limit?: number; unprocessedOnly?: boolean; aiRelevanceMin?: number } = {}) {
  if (unprocessedOnly && aiRelevanceMin !== undefined) {
    return db.select().from(newsEvents)
      .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.processed, false), sql`${newsEvents.aiRelevance} > ${aiRelevanceMin - 1}`))
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  if (unprocessedOnly) {
    return db.select().from(newsEvents).where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.processed, false)))
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  if (aiRelevanceMin !== undefined) {
    return db.select().from(newsEvents)
      .where(and(eq(newsEvents.workspaceId, workspaceId), sql`${newsEvents.aiRelevance} > ${aiRelevanceMin - 1}`))
      .orderBy(desc(newsEvents.ingestedAt)).limit(limit);
  }
  return db.select().from(newsEvents).where(eq(newsEvents.workspaceId, workspaceId)).orderBy(desc(newsEvents.ingestedAt)).limit(limit);
}

export async function markNewsProcessed(
  workspaceId: string,
  id: number,
  data: { aiRelevance?: number; sentiment?: string; extractedEntities?: string[]; extractedThesisIds?: number[] }
) {
  await db.update(newsEvents).set({ processed: true, ...data }).where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.id, id)));
}

export async function getNewsEvent(workspaceId: string, id: number) {
  const [event] = await db.select().from(newsEvents).where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.id, id)));
  return event ?? null;
}

export async function getNewsEventByUrl(workspaceId: string, url: string) {
  const [event] = await db
    .select()
    .from(newsEvents)
    .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.url, url)))
    .limit(1);
  return event ?? null;
}

export async function updateNewsEvent(
  workspaceId: string,
  id: number,
  data: Partial<{ title: string; content: string; publishedAt: Date }>,
) {
  const [updated] = await db
    .update(newsEvents)
    .set({ ...data, processed: false, ingestedAt: new Date() })
    .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.id, id)))
    .returning();
  return updated;
}

// — Connection queries ————————————————————————————————————————

export async function createConnection(workspaceId: string, data: {
  fromType: string; fromId: number; toType: string; toId: number;
  relation: string; direction?: string; confidence?: number; weight?: number;
  reasoning?: string; sourceNewsId?: number;
}) {
  const [conn] = await db.insert(connections).values({ workspaceId, ...data }).returning();
  return conn;
}

export async function getConnectionsFrom(workspaceId: string, fromType: string, fromId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.fromType, fromType), eq(connections.fromId, fromId)))
    .orderBy(desc(connections.weight));
}

export async function getConnectionsTo(workspaceId: string, toType: string, toId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.toType, toType), eq(connections.toId, toId)))
    .orderBy(desc(connections.weight));
}

export async function getThesisConnections(workspaceId: string, thesisId: number) {
  return db.select().from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.toType, "thesis"), eq(connections.toId, thesisId)))
    .orderBy(desc(connections.createdAt));
}

export async function getGraphData(workspaceId: string, opts?: { thesisIds?: number[]; since?: Date; limit?: number }) {
  const baseSelect = {
    id: newsEvents.id, title: newsEvents.title, url: newsEvents.url,
    source: newsEvents.source, sentiment: newsEvents.sentiment,
    aiRelevance: newsEvents.aiRelevance, publishedAt: newsEvents.publishedAt,
    ingestedAt: newsEvents.ingestedAt,
  };
  const newsNodes = await (opts?.since
    ? db.select(baseSelect).from(newsEvents)
        .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.processed, true), sql`${newsEvents.ingestedAt} > ${opts.since}`))
        .orderBy(desc(newsEvents.ingestedAt)).limit(opts?.limit ?? 200)
    : db.select(baseSelect).from(newsEvents)
        .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.processed, true)))
        .orderBy(desc(newsEvents.ingestedAt)).limit(opts?.limit ?? 200));
  const entityNodes = await db.select().from(entities).where(eq(entities.workspaceId, workspaceId));
  const thesisNodes = await db.select().from(theses).where(and(eq(theses.workspaceId, workspaceId), eq(theses.isActive, true)));
  const edges = await db.select().from(connections).where(eq(connections.workspaceId, workspaceId)).orderBy(desc(connections.weight)).limit(500);
  return { newsNodes, entityNodes, thesisNodes, edges };
}

// — Backtest queries ————————————————————————————————————————

export async function createBacktestRun(workspaceId: string, data: {
  name: string; thesisId?: number; startDate: Date; endDate: Date; parameters?: Record<string, unknown>;
}) {
  const [run] = await db.insert(backtestRuns).values({ workspaceId, ...data }).returning();
  return run;
}

export async function updateBacktestRun(
  workspaceId: string,
  id: number,
  data: Partial<{ results: Record<string, unknown>; accuracy: number; totalSignals: number; correctSignals: number; status: string; completedAt: Date }>
) {
  const [updated] = await db.update(backtestRuns).set(data).where(and(eq(backtestRuns.workspaceId, workspaceId), eq(backtestRuns.id, id))).returning();
  return updated;
}

export async function listBacktestRuns(workspaceId: string, thesisId?: number) {
  if (thesisId !== undefined) {
    return db.select().from(backtestRuns).where(and(eq(backtestRuns.workspaceId, workspaceId), eq(backtestRuns.thesisId, thesisId))).orderBy(desc(backtestRuns.createdAt));
  }
  return db.select().from(backtestRuns).where(eq(backtestRuns.workspaceId, workspaceId)).orderBy(desc(backtestRuns.createdAt));
}

// — Thesis interaction queries ————————————————————————————————

export async function getThesisInteractions(workspaceId: string, thesisId: number) {
  const asFrom = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.fromType, "thesis"), eq(connections.fromId, thesisId), eq(connections.toType, "thesis")));
  const asTo = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.fromType, "thesis"), eq(connections.toType, "thesis"), eq(connections.toId, thesisId)));
  // Deduplicate by connection id
  const map = new Map<number, typeof asFrom[number]>();
  for (const c of [...asFrom, ...asTo]) map.set(c.id, c);
  return [...map.values()];
}

export async function upsertThesisInteraction(workspaceId: string, data: {
  thesisAId: number;
  thesisBId: number;
  relation: string;
  confidence: number;
  reasoning: string;
  sourceNewsId?: number;
}) {
  // Check for existing connection in either direction
  const existing = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.fromType, "thesis"),
        eq(connections.fromId, data.thesisAId),
        eq(connections.toType, "thesis"),
        eq(connections.toId, data.thesisBId)
      )
    );
  if (existing.length > 0) {
    // Update existing
    const [updated] = await db
      .update(connections)
      .set({
        relation: data.relation,
        confidence: data.confidence,
        reasoning: data.reasoning,
        sourceNewsId: data.sourceNewsId,
      })
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, existing[0].id)))
      .returning();
    return updated;
  }
  // Check reverse direction
  const reverse = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.fromType, "thesis"),
        eq(connections.fromId, data.thesisBId),
        eq(connections.toType, "thesis"),
        eq(connections.toId, data.thesisAId)
      )
    );
  if (reverse.length > 0) {
    const [updated] = await db
      .update(connections)
      .set({
        relation: data.relation,
        confidence: data.confidence,
        reasoning: data.reasoning,
        sourceNewsId: data.sourceNewsId,
      })
      .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, reverse[0].id)))
      .returning();
    return updated;
  }
  // Create new
  const [created] = await db
    .insert(connections)
    .values({
      workspaceId,
      fromType: "thesis",
      fromId: data.thesisAId,
      toType: "thesis",
      toId: data.thesisBId,
      relation: data.relation,
      confidence: data.confidence,
      reasoning: data.reasoning,
      sourceNewsId: data.sourceNewsId,
    })
    .returning();
  return created;
}

// — Market signal queries ————————————————————————————————

export async function getMarketSignals(workspaceId: string, thesisId: number) {
  return db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.fromType, "market"),
        eq(connections.toType, "thesis"),
        eq(connections.toId, thesisId)
      )
    )
    .orderBy(desc(connections.createdAt));
}

export async function reinforceConnection(workspaceId: string, connectionId: number, wasCorrect: boolean) {
  const [conn] = await db.select().from(connections).where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, connectionId)));
  if (!conn) return;
  const currentWeight = conn.adjustedWeight ?? conn.weight;
  const delta = wasCorrect ? 0.1 : -0.05;
  const newWeight = Math.max(0.1, Math.min(2.0, currentWeight + delta));
  await db.update(connections).set({ adjustedWeight: newWeight }).where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, connectionId)));
}

// — Entity graph queries ————————————————————————————————————————

export async function getEntityConnections(workspaceId: string, entityId: number) {
  const asFrom = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.fromType, "entity"), eq(connections.fromId, entityId)));
  const asTo = await db
    .select()
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.toType, "entity"), eq(connections.toId, entityId)));
  const map = new Map<number, typeof asFrom[number]>();
  for (const c of [...asFrom, ...asTo]) map.set(c.id, c);
  return [...map.values()];
}

export async function getEntitiesForThesis(workspaceId: string, thesisId: number) {
  // Find entities connected to news events that connect to this thesis
  const thesisConns = await db
    .select({ sourceNewsId: connections.sourceNewsId })
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.toType, "thesis"),
        eq(connections.toId, thesisId),
        eq(connections.fromType, "news_event")
      )
    );
  const newsIds = thesisConns
    .map((c) => c.sourceNewsId)
    .filter((id): id is number => id !== null);
  if (newsIds.length === 0) return [];

  // Get entities connected to those news events
  const entityConns = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.fromType, "news_event"),
        eq(connections.toType, "entity")
      )
    );
  const entityIds = entityConns
    .filter((c) => newsIds.includes(c.fromId))
    .map((c) => c.toId);
  if (entityIds.length === 0) return [];

  const uniqueIds = [...new Set(entityIds)];
  const result = await db
    .select()
    .from(entities)
    .where(and(eq(entities.workspaceId, workspaceId), sql`${entities.id} IN (${sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)})`));
  return result;
}

export async function getEntityNetwork(workspaceId: string, entityId: number, depth = 1) {
  const entity = await getEntity(workspaceId, entityId);
  if (!entity) return null;

  const conns = await getEntityConnections(workspaceId, entityId);

  // Collect neighbor entity IDs
  const neighborIds = new Set<number>();
  for (const c of conns) {
    if (c.fromType === "entity" && c.fromId !== entityId) neighborIds.add(c.fromId);
    if (c.toType === "entity" && c.toId !== entityId) neighborIds.add(c.toId);
  }

  const neighbors =
    neighborIds.size > 0
      ? await db
          .select()
          .from(entities)
          .where(and(eq(entities.workspaceId, workspaceId), sql`${entities.id} IN (${sql.join([...neighborIds].map((id) => sql`${id}`), sql`, `)})`))
      : [];

  // Get connected theses
  const thesisConns = conns.filter(
    (c) => c.fromType === "thesis" || c.toType === "thesis"
  );
  const thesisIds = new Set<number>();
  for (const c of thesisConns) {
    if (c.fromType === "thesis") thesisIds.add(c.fromId);
    if (c.toType === "thesis") thesisIds.add(c.toId);
  }
  const relatedTheses =
    thesisIds.size > 0
      ? await db
          .select()
          .from(theses)
          .where(and(eq(theses.workspaceId, workspaceId), sql`${theses.id} IN (${sql.join([...thesisIds].map((id) => sql`${id}`), sql`, `)})`))
      : [];

  // Get connected news
  const newsConns = conns.filter(
    (c) => c.fromType === "news_event" || c.toType === "news_event"
  );
  const newsIds = new Set<number>();
  for (const c of newsConns) {
    if (c.fromType === "news_event") newsIds.add(c.fromId);
    if (c.toType === "news_event") newsIds.add(c.toId);
  }
  const relatedNews =
    newsIds.size > 0
      ? await db
          .select()
          .from(newsEvents)
          .where(and(eq(newsEvents.workspaceId, workspaceId), sql`${newsEvents.id} IN (${sql.join([...newsIds].map((id) => sql`${id}`), sql`, `)})`))
      : [];

  return { entity, connections: conns, neighbors, relatedTheses, relatedNews };
}

// — Entity observation queries ————————————————————————————————

export async function createEntityObservation(workspaceId: string, data: {
  entityId: number;
  attribute: string;
  value: string;
  numericValue?: number;
  confidence: number;
  sourceNewsId?: number;
  observedAt?: Date;
}) {
  const [obs] = await db
    .insert(entityObservations)
    .values({ workspaceId, ...data, observedAt: data.observedAt ?? new Date() })
    .returning();
  return obs;
}

export async function getEntityTimeline(workspaceId: string, entityId: number, attribute?: string) {
  if (attribute) {
    return db
      .select()
      .from(entityObservations)
      .where(
        and(
          eq(entityObservations.workspaceId, workspaceId),
          eq(entityObservations.entityId, entityId),
          eq(entityObservations.attribute, attribute)
        )
      )
      .orderBy(desc(entityObservations.observedAt));
  }
  return db
    .select()
    .from(entityObservations)
    .where(and(eq(entityObservations.workspaceId, workspaceId), eq(entityObservations.entityId, entityId)))
    .orderBy(desc(entityObservations.observedAt));
}

// — Signal cluster queries ————————————————————————————————

export async function createSignalCluster(workspaceId: string, data: {
  title: string;
  description: string;
  pattern: string;
  confidence: number;
  connectionIds?: number[];
  entityIds?: number[];
  thesisIds?: number[];
  metadata?: Record<string, unknown>;
}) {
  const [cluster] = await db
    .insert(signalClusters)
    .values({ workspaceId, ...data, detectedAt: new Date(), lastUpdated: new Date() })
    .returning();
  return cluster;
}

export async function updateSignalCluster(
  workspaceId: string,
  id: number,
  data: Partial<{
    title: string;
    description: string;
    pattern: string;
    confidence: number;
    status: string;
    connectionIds: number[];
    entityIds: number[];
    thesisIds: number[];
    metadata: Record<string, unknown>;
  }>
) {
  const [updated] = await db
    .update(signalClusters)
    .set({ ...data, lastUpdated: new Date() })
    .where(and(eq(signalClusters.workspaceId, workspaceId), eq(signalClusters.id, id)))
    .returning();
  return updated;
}

export async function listSignalClusters(workspaceId: string, status?: string) {
  if (status) {
    return db
      .select()
      .from(signalClusters)
      .where(and(eq(signalClusters.workspaceId, workspaceId), eq(signalClusters.status, status)))
      .orderBy(desc(signalClusters.detectedAt));
  }
  return db
    .select()
    .from(signalClusters)
    .where(eq(signalClusters.workspaceId, workspaceId))
    .orderBy(desc(signalClusters.detectedAt));
}

export async function getClusterDetails(workspaceId: string, clusterId: number) {
  const [cluster] = await db
    .select()
    .from(signalClusters)
    .where(and(eq(signalClusters.workspaceId, workspaceId), eq(signalClusters.id, clusterId)));
  if (!cluster) return null;

  const connIds = (cluster.connectionIds || []) as number[];
  const entIds = (cluster.entityIds || []) as number[];
  const thIds = (cluster.thesisIds || []) as number[];

  const clusterConnections =
    connIds.length > 0
      ? await db
          .select()
          .from(connections)
          .where(and(eq(connections.workspaceId, workspaceId), sql`${connections.id} IN (${sql.join(connIds.map((id) => sql`${id}`), sql`, `)})`))
      : [];

  const clusterEntities =
    entIds.length > 0
      ? await db
          .select()
          .from(entities)
          .where(and(eq(entities.workspaceId, workspaceId), sql`${entities.id} IN (${sql.join(entIds.map((id) => sql`${id}`), sql`, `)})`))
      : [];

  const clusterTheses =
    thIds.length > 0
      ? await db
          .select()
          .from(theses)
          .where(and(eq(theses.workspaceId, workspaceId), sql`${theses.id} IN (${sql.join(thIds.map((id) => sql`${id}`), sql`, `)})`))
      : [];

  return { cluster, connections: clusterConnections, entities: clusterEntities, theses: clusterTheses };
}

// — Bulk entity queries for dashboard ————————————————————————

export async function getRecentEntityObservations(workspaceId: string, limit = 20) {
  return db
    .select({
      observation: entityObservations,
      entityName: entities.name,
      entityCategory: entities.category,
    })
    .from(entityObservations)
    .innerJoin(entities, eq(entityObservations.entityId, entities.id))
    .where(eq(entityObservations.workspaceId, workspaceId))
    .orderBy(desc(entityObservations.observedAt))
    .limit(limit);
}

export async function getEntitiesWithSignalCounts(workspaceId: string) {
  // Entities ordered by connection count (most connected first)
  const result = await db
    .select({
      entity: entities,
      signalCount: sql<number>`count(${connections.id})::int`,
    })
    .from(entities)
    .leftJoin(
      connections,
      sql`(${connections.fromType} = 'entity' AND ${connections.fromId} = ${entities.id})
       OR (${connections.toType} = 'entity' AND ${connections.toId} = ${entities.id})`
    )
    .where(eq(entities.workspaceId, workspaceId))
    .groupBy(entities.id)
    .orderBy(sql`count(${connections.id}) DESC`);
  return result;
}

// — Recommendation queries ————————————————————————————————

export async function insertRecommendation(workspaceId: string, data: {
  thesisId?: number;
  action: string;
  asset: string;
  conviction: number;
  timeframeDays: number;
  deadline: Date;
  rationale: string;
  probabilityAtCreation?: number;
  ticker?: string;
  priceAtCreation?: number;
}) {
  const [rec] = await db.insert(recommendations).values({ workspaceId, ...data }).returning();
  return rec;
}

export async function listRecommendations(workspaceId: string, {
  status,
  limit = 50,
}: { status?: string; limit?: number } = {}) {
  if (status) {
    return db
      .select()
      .from(recommendations)
      .where(and(eq(recommendations.workspaceId, workspaceId), eq(recommendations.status, status)))
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(recommendations)
    .where(eq(recommendations.workspaceId, workspaceId))
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}

export async function getExpiredRecommendations(workspaceId: string) {
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.workspaceId, workspaceId),
        eq(recommendations.status, "active"),
        lte(recommendations.deadline, new Date())
      )
    )
    .orderBy(desc(recommendations.deadline));
}

export async function resolveRecommendation(
  workspaceId: string,
  id: number,
  data: {
    status: string;
    outcomeNotes?: string;
    brierScore?: number;
    probabilityAtResolution?: number;
    priceAtResolution?: number;
    actualReturn?: number;
  }
) {
  const [updated] = await db
    .update(recommendations)
    .set({ ...data, resolvedAt: new Date() })
    .where(and(eq(recommendations.workspaceId, workspaceId), eq(recommendations.id, id)))
    .returning();
  return updated;
}

export async function getRecommendation(workspaceId: string, id: number) {
  const [rec] = await db
    .select()
    .from(recommendations)
    .where(and(eq(recommendations.workspaceId, workspaceId), eq(recommendations.id, id)));
  return rec ?? null;
}

export async function getNewsEventsByIds(workspaceId: string, ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(newsEvents)
    .where(and(eq(newsEvents.workspaceId, workspaceId), sql`${newsEvents.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`));
}

export async function getEntitiesByIds(workspaceId: string, ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(entities)
    .where(and(eq(entities.workspaceId, workspaceId), sql`${entities.id} IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`));
}

export async function insertPriceSnapshot(workspaceId: string, data: {
  ticker: string;
  price: number;
  volume?: number;
}) {
  const [snap] = await db.insert(priceSnapshots).values({ workspaceId, ...data }).returning();
  return snap;
}

export async function getActiveRecommendationForAsset(
  workspaceId: string,
  asset: string,
  action: string
) {
  const [rec] = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.workspaceId, workspaceId),
        eq(recommendations.asset, asset),
        eq(recommendations.action, action),
        eq(recommendations.status, "active")
      )
    )
    .limit(1);
  return rec ?? null;
}

export async function getExpiringSoonRecommendations(workspaceId: string, daysAhead = 7) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.workspaceId, workspaceId),
        eq(recommendations.status, "active"),
        sql`${recommendations.deadline} > ${now}`,
        lte(recommendations.deadline, cutoff)
      )
    )
    .orderBy(recommendations.deadline);
}

export async function getContradictingEvidence(
  workspaceId: string,
  highConvictionTheses: Array<{ thesisId: number; direction: string }>
) {
  if (highConvictionTheses.length === 0) return [];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const results: Array<{
    thesisId: number;
    newsId: number;
    newsTitle: string;
    newsSentiment: string | null;
    newsPublishedAt: Date | null;
    newsSource: string | null;
  }> = [];

  for (const t of highConvictionTheses) {
    // Find news connected to this thesis with opposing sentiment
    const opposingSentiment = t.direction === "bullish" ? "bearish" : "bullish";
    const rows = await db
      .select({
        newsId: newsEvents.id,
        newsTitle: newsEvents.title,
        newsSentiment: newsEvents.sentiment,
        newsPublishedAt: newsEvents.publishedAt,
        newsSource: newsEvents.source,
      })
      .from(connections)
      .innerJoin(newsEvents, eq(connections.sourceNewsId, newsEvents.id))
      .where(
        and(
          eq(connections.workspaceId, workspaceId),
          eq(connections.toType, "thesis"),
          eq(connections.toId, t.thesisId),
          eq(newsEvents.sentiment, opposingSentiment),
          sql`${newsEvents.ingestedAt} > ${sevenDaysAgo}`
        )
      )
      .limit(3);

    for (const row of rows) {
      results.push({ thesisId: t.thesisId, ...row });
    }
  }

  return results;
}

export async function getUncoveredEntities(workspaceId: string) {
  // Entities with connections but no thesis coverage
  const allEntities = await getEntitiesWithSignalCounts(workspaceId);
  const entitiesWithThesis = new Set<number>();

  // Find entities that have a path to a thesis
  const entityThesisConns = await db
    .select({ entityId: connections.fromId })
    .from(connections)
    .where(
      and(eq(connections.workspaceId, workspaceId), eq(connections.fromType, "entity"), eq(connections.toType, "thesis"))
    );
  for (const c of entityThesisConns) entitiesWithThesis.add(c.entityId);

  return allEntities.filter(
    (e) => e.signalCount > 0 && !entitiesWithThesis.has(e.entity.id)
  );
}

// — Dashboard activity queries ————————————————————————————

export async function getRecentNews(workspaceId: string, limit = 5) {
  return db
    .select()
    .from(newsEvents)
    .where(eq(newsEvents.workspaceId, workspaceId))
    .orderBy(desc(newsEvents.publishedAt))
    .limit(limit);
}

export async function getProbabilityMovers(workspaceId: string, limit = 5) {
  // Get latest snapshot per thesis, ordered by |momentum|
  const latest = await db
    .select({
      thesisId: thesisProbabilitySnapshots.thesisId,
      probability: thesisProbabilitySnapshots.probability,
      momentum: thesisProbabilitySnapshots.momentum,
      computedAt: thesisProbabilitySnapshots.computedAt,
      thesisTitle: theses.title,
      thesisDirection: theses.direction,
    })
    .from(thesisProbabilitySnapshots)
    .innerJoin(theses, eq(thesisProbabilitySnapshots.thesisId, theses.id))
    .where(eq(thesisProbabilitySnapshots.workspaceId, workspaceId))
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(100);

  // Deduplicate to latest per thesis, then sort by |momentum|
  const seen = new Set<number>();
  const unique = latest.filter((row) => {
    if (seen.has(row.thesisId)) return false;
    seen.add(row.thesisId);
    return true;
  });

  return unique
    .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))
    .slice(0, limit);
}

// — Probability explainer queries ————————————————————————————

export async function getRecentSnapshotsForThesis(
  workspaceId: string,
  thesisId: number,
  count = 2
) {
  return db
    .select()
    .from(thesisProbabilitySnapshots)
    .where(
      and(
        eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
        eq(thesisProbabilitySnapshots.thesisId, thesisId)
      )
    )
    .orderBy(desc(thesisProbabilitySnapshots.computedAt))
    .limit(count);
}

export async function getConnectionsBetweenDates(
  workspaceId: string,
  thesisId: number,
  since: Date,
  until: Date
) {
  const conns = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.workspaceId, workspaceId),
        eq(connections.toType, "thesis"),
        eq(connections.toId, thesisId),
        sql`${connections.createdAt} >= ${since}`,
        lte(connections.createdAt, until)
      )
    );

  // Enrich with news event details
  const newsIds = conns.map((c) => c.sourceNewsId).filter((id): id is number => id !== null);
  const newsMap = new Map<number, typeof newsEvents.$inferSelect>();
  if (newsIds.length > 0) {
    const newsRows = await db
      .select()
      .from(newsEvents)
      .where(
        sql`${newsEvents.id} IN (${sql.join(
          newsIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    for (const n of newsRows) newsMap.set(n.id, n);
  }

  return conns.map((c) => ({
    ...c,
    news: c.sourceNewsId ? newsMap.get(c.sourceNewsId) ?? null : null,
  }));
}

// — Thesis lifecycle queries ————————————————————————————

export async function getOverdueTheses(workspaceId: string) {
  return db
    .select()
    .from(theses)
    .where(
      and(
        eq(theses.workspaceId, workspaceId),
        eq(theses.isActive, true),
        sql`${theses.deadline} IS NOT NULL AND ${theses.deadline} < NOW()`
      )
    );
}
