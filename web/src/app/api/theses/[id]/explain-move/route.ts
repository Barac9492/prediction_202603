import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getThesis, getRecentSnapshotsForThesis, getConnectionsBetweenDates } from "@/lib/db/graph-queries";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thesisId = Number(id);
  const workspaceId = await getWorkspaceId();

  const thesis = await getThesis(workspaceId, thesisId);
  if (!thesis) {
    return NextResponse.json({ error: "Thesis not found" }, { status: 404 });
  }

  const snapshots = await getRecentSnapshotsForThesis(workspaceId, thesisId, 2);
  if (snapshots.length < 2) {
    return NextResponse.json({
      summary: "Not enough probability snapshots to explain a move. At least two pipeline runs are needed.",
      factors: [],
    });
  }

  const [current, previous] = snapshots; // ordered by desc
  const newConnections = await getConnectionsBetweenDates(
    workspaceId,
    thesisId,
    previous.computedAt,
    current.computedAt
  );

  const prevProb = Math.round(previous.probability * 100);
  const currProb = Math.round(current.probability * 100);
  const delta = currProb - prevProb;

  if (newConnections.length === 0 && Math.abs(delta) < 1) {
    return NextResponse.json({
      summary: `Probability held steady at ${currProb}% with no new signals between snapshots.`,
      factors: [],
    });
  }

  const signalsStr = newConnections
    .map((c) => {
      const newsTitle = c.news?.title ?? "Unknown signal";
      const source = c.news?.source ?? "";
      return `- Signal: "${newsTitle}" (source: ${source}, direction: ${c.direction ?? "neutral"}, weight: ${c.weight}, confidence: ${c.confidence.toFixed(2)}, relation: ${c.relation})`;
    })
    .join("\n");

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `Thesis: "${thesis.title}" (${thesis.direction})
Probability moved from ${prevProb}% to ${currProb}% (${delta > 0 ? "+" : ""}${delta}pp).

New signals in this window:
${signalsStr || "No new direct signals (move may be from decay or cross-thesis effects)"}

Explain this probability move. Return JSON:
{
  "summary": "<2-3 sentence explanation of the overall move>",
  "factors": [
    {"signal": "<signal name>", "direction": "bullish|bearish|neutral", "impact": <estimated pp impact as number>, "reasoning": "<1 sentence>"}
  ]
}

If no signals, explain that the move is likely from time decay on existing signals or cross-thesis influence. Keep impact estimates consistent with the total move of ${delta}pp.`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";

  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    return NextResponse.json({
      summary: parsed.summary ?? "",
      factors: Array.isArray(parsed.factors) ? parsed.factors : [],
    });
  } catch {
    return NextResponse.json({
      summary: raw,
      factors: [],
    });
  }
}
