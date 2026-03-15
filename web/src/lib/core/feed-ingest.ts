import {
  insertNewsEvent,
  listNewsEvents,
  markNewsProcessed,
  listTheses,
  upsertThesisInteraction,
  upsertEntity,
  createConnection,
  createEntityObservation,
} from "@/lib/db/graph-queries";
import { snapshotAllProbabilities } from "@/lib/db/probability";
import { computeSourceCredibility, getCredibilityForSource } from "@/lib/db/source-credibility";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

function stripCodeFences(text: string): string {
  text = text.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === "```") {
      lines.pop();
    }
    text = lines.join("\n");
  }
  return text.trim();
}

const GRAPH_EXTRACTION_PROMPT = `You are an expert investment analyst specializing in AI and technology sectors.

Analyze this news article and extract structured intelligence for an investment knowledge graph.

<article_title>{title}</article_title>
<article_content>{content}</article_content>

<active_theses>
{theses}
</active_theses>

Extract the following:

1. **AI Relevance** (1-5): How relevant is this to AI investment thesis?
2. **Sentiment**: "bullish", "bearish", or "neutral" for AI/tech investment
3. **Entities**: Structured list of companies, people, technologies, products, concepts, regulatory bodies mentioned. Include category and role.
4. **Entity Relations**: Relationships between entities mentioned in the article.
5. **Entity Observations**: Observable attributes or trends about entities from this article.
6. **Thesis Connections**: For each active thesis, does this article SUPPORT, CONTRADICT, or is it UNRELATED?
7. **Thesis Interactions**: Based on this article, do any of the active theses REINFORCE or CONTRADICT each other? Only include if the article provides evidence of a link between two theses.
8. **Key Insight**: 1-2 sentence summary of the investment implication

Respond ONLY with valid JSON:
{
  "ai_relevance": 1-5,
  "sentiment": "bullish|bearish|neutral",
  "entities": [
    { "name": "NVIDIA", "category": "company", "role": "SUBJECT" },
    { "name": "H100", "category": "product", "role": "MENTIONED" }
  ],
  "entity_relations": [
    { "from": "NVIDIA", "to": "TSMC", "relation": "DEPENDS_ON", "confidence": 0.9 }
  ],
  "entity_observations": [
    { "entity": "NVIDIA", "attribute": "hiring_trend", "value": "aggressive inference team expansion", "numericValue": null, "confidence": 0.8 }
  ],
  "thesis_connections": [
    {
      "thesis_id": 1,
      "relation": "SUPPORTS|CONTRADICTS|UNRELATED",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }
  ],
  "thesis_interactions": [
    {
      "thesis_a_id": 1,
      "thesis_b_id": 2,
      "relation": "REINFORCES|CONTRADICTS",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }
  ],
  "key_insight": "..."
}`;

/**
 * Processes unprocessed news events through LLM to extract graph connections.
 * Contains all business logic extracted from the POST /api/feed/ingest handler.
 */
