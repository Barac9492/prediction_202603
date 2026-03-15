import Anthropic from "@anthropic-ai/sdk";
import { getCurrentProbabilities } from "@/lib/db/probability";
import { upsertThesisInteraction } from "@/lib/db/graph-queries";

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

export async function detectThesisInteractions(workspaceId: string) {
  const theses = await getCurrentProbabilities(workspaceId);
  if (theses.length < 2) return { detected: 0, interactions: [] };

  const thesesContext = theses
    .map(
      (t) =>
        `ID:${t.thesisId} "${t.title}" (${t.direction}, ${t.domain}, ${Math.round(t.probability * 100)}%)`
    )
    .join("\n");

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Analyze these investment theses and identify REINFORCES and CONTRADICTS relationships between them. Only include relationships where there is a clear logical connection.

THESES:
${thesesContext}

Return JSON array:
[{"thesis_a_id": <number>, "thesis_b_id": <number>, "relation": "REINFORCES"|"CONTRADICTS", "confidence": <0.0-1.0>, "reasoning": "<one sentence>"}]

Rules:
- Only include pairs with genuine logical connections
- confidence should reflect strength of the relationship
- REINFORCES: if thesis A being true makes thesis B more likely
- CONTRADICTS: if thesis A being true makes thesis B less likely
- Return [] if no clear interactions exist`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "[]";
  let interactions: Array<{
    thesis_a_id: number;
    thesis_b_id: number;
    relation: string;
    confidence: number;
    reasoning: string;
  }>;

  try {
    interactions = JSON.parse(stripCodeFences(raw));
  } catch {
    return { detected: 0, interactions: [], error: "Failed to parse LLM response" };
  }

  if (!Array.isArray(interactions)) {
    return { detected: 0, interactions: [] };
  }

  const validThesisIds = new Set(theses.map((t) => t.thesisId));
  const results = [];

  for (const ix of interactions) {
    if (
      !validThesisIds.has(ix.thesis_a_id) ||
      !validThesisIds.has(ix.thesis_b_id) ||
      ix.thesis_a_id === ix.thesis_b_id
    )
      continue;
    if (ix.relation !== "REINFORCES" && ix.relation !== "CONTRADICTS") continue;

    try {
      await upsertThesisInteraction(workspaceId, {
        thesisAId: ix.thesis_a_id,
        thesisBId: ix.thesis_b_id,
        relation: ix.relation,
        confidence: Math.max(0, Math.min(1, ix.confidence)),
        reasoning: ix.reasoning,
      });
      results.push(ix);
    } catch (err) {
      // Skip invalid interactions
    }
  }

  return { detected: results.length, interactions: results };
}
