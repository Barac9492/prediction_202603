import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_PROMPT } from "./prompt";
import { Signal, ExtractionResult, SourceData } from "../core/types";

export async function extractSignals(
  source: SourceData,
  topic: string
): Promise<ExtractionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Truncate content to stay under token limits
  const content = source.content.slice(0, 15000);
  const prompt = EXTRACTION_PROMPT.replace("{topic}", topic).replace(
    "{content}",
    content
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250415",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  let raw = (response.content[0] as { type: "text"; text: string }).text.trim();
  // Strip markdown fences if present
  if (raw.startsWith("```")) {
    raw = raw.split("\n").slice(1).join("\n").replace(/```\s*$/, "");
  }

  const data = JSON.parse(raw);

  const signals: Signal[] = data.signals.map(
    (s: { description: string; direction: string; strength: number; reasoning: string }) => ({
      description: s.description,
      direction: s.direction as Signal["direction"],
      strength: s.strength,
      reasoning: s.reasoning,
      sourceTitle: source.title,
    })
  );

  return {
    signals,
    sourceSummary: data.source_summary || "",
    relevanceScore: data.relevance_score || 3,
  };
}
