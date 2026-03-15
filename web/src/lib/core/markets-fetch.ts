import { matchThesesToMarkets } from "@/lib/markets/fetcher";
import { listTheses, createConnection, insertNewsEvent } from "@/lib/db/graph-queries";

export async function fetchMarkets(workspaceId: string): Promise<{
  matched: number;
  results: Array<{
    thesisId: number;
    market: string;
    probability: number;
    volume: number;
  }>;
}> {
  const activeTheses = await listTheses(workspaceId, true);
  if (activeTheses.length === 0) {
    return { matched: 0, results: [] };
  }

  const thesesData = activeTheses.map((t) => ({
    id: t.id,
    title: t.title,
    tags: (t.tags as string[]) ?? [],
  }));

  const matches = await matchThesesToMarkets(thesesData);
  const results: Array<{
    thesisId: number;
    market: string;
    probability: number;
    volume: number;
  }> = [];

  for (const [thesisId, markets] of matches) {
    for (const market of markets) {
      // Store market data as a news event with source="polymarket"
      const newsEvent = await insertNewsEvent(workspaceId, {
        title: market.title,
        url: market.url,
        source: "polymarket",
        summary: `Market probability: ${(market.probability * 100).toFixed(1)}% | Volume: $${market.volume.toLocaleString()}`,
      });

      // Create connection from market to thesis
      const newsId = newsEvent?.id;
      await createConnection(workspaceId, {
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

  return { matched: results.length, results };
}
