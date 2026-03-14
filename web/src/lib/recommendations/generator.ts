import Anthropic from "@anthropic-ai/sdk";
import { getCurrentProbabilities } from "@/lib/db/probability";
import {
  insertRecommendation,
  getActiveRecommendationForAsset,
  listRecommendations,
} from "@/lib/db/graph-queries";

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6-20250415";

interface GeneratedRec {
  action: "BUY" | "SELL" | "HOLD" | "WATCH" | "AVOID";
  asset: string;
  conviction: number;
  timeframeDays: number;
  rationale: string;
  thesisId: number;
}

/**
 * Generate investment recommendations from active theses with strong signals.
 * Only considers theses with probability > 0.65 or < 0.35, or high momentum.
 */
export async function generateRecommendations() {
  const probabilities = await getCurrentProbabilities();

  // Filter to strong-signal theses
  const candidates = probabilities.filter(
    (t) =>
      t.probability > 0.65 ||
      t.probability < 0.35 ||
      Math.abs(t.momentum ?? 0) > 0.05
  );

  if (candidates.length === 0) {
    return { generated: 0, recommendations: [] };
  }

  // Check existing active recs to avoid redundancy
  const activeRecs = await listRecommendations({ status: "active" });
  const activeAssetActions = new Set(
    activeRecs.map((r) => `${r.asset}::${r.action}`)
  );

  const thesisContext = candidates
    .map(
      (t) =>
        `- Thesis #${t.thesisId}: "${t.title}" (direction: ${t.direction}, domain: ${t.domain})\n` +
        `  Probability: ${(t.probability * 100).toFixed(1)}%, Momentum: ${t.momentum !== null ? (t.momentum > 0 ? "+" : "") + (t.momentum * 100).toFixed(1) + "%" : "N/A"}, Signals: ${t.signalCount}`
    )
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are an investment analyst. Based on the following thesis probabilities and momentum, generate actionable investment recommendations.

Active theses with strong signals:
${thesisContext}

For each thesis that warrants action, produce a recommendation. Consider:
- High probability (>0.65) bullish theses → BUY related assets
- Low probability (<0.35) bullish theses → SELL/AVOID related assets
- High momentum → more urgent timeframes
- Cross-thesis patterns that reinforce or contradict

Respond with a JSON array of recommendations:
[{
  "action": "BUY" | "SELL" | "HOLD" | "WATCH" | "AVOID",
  "asset": "specific asset name (company, ETF, sector)",
  "conviction": 0.0-1.0,
  "timeframeDays": number (30-365),
  "rationale": "2-3 sentence explanation",
  "thesisId": number
}]

Only include recommendations where you have genuine conviction. Quality over quantity.
Respond with ONLY the JSON array, no other text.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  let recs: GeneratedRec[];
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    recs = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse LLM recommendations:", text);
    return { generated: 0, recommendations: [], error: "Parse failed" };
  }

  const created = [];
  for (const rec of recs) {
    // Dedup check
    if (activeAssetActions.has(`${rec.asset}::${rec.action}`)) {
      continue;
    }

    // Find matching thesis probability
    const thesis = candidates.find((t) => t.thesisId === rec.thesisId);

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + rec.timeframeDays);

    const inserted = await insertRecommendation({
      thesisId: rec.thesisId,
      action: rec.action,
      asset: rec.asset,
      conviction: Math.max(0, Math.min(1, rec.conviction)),
      timeframeDays: rec.timeframeDays,
      deadline,
      rationale: rec.rationale,
      probabilityAtCreation: thesis?.probability,
    });

    created.push(inserted);
  }

  return { generated: created.length, recommendations: created };
}
