import Anthropic from "@anthropic-ai/sdk";
import { getOverdueTheses, getThesisConnections } from "@/lib/db/graph-queries";

const client = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```json")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

export async function checkThesisDeadlines(workspaceId: string) {
  const overdue = await getOverdueTheses(workspaceId);
  if (overdue.length === 0) return { checked: 0, suggestions: [] };

  const suggestions = [];

  for (const thesis of overdue) {
    const connections = await getThesisConnections(workspaceId, thesis.id);
    const recentSignals = connections.slice(0, 10);

    const signalsStr = recentSignals
      .map((c) => `- ${c.relation} (${c.direction ?? "neutral"}, weight: ${c.weight}, confidence: ${c.confidence.toFixed(2)})${c.reasoning ? `: ${c.reasoning}` : ""}`)
      .join("\n");

    try {
      const msg = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `Thesis: "${thesis.title}"
Direction: ${thesis.direction}
Domain: ${thesis.domain}
Deadline: ${thesis.deadline ? new Date(thesis.deadline).toLocaleDateString() : "unknown"}
Resolution Criteria: ${thesis.resolutionCriteria || "Not specified"}
Description: ${thesis.description || "Not specified"}

Recent evidence (${recentSignals.length} signals):
${signalsStr || "No signals"}

This thesis is past its deadline. Should it be resolved? Return JSON:
{
  "should_resolve": true/false,
  "suggested_outcome": "correct"|"incorrect"|"inconclusive",
  "confidence": 0.0-1.0,
  "reasoning": "<2-3 sentences>",
  "key_evidence": "<most important signal or observation>"
}`,
          },
        ],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
      const parsed = JSON.parse(stripCodeFences(raw));
      suggestions.push({
        thesisId: thesis.id,
        title: thesis.title,
        direction: thesis.direction,
        domain: thesis.domain,
        deadline: thesis.deadline,
        daysOverdue: Math.floor((Date.now() - new Date(thesis.deadline!).getTime()) / (1000 * 60 * 60 * 24)),
        shouldResolve: parsed.should_resolve ?? false,
        suggestedOutcome: parsed.suggested_outcome ?? "inconclusive",
        confidence: parsed.confidence ?? 0,
        reasoning: parsed.reasoning ?? "",
        keyEvidence: parsed.key_evidence ?? "",
      });
    } catch {
      suggestions.push({
        thesisId: thesis.id,
        title: thesis.title,
        direction: thesis.direction,
        domain: thesis.domain,
        deadline: thesis.deadline,
        daysOverdue: Math.floor((Date.now() - new Date(thesis.deadline!).getTime()) / (1000 * 60 * 60 * 24)),
        shouldResolve: false,
        suggestedOutcome: "inconclusive" as const,
        confidence: 0,
        reasoning: "Failed to analyze",
        keyEvidence: "",
      });
    }
  }

  return { checked: overdue.length, suggestions };
}
