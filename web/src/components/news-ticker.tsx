"use client";

import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/format-time";

interface NewsEvent {
  id: number;
  title: string;
  source: string | null;
  sentiment: string | null;
  publishedAt: string | null;
  ingestedAt: string;
}

const sentimentColor: Record<string, string> = {
  positive: "bg-green-500",
  negative: "bg-red-500",
  neutral: "bg-gray-400",
};

export function NewsTicker() {
  const [events, setEvents] = useState<NewsEvent[]>([]);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch("/api/feed/ingest");
        if (!res.ok) return;
        const data = await res.json();
        setEvents((data.recentEvents ?? []).slice(0, 5));
      } catch {
        // silent
      }
    }
    fetchNews();
    const id = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="flex items-center gap-4 overflow-x-auto rounded-lg border border-pm-border bg-pm-bg-search px-4 py-2 text-xs">
      <span className="shrink-0 font-medium text-pm-text-primary">Latest</span>
      {events.map((e) => (
        <div key={e.id} className="flex shrink-0 items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              sentimentColor[e.sentiment ?? "neutral"] ?? "bg-gray-400"
            }`}
          />
          {e.source && (
            <span className="text-pm-muted">{e.source}</span>
          )}
          <span className="max-w-[200px] truncate text-pm-text-primary">
            {e.title}
          </span>
          <span className="text-pm-muted">
            {timeAgo(e.publishedAt ?? e.ingestedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
