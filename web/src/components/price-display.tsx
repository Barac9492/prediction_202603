"use client";

import { useState, useEffect } from "react";

export function PriceDisplay({
  ticker,
  entryPrice,
}: {
  ticker: string;
  entryPrice: number;
}) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/prices/current?tickers=${encodeURIComponent(ticker)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.prices?.[ticker]) {
            setCurrentPrice(data.prices[ticker].price);
          }
        }
      } catch {
        // silent fail
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (currentPrice === null) {
    return (
      <span className="text-xs text-pm-muted">
        ${entryPrice.toFixed(2)}
      </span>
    );
  }

  const returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
  const isPositive = returnPct > 0;

  return (
    <span className="text-xs tabular-nums">
      <span className="text-pm-muted">${entryPrice.toFixed(2)}</span>
      <span className="mx-1 text-pm-muted">&rarr;</span>
      <span
        className={isPositive ? "text-pm-green font-medium" : "text-pm-red font-medium"}
      >
        ${currentPrice.toFixed(2)} ({isPositive ? "+" : ""}
        {returnPct.toFixed(1)}%)
      </span>
    </span>
  );
}
