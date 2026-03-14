import Anthropic from "@anthropic-ai/sdk";
import {
  getExpiredRecommendations,
  resolveRecommendation,
} from "@/lib/db/graph-queries";
import { getCurrentProbabilities } from "@/lib/db/probability";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250415";

interface EvaluationResult {
  id: number;
  status: string;
  brierScore: number;
  outcomeNotes: string;
}

/**
 * Evaluate all expired recommendations.
 * Uses LLM to judge outcome based on current thesis state and signals.
 * Computes Brier score: (conviction - outcome)^2
 */
export async function evaluateExpiredRecs(): Promise<{
  evaluated: number;
  results: EvaluationResult[];
}> {
  const expired = await getExpiredRecommendations();

  if (expired.length === 0) {
    return { evaluated: 0, results: [] };
  }

  const currentProbs = await getCurrentProbabilities();
  const probMap = new Map(currentProbs.map((p) => [p.thesisId, p]));

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const results: EvaluationResult[] = [];

  for (const rec of expired) {
    const thesisProb = rec.thesisId ? probMap.get(rec.thesisId) : null;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Evaluate whether this investment recommendation was correct.

Recommendation (created ${rec.createdAt.toISOString()}):
- Action: ${rec.action} ${rec.asset}
- Conviction: ${(rec.conviction * 100).toFixed(0)}%
- Timeframe: ${rec.timeframeDays} days (deadline: ${rec.deadline.toISOString()})
- Rationale: ${rec.rationale}
- Probability at creation: ${rec.probabilityAtCreation !== null ? (rec.probabilityAtCreation! * 100).toFixed(1) + "%" : "N/A"}

Current thesis state:
${thesisProb ? `- Current probability: ${(thesisProb.probability * 100).toFixed(1)}%\n- Momentum: ${thesisProb.momentum !== null ? (thesisProb.momentum > 0 ? "+" : "") + (thesisProb.momentum * 100).toFixed(1) + "%" : "N/A"}` : "- Thesis no longer active or not linked"}

Respond with JSON:
{
  "correct": true/false,
  "confidence": 0.0-1.0,
  "notes": "1-2 sentence explanation"
}

Respond with ONLY the JSON, no other text.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let evaluation: { correct: boolean; confidence: number; notes: string };
    try {
      const cleaned = text
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      evaluation = JSON.parse(cleaned);
    } catch {
      console.error(`Failed to parse evaluation for rec #${rec.id}:`, text);
      evaluation = {
        correct: false,
        confidence: 0.5,
        notes: "Evaluation parse failed",
      };
    }

    const outcome = evaluation.correct ? 1 : 0;
    const brierScore = Math.pow(rec.conviction - outcome, 2);
    const status = evaluation.correct
      ? "resolved_correct"
      : "resolved_incorrect";

    await resolveRecommendation(rec.id, {
      status,
      outcomeNotes: evaluation.notes,
      brierScore,
      probabilityAtResolution: thesisProb?.probability,
    });

    results.push({
      id: rec.id,
      status,
      brierScore,
      outcomeNotes: evaluation.notes,
    });
  }

  return { evaluated: results.length, results };
}
