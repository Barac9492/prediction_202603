import { db } from "@/lib/db";
import { connections, entities, theses } from "@/lib/db/schema";
import {
  createSignalCluster,
  updateSignalCluster,
  listSignalClusters,
} from "@/lib/db/graph-queries";
import { desc, sql, and, eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface CoOccurrence {
  entityA: number;
  entityB: number;
  count: number;
  connectionIds: number[];
}

/**
 * Detect signal clusters from recent connections.
 * 1. Get connections from last N days
 * 2. Build entity co-occurrence matrix
 * 3. Group connections sharing 2+ entities AND same thesis direction
 * 4. For clusters of 3+ signals, call Claude for labeling
 * 5. Upsert into signal_clusters
 */
export async function detectClusters(workspaceId: string, windowDays = 7) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // 1. Get recent connections involving entities
  const recentConns = await db
    .select()
    .from(connections)
    .where(sql`${connections.workspaceId} = ${workspaceId} AND ${connections.createdAt} > ${since}`)
    .orderBy(desc(connections.createdAt));

  if (recentConns.length < 3) {
    return { clusters: [], message: "Not enough recent connections for clustering" };
  }

  // 2. Build entity co-occurrence: which entities appear together via shared news events
  const newsByEntity = new Map<number, Set<number>>(); // entityId → Set<newsId>
  const entityByNews = new Map<number, Set<number>>(); // newsId → Set<entityId>
  const newsConnMap = new Map<number, number[]>(); // newsId → connectionIds

  for (const conn of recentConns) {
    if (conn.toType === "entity" && conn.fromType === "news_event") {
      const newsId = conn.fromId;
      const entityId = conn.toId;

      if (!newsByEntity.has(entityId)) newsByEntity.set(entityId, new Set());
      newsByEntity.get(entityId)!.add(newsId);

      if (!entityByNews.has(newsId)) entityByNews.set(newsId, new Set());
      entityByNews.get(newsId)!.add(entityId);

      if (!newsConnMap.has(newsId)) newsConnMap.set(newsId, []);
      newsConnMap.get(newsId)!.push(conn.id);
    }
  }

  // 3. Find co-occurring entity pairs (appear together in 2+ news events)
  const coOccurrences: CoOccurrence[] = [];
  const entityIds = [...newsByEntity.keys()];

  for (let i = 0; i < entityIds.length; i++) {
    for (let j = i + 1; j < entityIds.length; j++) {
      const a = entityIds[i];
      const b = entityIds[j];
      const newsA = newsByEntity.get(a)!;
      const newsB = newsByEntity.get(b)!;
      const shared = [...newsA].filter((n) => newsB.has(n));

      if (shared.length >= 2) {
        const connIds = shared.flatMap((n) => newsConnMap.get(n) || []);
        coOccurrences.push({
          entityA: a,
          entityB: b,
          count: shared.length,
          connectionIds: [...new Set(connIds)],
        });
      }
    }
  }

  if (coOccurrences.length === 0) {
    return { clusters: [], message: "No entity co-occurrences found" };
  }

  // 4. Group into candidate clusters: merge co-occurrences sharing entities
  const candidateClusters: {
    entityIds: Set<number>;
    connectionIds: Set<number>;
    strength: number;
  }[] = [];

  for (const co of coOccurrences.sort((a, b) => b.count - a.count)) {
    // Try to merge into existing cluster
    let merged = false;
    for (const cluster of candidateClusters) {
      if (cluster.entityIds.has(co.entityA) || cluster.entityIds.has(co.entityB)) {
        cluster.entityIds.add(co.entityA);
        cluster.entityIds.add(co.entityB);
        for (const cid of co.connectionIds) cluster.connectionIds.add(cid);
        cluster.strength += co.count;
        merged = true;
        break;
      }
    }
    if (!merged) {
      candidateClusters.push({
        entityIds: new Set([co.entityA, co.entityB]),
        connectionIds: new Set(co.connectionIds),
        strength: co.count,
      });
    }
  }

  // Filter to clusters with 3+ signals
  const validClusters = candidateClusters.filter((c) => c.connectionIds.size >= 3);

  if (validClusters.length === 0) {
    return { clusters: [], message: "No clusters with 3+ signals found" };
  }

  // 5. For each candidate cluster, get context and call Claude for labeling
  const existingClusters = await listSignalClusters(workspaceId, "active");
  const results = [];

  for (const candidate of validClusters.slice(0, 5)) {
    // Fetch entity names
    const entIds = [...candidate.entityIds];
    const clusterEntities = entIds.length > 0
      ? await db
          .select()
          .from(entities)
          .where(sql`${entities.workspaceId} = ${workspaceId} AND ${entities.id} IN (${sql.join(entIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    // Find related theses via connections
    const thesisConns = recentConns.filter(
      (c) =>
        c.toType === "thesis" &&
        candidate.connectionIds.has(c.id)
    );
    const thesisIds = [...new Set(thesisConns.map((c) => c.toId))];
    const relatedTheses = thesisIds.length > 0
      ? await db
          .select()
          .from(theses)
          .where(sql`${theses.workspaceId} = ${workspaceId} AND ${theses.id} IN (${sql.join(thesisIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    // Check if this cluster already exists (similar entity set)
    const existingMatch = existingClusters.find((ec) => {
      const ecEntIds = new Set((ec.entityIds || []) as number[]);
      const overlap = entIds.filter((id) => ecEntIds.has(id)).length;
      return overlap >= Math.min(entIds.length, ecEntIds.size) * 0.6;
    });

    const clusterContext = {
      entities: clusterEntities.map((e) => `${e.name} (${e.category || e.type})`),
      theses: relatedTheses.map((t) => `[${t.direction}] ${t.title}`),
      signalCount: candidate.connectionIds.size,
      directions: thesisConns.map((c) => c.direction).filter(Boolean),
    };

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Analyze this signal cluster detected in an AI investment knowledge graph.

Entities co-occurring: ${clusterContext.entities.join(", ")}
Related theses: ${clusterContext.theses.join("; ") || "none"}
Signal count: ${clusterContext.signalCount}
Signal directions: ${clusterContext.directions.join(", ") || "mixed"}

Classify this cluster. Respond ONLY with valid JSON:
{
  "title": "Short descriptive title (max 60 chars)",
  "description": "2-3 sentence description of what this pattern means for investors",
  "pattern": "convergence|divergence|acceleration|reversal",
  "confidence": 0.0-1.0
}`,
          },
        ],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "";
      const label = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

      if (existingMatch) {
        // Update existing cluster
        const updated = await updateSignalCluster(workspaceId, existingMatch.id, {
          title: label.title,
          description: label.description,
          pattern: label.pattern,
          confidence: label.confidence,
          connectionIds: [...candidate.connectionIds],
          entityIds: entIds,
          thesisIds,
        });
        results.push({ action: "updated", cluster: updated });
      } else {
        // Create new cluster
        const cluster = await createSignalCluster(workspaceId, {
          title: label.title,
          description: label.description,
          pattern: label.pattern,
          confidence: label.confidence,
          connectionIds: [...candidate.connectionIds],
          entityIds: entIds,
          thesisIds,
        });
        results.push({ action: "created", cluster });
      }
    } catch (err) {
      console.error("Failed to label cluster:", err);
      results.push({ action: "error", error: String(err), entityIds: entIds });
    }
  }

  // Mark old clusters as stale if they haven't been updated
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - windowDays * 2);
  for (const ec of existingClusters) {
    if (new Date(ec.lastUpdated) < staleThreshold) {
      await updateSignalCluster(workspaceId, ec.id, { status: "stale" });
    }
  }

  return { clusters: results, totalCandidates: validClusters.length };
}
