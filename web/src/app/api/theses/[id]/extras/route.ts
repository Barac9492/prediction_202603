import { NextRequest, NextResponse } from "next/server";
import { getThesisInteractions, getMarketSignals } from "@/lib/db/graph-queries";
import { computeThesisProbability } from "@/lib/db/probability";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const thesisId = parseInt(id, 10);
  if (isNaN(thesisId)) {
    return NextResponse.json({ error: "Invalid thesis ID" }, { status: 400 });
  }

  const [interactions, marketSignals, prob] = await Promise.all([
    getThesisInteractions(thesisId),
    getMarketSignals(thesisId),
    computeThesisProbability(thesisId),
  ]);

  // Compute market consensus as average confidence of market connections
  let marketProbability: number | null = null;
  if (marketSignals.length > 0) {
    marketProbability =
      marketSignals.reduce((sum, ms) => sum + ms.confidence, 0) / marketSignals.length;
  }

  return NextResponse.json({
    interactions,
    marketSignals,
    modelProbability: prob.probability,
    marketProbability,
  });
}
