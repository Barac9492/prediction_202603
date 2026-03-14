import { NextResponse } from "next/server";
import { matchThesesToMarkets } from "@/lib/markets/fetcher";
import { listTheses, createConnection, insertNewsEvent } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const activeTheses = await listTheses(true);
    if (activeTheses.length === 0) {
      return NextResponse.json({ matched: 0, message: "No active theses" });
    }

    const thesesData = activeTheses.map((t) => ({
      id: t.id,
      title: t.title,
      tags: (t.tags as string[]) ?? [],
    }));

    const matches = await matchThesesToMarkets(thesesData);
    const results = [];

    for (const [thesisId, markets] of matches) {
      for (const market of markets) {
        // Store market data as a news event with source="polymarket"
        const newsEvent = await insertNewsEvent({
          title: market.title,
          url: market.url,
          source: "polymarket",
          summary: `Market probability: ${(market.probability * 100).toFixed(1)}% | Volume: $${market.volume.toLocaleString()}`,
        });

        // Create connection from market to thesis
        const newsId = newsEvent?.id;
        await createConnection({
          fromType: "market",
          fromId: newsId ?? 0,
          toType: "thesis",
          toId: thesisId,
          relation: "MARKET_SIGNAL",
          confidence: market.probability,
          weight: 1.0,
          reasoning: `Polymarket: "${market.title}" at ${(market.probability * 100).toFixed(1)}% (volume: $${market.volume.toLocaleString()})`,
          sourceNewsId: newsId ?? undefined,
        });

        results.push({
          thesisId,
          market: market.title,
          probability: market.probability,
          volume: market.volume,
        });
      }
    }

    return NextResponse.json({ matched: results.length, results });
  } catch (err) {
    console.error("Market fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
