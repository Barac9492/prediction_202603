import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listNewsEvents, createThesis, listTheses } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250415";

const SUGGEST_PROMPT = `You are an expert investment analyst specializing in AI and technology.

Below are recent AI-related news headlines and summaries from the past few days.
Also shown are existing investment theses already being tracked (so you don't duplicate them).

<recent_news>
{news}
</recent_news>

<existing_theses>
{existing}
</existing_theses>

Based on the news, identify 3-5 new, distinct investment theses that:
1. Are NOT already covered by existing theses (avoid duplicates)
2. Are grounded in specific signals from the news — not generic claims
3. Have clear investment implications (bullish/bearish/neutral on AI)
4. Are specific enough to be falsifiable — i.e., something you could track and backtest

For each thesis, provide:
- title: short (< 10 words), memorable name
- description: 2-3 sentences explaining the thesis and its implications
- direction: "bullish" | "bearish" | "neutral"
- tags: 2-4 relevant tags (companies, technologies, themes)
- aiRationale: 1-2 sentences explaining why the current news supports proposing this thesis now

Respond ONLY with valid JSON array:
[
  {
    "title": "...",
    "description": "...",
    "direction": "bullish|bearish|neutral",
    "tags": ["...", "..."],
    "aiRationale": "..."
  }
]
`;

/** POST /api/theses/suggest
 * Reads recent processed news, asks Claude to propose new theses,
 * stores them as status="pending_review" for user approval.
 */
export async function POST() {
  // 1. Get recent processed news (last 50 items)
  const recentNews = await listNewsEvents({ limit: 50 });
  const processedNews = recentNews.filter((n) => n.processed && n.aiRelevance && n.aiRelevance >= 3);

  if (processedNews.length < 3) {
    return NextResponse.json(
      { error: "Not enough processed news yet. Process some articles first." },
      { status: 400 }
    );
  }

  // 2. Get existing active theses to avoid duplicates
  const existing = await listTheses(true);

  // 3. Build prompts
  const newsText = processedNews
    .slice(0, 30)
    .map((n) => `[${n.source}] ${n.title} — ${n.summary?.slice(0, 200) ?? ""} (sentiment: ${n.sentiment ?? "?"})`)
    .join("\n");

  const existingText = existing.length > 0
    ? existing.map((t) => `- ${t.title}: ${t.description}`).join("\n")
    : "None yet.";

  const prompt = SUGGEST_PROMPT
    .replace("{news}", newsText)
    .replace("{existing}", existingText);

  // 4. Call Claude
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    return NextResponse.json({ error: "Claude returned no text content" }, { status: 500 });
  }
  const raw = block.text;
  let suggestions: Array<{
    title: string;
    description: string;
    direction: string;
    tags: string[];
    aiRationale: string;
  }>;

  try {
    suggestions = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch {
    return NextResponse.json({ error: "Failed to parse Claude response", raw }, { status: 500 });
  }

  // 5. Store each as pending_review
  const created = [];
  for (const s of suggestions) {
    const thesis = await createThesis({
      title: s.title,
      description: s.description,
      direction: s.direction,
      domain: "AI",
      tags: s.tags ?? [],
      status: "pending_review",
      aiRationale: s.aiRationale,
    });
    created.push(thesis);
  }

  return NextResponse.json({ suggested: created.length, theses: created });
}