export async function ingestNews(
  workspaceId: string,
  limit: number = 10
): Promise<{ processed: number; results: unknown[]; probabilitiesUpdated: number }> {
  // 1. Get unprocessed news events
  const unprocessed = await listNewsEvents(workspaceId, { unprocessedOnly: true, limit });
  if (unprocessed.length === 0) {
    return { processed: 0, results: [], probabilitiesUpdated: 0 };
  }

  // 2. Get active theses for context
  const theses = await listTheses(workspaceId, true);
  const thesesText = theses
    .map((t) => `ID ${t.id}: [${t.direction.toUpperCase()}] ${t.title} — ${t.description}`)
    .join("\n");

  // Pre-compute source credibility for confidence adjustments
  const credibilityMap = await computeSourceCredibility(workspaceId);

  const results = [];

  for (const event of unprocessed) {
    try {
      const content = (event.content || event.summary || event.title).substring(0, 4000);

      const prompt = GRAPH_EXTRACTION_PROMPT
        .replace("{title}", event.title)
        .replace("{content}", content)
        .replace("{theses}", thesesText || "No active theses yet.");

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      });

      const block = response.content[0];
      if (!block || block.type !== "text") {
        throw new Error("Claude returned no text content");
      }
      const cleanedRaw = stripCodeFences(block.text);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(cleanedRaw);
      } catch (e) {
        throw new Error(`Failed to parse Claude response: ${e instanceof Error ? e.message : e}`);
      }

      // 3. Extract entity names for backward compat storage
      const entityNames = (parsed.entities || []).map(
        (e: { name: string } | string) => (typeof e === "string" ? e : e.name)
      );

      // 4. Mark as processed with extracted metadata
      await markNewsProcessed(workspaceId, event.id, {
        aiRelevance: parsed.ai_relevance,
        sentiment: parsed.sentiment,
        extractedEntities: entityNames,
        extractedThesisIds: (parsed.thesis_connections || [])
          .filter((tc: { relation: string }) => tc.relation !== "UNRELATED")
          .map((tc: { thesis_id: number }) => tc.thesis_id),
      });

      // 5. Upsert entities and create news→entity connections
      const entityMap = new Map<string, number>(); // name → id
      for (const ent of parsed.entities || []) {
        const entityData = typeof ent === "string"
          ? { name: ent, type: "unknown", category: undefined }
          : { name: ent.name, type: ent.category || "unknown", category: ent.category };
        const entity = await upsertEntity(workspaceId, entityData);
        entityMap.set(entityData.name, entity.id);

        // Create news_event → entity MENTIONS connection
        const credibility = getCredibilityForSource(credibilityMap, event.source);
        await createConnection(workspaceId, {
          fromType: "news_event",
          fromId: event.id,
          toType: "entity",
          toId: entity.id,
          relation: "MENTIONS",
          confidence: 0.9 * credibility,
          reasoning: typeof ent === "string" ? undefined : `Role: ${ent.role}`,
          sourceNewsId: event.id,
        });
      }

      // 6. Create entity→entity connections
      for (const rel of parsed.entity_relations || []) {
        const fromId = entityMap.get(rel.from);
        const toId = entityMap.get(rel.to);
        if (fromId && toId) {
          await createConnection(workspaceId, {
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

      // 7. Create graph connections for relevant theses
      const relevantThesisIds = new Set<number>();
      for (const tc of parsed.thesis_connections || []) {
        if (tc.relation === "UNRELATED") continue;
        relevantThesisIds.add(tc.thesis_id);
        const credibility = getCredibilityForSource(credibilityMap, event.source);
        await createConnection(workspaceId, {
          fromType: "news_event",
          fromId: event.id,
          toType: "thesis",
          toId: tc.thesis_id,
          relation: tc.relation,
          direction: tc.direction,
          confidence: tc.confidence * credibility,
          reasoning: tc.reasoning,
          sourceNewsId: event.id,
        });
      }

      // 8. Create entity→thesis connections for entities in thesis-connected articles
      for (const [entityName, entityId] of entityMap) {
        for (const thesisId of relevantThesisIds) {
          const credibility = getCredibilityForSource(credibilityMap, event.source);
          await createConnection(workspaceId, {
            fromType: "entity",
            fromId: entityId,
            toType: "thesis",
            toId: thesisId,
            relation: "RELEVANT_TO",
            confidence: 0.6 * credibility,
            reasoning: `Entity "${entityName}" appeared in article connected to thesis`,
            sourceNewsId: event.id,
          });
        }
      }

      // 9. Create thesis↔thesis interactions
      for (const ti of parsed.thesis_interactions || []) {
        if (!ti.thesis_a_id || !ti.thesis_b_id) continue;
        await upsertThesisInteraction(workspaceId, {
          thesisAId: ti.thesis_a_id,
          thesisBId: ti.thesis_b_id,
          relation: ti.relation,
          confidence: ti.confidence,
          reasoning: ti.reasoning,
          sourceNewsId: event.id,
        });
      }

      // 10. Insert entity observations
      for (const obs of parsed.entity_observations || []) {
        const entityId = entityMap.get(obs.entity);
        if (!entityId) continue;
        await createEntityObservation(workspaceId, {
          entityId,
          attribute: obs.attribute,
          value: obs.value,
          numericValue: obs.numericValue ?? undefined,
          confidence: obs.confidence || 0.5,
          sourceNewsId: event.id,
          observedAt: event.publishedAt ?? new Date(),
        });
      }

      results.push({
        id: event.id,
        title: event.title,
        aiRelevance: parsed.ai_relevance,
        sentiment: parsed.sentiment,
        entities: entityNames.length,
        entityRelations: (parsed.entity_relations || []).length,
        connections: (parsed.thesis_connections || []).filter(
          (tc: { relation: string }) => tc.relation !== "UNRELATED"
        ).length,
        thesisInteractions: (parsed.thesis_interactions || []).length,
        observations: (parsed.entity_observations || []).length,
      });
    } catch (err) {
      console.error(`Failed to process news event ${event.id}:`, err);
      // Mark as processed anyway to avoid infinite loop
      await markNewsProcessed(workspaceId, event.id, { aiRelevance: 0 });
    }
  }

  // After processing news, recompute thesis probabilities
  let probabilities: Awaited<ReturnType<typeof snapshotAllProbabilities>> = [];
  if (results.length > 0) {
    try {
      probabilities = await snapshotAllProbabilities(workspaceId);
    } catch (err) {
      console.error("Failed to compute probabilities:", err);
    }
  }

  return { processed: results.length, results, probabilitiesUpdated: probabilities.length };
}
