import { NextResponse } from "next/server";
import { listRecommendations, insertPriceSnapshot } from "@/lib/db/graph-queries";
import { fetchPrice } from "@/lib/markets/yahoo";
import { getWorkspaceId } from "@/lib/db/workspace";

export async function POST() {
  try {
    const workspaceId = await getWorkspaceId();
    const activeRecs = await listRecommendations(workspaceId, { status: "active" });
    const tickers = [
      ...new Set(
        activeRecs
          .map((r) => r.ticker)
          .filter((t): t is string => t !== null)
      ),
    ];

    if (tickers.length === 0) {
      return NextResponse.json({ snapshots: 0, message: "No active tickers" });
    }

    const results = [];
    for (const ticker of tickers) {
      const priceData = await fetchPrice(ticker);
      if (priceData) {
        const snap = await insertPriceSnapshot(workspaceId, {
          ticker,
          price: priceData.price,
          volume: priceData.volume ?? undefined,
        });
        results.push(snap);
      }
    }

    return NextResponse.json({ snapshots: results.length, data: results });
  } catch (err) {
    console.error("Price snapshot failed:", err);
    return NextResponse.json(
      { error: "Price snapshot failed" },
      { status: 500 }
    );
  }
}
