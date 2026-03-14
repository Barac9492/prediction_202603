import Anthropic from "@anthropic-ai/sdk";
import {
  getExpiredRecommendations,
  resolveRecommendation,
  getThesisConnections,
  reinforceConnection,
} from "@/lib/db/graph-queries";
import { getCurrentProbabilities } from "@/lib/db/probability";
import { fetchPrice } from "@/lib/markets/yahoo";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";

async function reinforceThesisConnections(thesisId: number, wasCorrect: boolean) {
  const thesisConns = await getThesisConnections(thesisId);
  for (const conn of thesisConns) {
    await reinforceConnection(conn.id, wasCorrect);
  }
}

interface EvaluationResult {
  id: number;
  status: string;
  brierScore: number;
  outcomeNotes: string;
  actualReturn?: number;
}

/**
 * Evaluate all expired recommendations.
 * Uses real price data for BUY/SELL/AVOID recs with tickers.
 * Falls back to LLM for HOLD/WATCH or recs without tickers.
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
    const hasPriceData = rec.ticker && rec.priceAtCreation;
    const isPriceAction = ["BUY", "SELL", "AVOID"].includes(rec.action);

    // Price-based evaluation for BUY/SELL/AVOID with ticker data
    if (hasPriceData && isPriceAction) {
      let priceAtResolution: number | undefined;
      try {
        const priceData = await fetchPrice(rec.ticker!);
        if (priceData) {
          priceAtResolution = priceData.price;
        }
      } catch (err) {
        console.error(`Price fetch failed for ${rec.ticker}:`, err);
      }

      if (priceAtResolution !== undefined) {
        const actualReturn =
          (priceAtResolution - rec.priceAtCreation!) / rec.priceAtCreation!;

        let correct: boolean;
        if (rec.action === "BUY") {
          correct = actualReturn > 0;
        } else {
          // SELL or AVOID: correct if price went down
          correct = actualReturn < 0;
        }

        const outcome = correct ? 1 : 0;
        const brierScore = Math.pow(rec.conviction - outcome, 2);
        const status = correct ? "resolved_correct" : "resolved_incorrect";
        const returnPct = (actualReturn * 100).toFixed(2);
        const outcomeNotes = `${rec.ticker}: $${rec.priceAtCreation!.toFixed(2)} → $${priceAtResolution.toFixed(2)} (${actualReturn > 0 ? "+" : ""}${returnPct}%)`;

        await resolveRecommendation(rec.id, {
          status,
          outcomeNotes,
          brierScore,
          probabilityAtResolution: thesisProb?.probability,
          priceAtResolution,
          actualReturn,
        });

        if (rec.thesisId) {
          await reinforceThesisConnections(rec.thesisId, correct);
        }

        results.push({
          id: rec.id,
          status,
          brierScore,
          outcomeNotes,
          actualReturn,
        });
        continue;
      }
    }

    // LLM fallback for HOLD/WATCH or recs without price data
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

    if (rec.thesisId) {
      await reinforceThesisConnections(rec.thesisId, evaluation.correct);
    }

    results.push({
      id: rec.id,
      status,
      brierScore,
      outcomeNotes: evaluation.notes,
    });
  }

  return { evaluated: results.length, results };
}
