import { NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/db/workspace";
import { getCurrentProbabilities } from "@/lib/db/probability";
import {
  getExpiringSoonRecommendations,
  getContradictingEvidence,
} from "@/lib/db/graph-queries";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

export const dynamic = "force-dynamic";

export async function POST() {
  const workspaceId = await getWorkspaceId();

  const [theses, expiring] = await Promise.all([
    getCurrentProbabilities(workspaceId),
    getExpiringSoonRecommendations(workspaceId, 7),
  ]);

  // Biggest movers
  const movers = [...theses]
    .filter((t) => t.momentum !== null)
    .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))
    .slice(0, 10);

  // High-conviction contradictions
  const highConviction = theses
    .filter((t) => t.probability > 0.75 || t.probability < 0.25)
    .map((t) => ({ thesisId: t.thesisId, direction: t.direction }));
  const contradictions = await getContradictingEvidence(workspaceId, highConviction);

  const thesesSummary = theses
    .map((t) => `- ${t.title}: ${Math.round(t.probability * 100)}% (${t.direction}, momentum: ${t.momentum !== null ? (t.momentum > 0 ? "+" : "") + (t.momentum * 100).toFixed(1) + "pp" : "n/a"})`)
    .join("\n");

  const expiringStr = expiring.length > 0
    ? expiring.map((r) => `- ${r.action} ${r.asset} (conviction: ${(r.conviction * 100).toFixed(0)}%, deadline: ${r.deadline ? new Date(r.deadline).toLocaleDateString() : "none"})`).join("\n")
    : "None";

  const moversStr = movers.length > 0
    ? movers.map((m) => `- ${m.title}: ${(m.momentum! * 100).toFixed(1)}pp move → now ${Math.round(m.probability * 100)}%`).join("\n")
    : "None";

  const contradictionStr = contradictions.length > 0
    ? contradictions.map((c) => {
        const thesis = theses.find((t) => t.thesisId === c.thesisId);
        return `- ${thesis?.title ?? "Unknown"} (${Math.round((thesis?.probability ?? 0.5) * 100)}%) contradicted by: ${c.newsTitle}`;
      }).join("\n")
    : "None";

  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a senior investment analyst writing a morning briefing. Based on the data below, write a concise 3-paragraph briefing (~150 words total):

Paragraph 1: Overnight movers and why they moved.
Paragraph 2: What needs attention (expiring recommendations, contradictions).
Paragraph 3: Recommended focus for today.

CURRENT THESES:
${thesesSummary}

BIGGEST MOVERS:
${moversStr}

EXPIRING RECOMMENDATIONS:
${expiringStr}

CONTRADICTING EVIDENCE:
${contradictionStr}

Write in a direct, professional tone. No bullet points — flowing paragraphs only. If there's limited data, acknowledge it briefly and focus on what's available.`,
      },
    ],
  });

  const narrative =
    msg.content[0].type === "text" ? msg.content[0].text : "";

  return NextResponse.json({
    narrative,
    generatedAt: new Date().toISOString(),
  });
}
