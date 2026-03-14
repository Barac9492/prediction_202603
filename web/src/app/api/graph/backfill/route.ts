import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  newsEvents,
  connections,
} from "@/lib/db/schema";
import {
  listTheses,
  upsertEntity,
  createConnection,
  createEntityObservation,
  upsertThesisInteraction,
  markNewsProcessed,
} from "@/lib/db/graph-queries";
import { eq, and, desc, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const client = new Anthropic();

const BACKFILL_PROMPT = `You are an expert investment analyst specializing in AI and technology sectors.

Analyze this news article and extract structured intelligence for an investment knowledge graph.

<article_title>{title}</article_title>
<article_content>{content}</article_content>

<active_theses>
{theses}
</active_theses>

Extract structured entities, their relationships, and observations.

Respond ONLY with valid JSON:
{
  "entities": [
    { "name": "NVIDIA", "category": "company", "role": "SUBJECT" }
  ],
  "entity_relations": [
    { "from": "NVIDIA", "to": "TSMC", "relation": "DEPENDS_ON", "confidence": 0.9 }
  ],
  "entity_observations": [
    { "entity": "NVIDIA", "attribute": "hiring_trend", "value": "expanding", "numericValue": null, "confidence": 0.8 }
  ],
  "thesis_connections": [
    {
      "thesis_id": 1,
      "relation": "SUPPORTS|CONTRADICTS|UNRELATED",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const { batchSize = 10 } = await req.json().catch(() => ({}));

  // Get processed news events that don't yet have entity connections
  const processedEvents = await db
    .select()
    .from(newsEvents)
    .where(eq(newsEvents.processed, true))
    .orderBy(desc(newsEvents.ingestedAt))
    .limit(200);

  // Find which events already have entity connections
  const eventsWithEntityConns = await db
    .select({ sourceNewsId: connections.sourceNewsId })
    .from(connections)
    .where(eq(connections.toType, "entity"));
  const alreadyBackfilled = new Set(
    eventsWithEntityConns.map((c) => c.sourceNewsId).filter((id): id is number => id !== null)
  );

  const toProcess = processedEvents
    .filter((e) => !alreadyBackfilled.has(e.id))
    .slice(0, batchSize);

  if (toProcess.length === 0) {
    return NextResponse.json({
      processed: 0,
      message: "All processed events already have entity connections",
      totalProcessed: processedEvents.length,
      alreadyBackfilled: alreadyBackfilled.size,
    });
  }

  const theses = await listTheses(true);
  const thesesText = theses
    .map((t) => `ID ${t.id}: [${t.direction.toUpperCase()}] ${t.title} — ${t.description}`)
    .join("\n");

  const results = [];

  for (const event of toProcess) {
    try {
      const content = (event.content || event.summary || event.title).substring(0, 4000);
      const prompt = BACKFILL_PROMPT
        .replace("{title}", event.title)
        .replace("{content}", content)
        .replace("{theses}", thesesText || "No active theses yet.");

      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

      // Upsert entities and create connections
      const entityMap = new Map<string, number>();
      for (const ent of parsed.entities || []) {
        const entityData = typeof ent === "string"
          ? { name: ent, type: "unknown" }
          : { name: ent.name, type: ent.category || "unknown", category: ent.category };
        const entity = await upsertEntity(entityData);
        entityMap.set(entityData.name, entity.id);

        await createConnection({
          fromType: "news_event",
          fromId: event.id,
          toType: "entity",
          toId: entity.id,
          relation: "MENTIONS",
          confidence: 0.9,
          reasoning: typeof ent === "string" ? undefined : `Role: ${ent.role}`,
          sourceNewsId: event.id,
        });
      }

      // Entity→entity connections
      for (const rel of parsed.entity_relations || []) {
        const fromId = entityMap.get(rel.from);
        const toId = entityMap.get(rel.to);
        if (fromId && toId) {
          await createConnection({
            fromType: "entity",
            fromId,
            toType: "entity",
            toId,
            relation: rel.relation,
            confidence: rel.confidence || 0.7,
            sourceNewsId: event.id,
          });
        }
      }

      // Entity→thesis connections
      const relevantThesisIds = new Set<number>();
      for (const tc of parsed.thesis_connections || []) {
        if (tc.relation === "UNRELATED") continue;
        relevantThesisIds.add(tc.thesis_id);
      }
      for (const [entityName, entityId] of entityMap) {
        for (const thesisId of relevantThesisIds) {
          await createConnection({
            fromType: "entity",
            fromId: entityId,
            toType: "thesis",
            toId: thesisId,
            relation: "RELEVANT_TO",
            confidence: 0.6,
            reasoning: `Entity "${entityName}" appeared in article connected to thesis`,
            sourceNewsId: event.id,
          });
        }
      }

      // Entity observations
      for (const obs of parsed.entity_observations || []) {
        const entityId = entityMap.get(obs.entity);
        if (!entityId) continue;
        await createEntityObservation({
          entityId,
          attribute: obs.attribute,
          value: obs.value,
          numericValue: obs.numericValue ?? undefined,
          confidence: obs.confidence || 0.5,
          sourceNewsId: event.id,
          observedAt: event.publishedAt ?? new Date(),
        });
      }

      // Update extractedEntities on the news event if empty
      const entityNames = [...entityMap.keys()];
      if (!event.extractedEntities || (event.extractedEntities as string[]).length === 0) {
        await markNewsProcessed(event.id, { extractedEntities: entityNames });
      }

      results.push({
        id: event.id,
        title: event.title,
        entities: entityNames.length,
        relations: (parsed.entity_relations || []).length,
        observations: (parsed.entity_observations || []).length,
      });
    } catch (err) {
      console.error(`Backfill failed for event ${event.id}:`, err);
      results.push({ id: event.id, title: event.title, error: String(err) });
    }
  }

  return NextResponse.json({
    processed: results.length,
    remaining: toProcess.length - results.length,
    totalEligible: processedEvents.length - alreadyBackfilled.size,
    results,
  });
}
