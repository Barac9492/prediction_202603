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
} from "./schema";
import { eq, desc, and, sql, lte } from "drizzle-orm";

// — Entity queries ————————————————————————————————————————————

export async function upsertEntity(data: {
  name: string;
  type: string;
  category?: string;
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

// — Thesis queries ————————————————————————————————————————————

export async function createThesis(data: {
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
  const [thesis] = await db.insert(theses).values(data).returning();
  return thesis;
}

export async function listTheses(activeOnly = false) {
  if (activeOnly) {
    return db.select().from(theses).where(eq(theses.isActive, true)).orderBy(desc(theses.createdAt));
  }
  return db.select().from(theses).orderBy(desc(theses.createdAt));
}

export async function listPendingTheses() {
  return db.select().from(theses).where(eq(theses.status, "pending_review")).orderBy(desc(theses.createdAt));
}

export async function getThesis(id: number) {
  const [thesis] = await db.select().from(theses).where(eq(theses.id, id));
  return thesis ?? null;
}

export async function updateThesis(
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
    .where(eq(theses.id, id))
    .returning();
  return updated;
}

// — News event queries ————————————————————————————————————————

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

export async function getNewsEventByUrl(url: string) {
  const [event] = await db
    .select()
    .from(newsEvents)
    .where(eq(newsEvents.url, url))
    .limit(1);
  return event ?? null;
}

export async function updateNewsEvent(
  id: number,
  data: Partial<{ title: string; content: string; publishedAt: Date }>,
) {
  const [updated] = await db
    .update(newsEvents)
    .set({ ...data, processed: false, ingestedAt: new Date() })
    .where(eq(newsEvents.id, id))
    .returning();
  return updated;
}

// — Connection queries ————————————————————————————————————————

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

// — Backtest queries ————————————————————————————————————————

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

// — Thesis interaction queries ————————————————————————————————

export async function getThesisInteractions(thesisId: number) {
  const asFrom = await db
    .select()
    .from(connections)
    .where(and(eq(connections.fromType, "thesis"), eq(connections.fromId, thesisId), eq(connections.toType, "thesis")));
  const asTo = await db
    .select()
    .from(connections)
    .where(and(eq(connections.fromType, "thesis"), eq(connections.toType, "thesis"), eq(connections.toId, thesisId)));
  // Deduplicate by connection id
  const map = new Map<number, typeof asFrom[number]>();
  for (const c of [...asFrom, ...asTo]) map.set(c.id, c);
  return [...map.values()];
}

export async function upsertThesisInteraction(data: {
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
      .where(eq(connections.id, existing[0].id))
      .returning();
    return updated;
  }
  // Check reverse direction
  const reverse = await db
    .select()
    .from(connections)
    .where(
      and(
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
      .where(eq(connections.id, reverse[0].id))
      .returning();
    return updated;
  }
  // Create new
  const [created] = await db
    .insert(connections)
    .values({
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

export async function getMarketSignals(thesisId: number) {
  return db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.fromType, "market"),
        eq(connections.toType, "thesis"),
        eq(connections.toId, thesisId)
      )
    )
    .orderBy(desc(connections.createdAt));
}

export async function reinforceConnection(connectionId: number, wasCorrect: boolean) {
  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!conn) return;
  const currentWeight = conn.adjustedWeight ?? conn.weight;
  const delta = wasCorrect ? 0.1 : -0.05;
  const newWeight = Math.max(0.1, Math.min(2.0, currentWeight + delta));
  await db.update(connections).set({ adjustedWeight: newWeight }).where(eq(connections.id, connectionId));
}

// — Entity graph queries ————————————————————————————————————————

export async function getEntityConnections(entityId: number) {
  const asFrom = await db
    .select()
    .from(connections)
    .where(and(eq(connections.fromType, "entity"), eq(connections.fromId, entityId)));
  const asTo = await db
    .select()
    .from(connections)
    .where(and(eq(connections.toType, "entity"), eq(connections.toId, entityId)));
  const map = new Map<number, typeof asFrom[number]>();
  for (const c of [...asFrom, ...asTo]) map.set(c.id, c);
  return [...map.values()];
}

export async function getEntitiesForThesis(thesisId: number) {
  // Find entities connected to news events that connect to this thesis
  const thesisConns = await db
    .select({ sourceNewsId: connections.sourceNewsId })
    .from(connections)
    .where(
      and(
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
    .where(sql`${entities.id} IN (${sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)})`);
  return result;
}

export async function getEntityNetwork(entityId: number, depth = 1) {
  const entity = await getEntity(entityId);
  if (!entity) return null;

  const conns = await getEntityConnections(entityId);

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
          .where(sql`${entities.id} IN (${sql.join([...neighborIds].map((id) => sql`${id}`), sql`, `)})`)
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
          .where(sql`${theses.id} IN (${sql.join([...thesisIds].map((id) => sql`${id}`), sql`, `)})`)
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
          .where(sql`${newsEvents.id} IN (${sql.join([...newsIds].map((id) => sql`${id}`), sql`, `)})`)
      : [];

  return { entity, connections: conns, neighbors, relatedTheses, relatedNews };
}

// — Entity observation queries ————————————————————————————————

export async function createEntityObservation(data: {
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
    .values({ ...data, observedAt: data.observedAt ?? new Date() })
    .returning();
  return obs;
}

export async function getEntityTimeline(entityId: number, attribute?: string) {
  if (attribute) {
    return db
      .select()
      .from(entityObservations)
      .where(
        and(
          eq(entityObservations.entityId, entityId),
          eq(entityObservations.attribute, attribute)
        )
      )
      .orderBy(desc(entityObservations.observedAt));
  }
  return db
    .select()
    .from(entityObservations)
    .where(eq(entityObservations.entityId, entityId))
    .orderBy(desc(entityObservations.observedAt));
}

// — Signal cluster queries ————————————————————————————————

export async function createSignalCluster(data: {
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
    .values({ ...data, detectedAt: new Date(), lastUpdated: new Date() })
    .returning();
  return cluster;
}

export async function updateSignalCluster(
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
    .where(eq(signalClusters.id, id))
    .returning();
  return updated;
}

export async function listSignalClusters(status?: string) {
  if (status) {
    return db
      .select()
      .from(signalClusters)
      .where(eq(signalClusters.status, status))
      .orderBy(desc(signalClusters.detectedAt));
  }
  return db
    .select()
    .from(signalClusters)
    .orderBy(desc(signalClusters.detectedAt));
}

export async function getClusterDetails(clusterId: number) {
  const [cluster] = await db
    .select()
    .from(signalClusters)
    .where(eq(signalClusters.id, clusterId));
  if (!cluster) return null;

  const connIds = (cluster.connectionIds || []) as number[];
  const entIds = (cluster.entityIds || []) as number[];
  const thIds = (cluster.thesisIds || []) as number[];

  const clusterConnections =
    connIds.length > 0
      ? await db
          .select()
          .from(connections)
          .where(sql`${connections.id} IN (${sql.join(connIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

  const clusterEntities =
    entIds.length > 0
      ? await db
          .select()
          .from(entities)
          .where(sql`${entities.id} IN (${sql.join(entIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

  const clusterTheses =
    thIds.length > 0
      ? await db
          .select()
          .from(theses)
          .where(sql`${theses.id} IN (${sql.join(thIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

  return { cluster, connections: clusterConnections, entities: clusterEntities, theses: clusterTheses };
}

// — Bulk entity queries for dashboard ————————————————————————

export async function getRecentEntityObservations(limit = 20) {
  return db
    .select({
      observation: entityObservations,
      entityName: entities.name,
      entityCategory: entities.category,
    })
    .from(entityObservations)
    .innerJoin(entities, eq(entityObservations.entityId, entities.id))
    .orderBy(desc(entityObservations.observedAt))
    .limit(limit);
}

export async function getEntitiesWithSignalCounts() {
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
    .groupBy(entities.id)
    .orderBy(sql`count(${connections.id}) DESC`);
  return result;
}

// — Recommendation queries ————————————————————————————————

export async function insertRecommendation(data: {
  thesisId?: number;
  action: string;
  asset: string;
  conviction: number;
  timeframeDays: number;
  deadline: Date;
  rationale: string;
  probabilityAtCreation?: number;
}) {
  const [rec] = await db.insert(recommendations).values(data).returning();
  return rec;
}

export async function listRecommendations({
  status,
  limit = 50,
}: { status?: string; limit?: number } = {}) {
  if (status) {
    return db
      .select()
      .from(recommendations)
      .where(eq(recommendations.status, status))
      .orderBy(desc(recommendations.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);
}

export async function getExpiredRecommendations() {
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.status, "active"),
        lte(recommendations.deadline, new Date())
      )
    )
    .orderBy(desc(recommendations.deadline));
}

export async function resolveRecommendation(
  id: number,
  data: {
    status: string;
    outcomeNotes?: string;
    brierScore?: number;
    probabilityAtResolution?: number;
  }
) {
  const [updated] = await db
    .update(recommendations)
    .set({ ...data, resolvedAt: new Date() })
    .where(eq(recommendations.id, id))
    .returning();
  return updated;
}

export async function getActiveRecommendationForAsset(
  asset: string,
  action: string
) {
  const [rec] = await db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.asset, asset),
        eq(recommendations.action, action),
        eq(recommendations.status, "active")
      )
    )
    .limit(1);
  return rec ?? null;
}

export async function getUncoveredEntities() {
  // Entities with connections but no thesis coverage
  const allEntities = await getEntitiesWithSignalCounts();
  const entitiesWithThesis = new Set<number>();

  // Find entities that have a path to a thesis
  const entityThesisConns = await db
    .select({ entityId: connections.fromId })
    .from(connections)
    .where(
      and(eq(connections.fromType, "entity"), eq(connections.toType, "thesis"))
    );
  for (const c of entityThesisConns) entitiesWithThesis.add(c.entityId);

  return allEntities.filter(
    (e) => e.signalCount > 0 && !entitiesWithThesis.has(e.entity.id)
  );
}
