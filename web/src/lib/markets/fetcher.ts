export interface MarketResult {
  title: string;
  probability: number;
  volume: number;
  url: string;
  conditionId: string;
}

interface PolymarketEvent {
  title: string;
  slug: string;
  markets: Array<{
    condition_id: string;
    question: string;
    outcomePrices: string; // JSON string of [yesPrice, noPrice]
    volume: number;
    active: boolean;
  }>;
}

/**
 * Search Polymarket for markets matching given keywords.
 * Uses the public CLOB/Gamma API.
 */
export async function searchMarkets(keywords: string): Promise<MarketResult[]> {
  const url = `https://gamma-api.polymarket.com/events?closed=false&limit=10&title=${encodeURIComponent(keywords)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!res.ok) {
    console.error(`Polymarket API error: ${res.status}`);
    return [];
  }

  const events: PolymarketEvent[] = await res.json();
  const results: MarketResult[] = [];

  for (const event of events) {
    for (const market of event.markets) {
      if (!market.active) continue;
      try {
        const prices = JSON.parse(market.outcomePrices);
        const yesPrice = parseFloat(prices[0]);
        results.push({
          title: market.question || event.title,
          probability: yesPrice,
          volume: market.volume,
          url: `https://polymarket.com/event/${event.slug}`,
          conditionId: market.condition_id,
        });
      } catch {
        // Skip malformed market data
      }
    }
  }

  return results;
}

/**
 * Match active theses to Polymarket markets using keyword overlap.
 * Returns matched pairs of thesis ID → market results.
 */
export async function matchThesesToMarkets(
  thesesData: Array<{ id: number; title: string; tags: string[] }>
): Promise<Map<number, MarketResult[]>> {
  const matched = new Map<number, MarketResult[]>();

  for (const thesis of thesesData) {
    // Build search keywords from title and tags
    const keywords = [
      ...thesis.title.split(/\s+/).filter((w) => w.length > 3),
      ...thesis.tags,
    ]
      .slice(0, 5)
      .join(" ");

    if (!keywords.trim()) continue;

    const markets = await searchMarkets(keywords);
    if (markets.length > 0) {
      matched.set(thesis.id, markets.slice(0, 3)); // Top 3 matches per thesis
    }
  }

  return matched;
}
