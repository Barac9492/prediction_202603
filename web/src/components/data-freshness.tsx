"use client";

import { useState, useEffect } from "react";
import { timeAgo, isStale } from "@/lib/format-time";

export function DataFreshness({
  lastUpdated,
  staleThresholdHours = 24,
}: {
  lastUpdated: string | null;
  staleThresholdHours?: number;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!lastUpdated) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-pm-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
        No data yet
      </div>
    );
  }

  const stale = isStale(lastUpdated, staleThresholdHours);

  return (
    <div className="flex items-center gap-1.5 text-xs text-pm-muted">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          stale ? "bg-red-500" : "bg-green-500"
        }`}
      />
      {stale ? "Data may be stale" : `Updated ${timeAgo(lastUpdated)}`}
    </div>
  );
}
