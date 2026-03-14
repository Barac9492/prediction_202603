"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";

function decodeHtml(html: string): string {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

interface NewsEvent {
    id: number;
    title: string;
    url: string | null;
    source: string | null;
    sentiment: string | null;
    aiRelevance: number | null;
    publishedAt: string | null;
    ingestedAt: string;
    processed: boolean;
    extractedEntities: string[];
    extractedThesisIds: number[];
}

const SENTIMENT_STYLES: Record<string, string> = {
    bullish: "text-green-400 bg-green-950/40 border-green-800",
    bearish: "text-red-400 bg-red-950/40 border-red-800",
    neutral: "text-yellow-400 bg-yellow-950/40 border-yellow-800",
};

function RelevanceDots({ score }: { score: number | null }) {
    if (!score) return <span className="text-zinc-700">—</span>span>;
    return (
          <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-blue-400" : "bg-zinc-700"}`} />
                  ))}
          </span>span>
        );
}

export default function FeedPage() {
    const [events, setEvents] = useState<NewsEvent[]>([]);
    const [unprocessedCount, setUnprocessedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [fetchResult, setFetchResult] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [processResult, setProcessResult] = useState<string | null>(null);
  
    const loadFeed = useCallback(async () => {
          try {
                  const res = await fetch("/api/feed/ingest");
                  const data = await res.json();
                  setEvents(data.recentEvents || []);
                  setUnprocessedCount(data.unprocessedCount || 0);
          } catch (e) { console.error(e); }
          finally { setLoading(false); }
    }, []);
  
    useEffect(() => { loadFeed(); }, [loadFeed]);
  
    async function handleFetch() {
          setFetching(true); setFetchResult(null);
          try {
                  const res = await fetch("/api/feed/fetch", { method: "POST" });
                  const data = await res.json();
                  setFetchResult(`Fetched ${data.total} articles — ${data.inserted} new, ${data.skipped} duplicates.`);
                  await loadFeed();
          } catch { setFetchResult("Error fetching RSS feeds."); }
          finally { setFetching(false); }
    }
  
    async function handleIngest() {
          setProcessing(true); setProcessResult(null);
          try {
                  const res = await fetch("/api/feed/ingest", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ limit: 10 }),
                  });
                  const data = await res.json();
                  setProcessResult(`Processed ${data.processed} events — connections added to graph.`);
                  await loadFeed();
          } catch { setProcessResult("Error processing events."); }
          finally { setProcessing(false); }
    }
  
    return (
          <div className="space-y-6">
                <div className="flex items-start justify-between">
                        <div>
                                  <h1 className="text-2xl font-bold">News Feed</h1>h1>
                                  <p className="text-sm text-zinc-400 mt-1">AI-relevant news from RSS feeds. Fetch → then Process to extract graph connections.</p>p>
                        </div>div>
                        <div className="flex flex-col items-end gap-2">
                                  <div className="flex gap-2">
                                              <button onClick={handleFetch} disabled={fetching} className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600 disabled:opacity-40 transition-colors">
                                                {fetching ? "Fetching RSS..." : "↓ Fetch RSS"}
                                              </button>button>
                                              <button onClick={handleIngest} disabled={processing || unprocessedCount === 0} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">
                                                {processing ? "Processing..." : `⚡ Process ${unprocessedCount} Unprocessed`}
                                              </button>button>
                                  </div>div>
                          {fetchResult && <span className="text-xs text-zinc-400">{fetchResult}</span>span>}
                          {processResult && <span className="text-xs text-zinc-400">{processResult}</span>span>}
                        </div>div>
                </div>div>
          
                <div className="flex gap-4 text-sm">
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                                  <div className="text-2xl font-bold text-blue-400">{unprocessedCount}</div>div>
                                  <div className="text-xs text-zinc-500 mt-0.5">Unprocessed</div>div>
                        </div>div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                                  <div className="text-2xl font-bold">{events.filter((e) => e.processed).length}</div>div>
                                  <div className="text-xs text-zinc-500 mt-0.5">Processed</div>div>
                        </div>div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                                  <div className="text-2xl font-bold text-green-400">{events.filter((e) => e.sentiment === "bullish").length}</div>div>
                                  <div className="text-xs text-zinc-500 mt-0.5">Bullish</div>div>
                        </div>div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                                  <div className="text-2xl font-bold text-red-400">{events.filter((e) => e.sentiment === "bearish").length}</div>div>
                                  <div className="text-xs text-zinc-500 mt-0.5">Bearish</div>div>
                        </div>div>
                </div>div>
          
            {loading ? (
                    <div className="text-zinc-500 text-sm">Loading feed...</div>div>
                  ) : events.length === 0 ? (
                    <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
                              <p className="text-lg mb-2">No news events yet</p>p>
                              <p className="text-sm">Click <strong>↓ Fetch RSS</strong>strong> to pull in the latest AI news.</p>p>
                    </div>div>
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                                  <div key={event.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 hover:bg-zinc-900/70 transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                    {event.source && <span className="text-xs text-zinc-500 shrink-0">{event.source}</span>span>}
                                                                                    {event.sentiment && (
                                                          <span className={`text-xs px-1.5 py-0.5 rounded border ${SENTIMENT_STYLES[event.sentiment] || SENTIMENT_STYLES.neutral}`}>
                                                            {event.sentiment}
                                                          </span>span>
                                                                                                      )}
                                                                                    {event.extractedThesisIds && event.extractedThesisIds.length > 0 && (
                                                          <span className="text-xs text-blue-400">→ {event.extractedThesisIds.length} thesis connection{event.extractedThesisIds.length > 1 ? "s" : ""}</span>span>
                                                                                                      )}
                                                                                    {!event.processed && <span className="text-xs text-zinc-600 border border-zinc-700 px-1.5 py-0.5 rounded">unprocessed</span>span>}
                                                                                    </div>div>
                                                                                  <h3 className="text-sm font-medium leading-snug">
                                                                                    {event.url ? (
                                                          <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                                                            {decodeHtml(event.title)}
                                                          </a>a>
                                                        ) : decodeHtml(event.title)}
                                                                                    </h3>h3>
                                                                  {event.extractedEntities && event.extractedEntities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                          {event.extractedEntities.slice(0, 6).map((entity) => (
                                                                                  <span key={entity} className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">{entity}</span>span>
                                                                                ))}
                                                        </div>div>
                                                                                  )}
                                                                </div>div>
                                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                                  <RelevanceDots score={event.aiRelevance} />
                                                                                  <span className="text-xs text-zinc-600">
                                                                                    {event.publishedAt ? new Date(event.publishedAt).toLocaleDateString() : new Date(event.ingestedAt).toLocaleDateString()}
                                                                                    </span>span>
                                                                </div>div>
                                                </div>div>
                                  </div>div>
                                ))}
                    </div>div>
                )}
          </div>div>
        );
}</span>
