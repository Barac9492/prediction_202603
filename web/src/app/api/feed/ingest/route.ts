import { NextRequest, NextResponse } from "next/server";
import { insertNewsEvent, listNewsEvents, markNewsProcessed, listTheses } from "@/lib/db/graph-queries";
import { snapshotAllProbabilities } from "@/lib/db/probability";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250415";

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
3. **Entities Mentioned**: List of specific companies, models, technologies, people. Use exact names.
4. **Thesis Connections**: For each active thesis, does this article SUPPORT, CONTRADICT, or is it UNRELATED?
5. **Key Insight**: 1-2 sentence summary of the investment implication

Respond ONLY with valid JSON:
{
  "ai_relevance": 1-5,
  "sentiment": "bullish|bearish|neutral",
  "entities": ["OpenAI", "NVIDIA", "GPT-4", ...],
  "thesis_connections": [
    {
      "thesis_id": 1,
      "relation": "SUPPORTS|CONTRADICTS|UNRELATED",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "..."
    }
  ],
  "key_insight": "..."
}`;

/** POST /api/feed/ingest
 * Processes unprocessed news events through LLM to extract graph connections.
 * Call this periodically (e.g., via cron or manual trigger).
 */
export async function POST(req: NextRequest) {
  const { limit = 10 } = await req.json().catch(() => ({}));

  // 1. Get unprocessed news events
  const unprocessed = await listNewsEvents({ unprocessedOnly: true, limit });
  if (unprocessed.length === 0) {
    return NextResponse.json({ processed: 0, message: "No unprocessed events" });
  }

  // 2. Get active theses for context
  const theses = await listTheses(true);
  const thesesText = theses
    .map((t) => `ID ${t.id}: [${t.direction.toUpperCase()}] ${t.title} — ${t.description}`)
    .join("\n");

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
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(cleanedRaw);
      } catch (e) {
        throw new Error(`Failed to parse Claude response: ${e instanceof Error ? e.message : e}`);
      }

      // 3. Mark as processed with extracted metadata
      await markNewsProcessed(event.id, {
        aiRelevance: parsed.ai_relevance,
        sentiment: parsed.sentiment,
        extractedEntities: parsed.entities || [],
        extractedThesisIds: (parsed.thesis_connections || [])
          .filter((tc: { relation: string }) => tc.relation !== "UNRELATED")
          .map((tc: { thesis_id: number }) => tc.thesis_id),
      });

      // 4. Create graph connections for relevant theses
      const { createConnection } = await import("@/lib/db/graph-queries");
      for (const tc of parsed.thesis_connections || []) {
        if (tc.relation === "UNRELATED") continue;
        await createConnection({
          fromType: "news_event",
          fromId: event.id,
          toType: "thesis",
          toId: tc.thesis_id,
          relation: tc.relation,
          direction: tc.direction,
          confidence: tc.confidence,
          reasoning: tc.reasoning,
          sourceNewsId: event.id,
        });
      }

      results.push({
        id: event.id,
        title: event.title,
        aiRelevance: parsed.ai_relevance,
        sentiment: parsed.sentiment,
        connections: (parsed.thesis_connections || []).filter(
          (tc: { relation: string }) => tc.relation !== "UNRELATED"
        ).length,
      });
    } catch (err) {
      console.error(`Failed to process news event ${event.id}:`, err);
      // Mark as processed anyway to avoid infinite loop
      await markNewsProcessed(event.id, { aiRelevance: 0 });
    }
  }

  // After processing news, recompute thesis probabilities
  let probabilities: Awaited<ReturnType<typeof snapshotAllProbabilities>> = [];
  if (results.length > 0) {
    try {
      probabilities = await snapshotAllProbabilities();
    } catch (err) {
      console.error("Failed to compute probabilities:", err);
    }
  }

  return NextResponse.json({ processed: results.length, results, probabilitiesUpdated: probabilities.length });
}

/** GET /api/feed/ingest - Returns unprocessed count */
export async function GET() {
  const unprocessed = await listNewsEvents({ unprocessedOnly: true, limit: 1000 });
  const recent = await listNewsEvents({ limit: 20 });
  return NextResponse.json({
    unprocessedCount: unprocessed.length,
    recentEvents: recent,
  });
}
