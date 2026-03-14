import { NextRequest, NextResponse } from "next/server";
import { fetchPrice } from "@/lib/markets/yahoo";

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers query parameter required" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const prices: Record<string, { price: number; volume: number | null } | null> = {};
  await Promise.all(
    tickers.map(async (ticker) => {
      prices[ticker] = await fetchPrice(ticker);
    })
  );

  return NextResponse.json({ prices });
}
