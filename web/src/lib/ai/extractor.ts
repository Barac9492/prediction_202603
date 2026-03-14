import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_PROMPT } from "./prompt";
import { Signal, ExtractionResult, SourceData } from "../core/types";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250415";

function stripCodeFences(text: string): string {
  text = text.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    lines.shift(); // remove opening fence
    if (lines.length && lines[lines.length - 1].trim() === "```") {
      lines.pop(); // remove closing fence
    }
    text = lines.join("\n");
  }
  return text.trim();
}

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
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const raw = stripCodeFences(block.text);

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Failed to parse Claude response as JSON: ${e instanceof Error ? e.message : e}\nRaw: ${raw.slice(0, 500)}`
    );
  }

  const signals: Signal[] = ((data.signals as Array<Record<string, unknown>>) ?? []).map(
    (s) => ({
      description: String(s.description ?? ""),
      direction: String(s.direction ?? "neutral") as Signal["direction"],
      strength: Number(s.strength ?? 1),
      reasoning: String(s.reasoning ?? ""),
      sourceTitle: source.title,
    })
  );

  return {
    signals,
    sourceSummary: String(data.source_summary ?? ""),
    relevanceScore: Number(data.relevance_score ?? 3),
  };
}
