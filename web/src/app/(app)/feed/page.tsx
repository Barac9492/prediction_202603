"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect, useCallback } from "react";
import { timeAgo } from "@/lib/format-time";

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
    bullish: "text-green-700 bg-green-50 border-green-200",
    bearish: "text-red-700 bg-red-50 border-red-200",
    neutral: "text-yellow-700 bg-yellow-50 border-yellow-200",
};

function RelevanceDots({ score }: { score: number | null }) {
    if (!score) return <span className="text-pm-text-meta">&mdash;</span>;
    return (
          <span className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= score ? "bg-blue-600" : "bg-pm-text-meta"}`} />
                  ))}
          </span>
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
    const [runningPipeline, setRunningPipeline] = useState(false);
    const [pipelineResult, setPipelineResult] = useState<string | null>(null);

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

    // Auto-refresh every 5 minutes
    useEffect(() => {
          const id = setInterval(() => { loadFeed(); }, 300_000);
          return () => clearInterval(id);
    }, [loadFeed]);

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

    async function handleRunPipeline() {
          setRunningPipeline(true);
          setPipelineResult(null);
          try {
                  const res = await fetch("/api/cron");
                  const data = await res.json();
                  if (!data.ok) {
                            setPipelineResult("Pipeline failed.");
                  } else {
                            const steps = (data.pipeline as Array<Record<string, unknown>>) || [];
                            const fetchStep = steps.find((s) => s.step === "fetch");
                            const ingestStep = steps.find((s) => s.step === "ingest");
                            const probStep = steps.find((s) => s.step === "probabilities");
                            const parts: string[] = [];
                            if (fetchStep && !fetchStep.error) parts.push(`${fetchStep.inserted ?? 0} new articles`);
                            if (ingestStep && !ingestStep.error) parts.push(`${ingestStep.processed ?? 0} processed`);
                            if (probStep && !probStep.error) parts.push(`${probStep.updated ?? probStep.probabilitiesUpdated ?? 0} probabilities updated`);
                            setPipelineResult(`Pipeline complete: ${parts.join(", ") || "done"}.`);
                  }
                  await loadFeed();
          } catch {
                  setPipelineResult("Error running pipeline.");
          } finally {
                  setRunningPipeline(false);
          }
    }

    return (
          <div className="space-y-6">
                <div className="flex items-start justify-between">
                        <div>
                                  <h1 className="text-2xl font-bold">News Feed</h1>
                                  <p className="text-sm text-pm-muted mt-1">AI-relevant news from RSS feeds. Fetch → then Process to extract graph connections.</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                                  <div className="flex gap-2">
                                              <button onClick={handleRunPipeline} disabled={runningPipeline || fetching || processing} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition-colors">
                                                {runningPipeline ? "Running pipeline..." : "Run Full Pipeline"}
                                              </button>
                                              <button onClick={handleFetch} disabled={fetching || runningPipeline} className="rounded-md bg-pm-text-primary text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors">
                                                {fetching ? "Fetching RSS..." : "Fetch RSS"}
                                              </button>
                                              <button onClick={handleIngest} disabled={processing || unprocessedCount === 0 || runningPipeline} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">
                                                {processing ? "Processing..." : `Process ${unprocessedCount} Unprocessed`}
                                              </button>
                                  </div>
                          {pipelineResult && <span className="text-xs text-emerald-600">{pipelineResult}</span>}
                          {fetchResult && <span className="text-xs text-pm-muted">{fetchResult}</span>}
                          {processResult && <span className="text-xs text-pm-muted">{processResult}</span>}
                        </div>
                </div>

                <div className="flex gap-4 text-sm">
                        <div className="rounded-lg border border-pm-border bg-white px-4 py-3">
                                  <div className="text-2xl font-bold text-blue-600">{unprocessedCount}</div>
                                  <div className="text-xs text-pm-text-secondary mt-0.5">Unprocessed</div>
                        </div>
                        <div className="rounded-lg border border-pm-border bg-white px-4 py-3">
                                  <div className="text-2xl font-bold">{events.filter((e) => e.processed).length}</div>
                                  <div className="text-xs text-pm-text-secondary mt-0.5">Processed</div>
                        </div>
                        <div className="rounded-lg border border-pm-border bg-white px-4 py-3">
                                  <div className="text-2xl font-bold text-green-600">{events.filter((e) => e.sentiment === "bullish").length}</div>
                                  <div className="text-xs text-pm-text-secondary mt-0.5">Bullish</div>
                        </div>
                        <div className="rounded-lg border border-pm-border bg-white px-4 py-3">
                                  <div className="text-2xl font-bold text-red-600">{events.filter((e) => e.sentiment === "bearish").length}</div>
                                  <div className="text-xs text-pm-text-secondary mt-0.5">Bearish</div>
                        </div>
                </div>

            {loading ? (
                    <div className="text-pm-text-secondary text-sm">Loading feed...</div>
                  ) : events.length === 0 ? (
                    <div className="rounded-lg border border-pm-border p-8 text-center text-pm-text-secondary">
                              <p className="text-lg mb-2">No news events yet</p>
                              <p className="text-sm">Click <strong>Fetch RSS</strong> to pull in the latest AI news.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events.map((event) => (
                                  <div key={event.id} className="rounded-lg border border-pm-border bg-white p-3 hover:bg-pm-bg-search transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                                    {event.source && <span className="text-xs text-pm-text-secondary shrink-0">{event.source}</span>}
                                                                                    {event.sentiment && (
                                                          <span className={`text-xs px-1.5 py-0.5 rounded border ${SENTIMENT_STYLES[event.sentiment] || SENTIMENT_STYLES.neutral}`}>
                                                            {event.sentiment}
                                                          </span>
                                                                                                      )}
                                                                                    {event.extractedThesisIds && event.extractedThesisIds.length > 0 && (
                                                          <span className="text-xs text-blue-600">{"\u2192"} {event.extractedThesisIds.length} thesis connection{event.extractedThesisIds.length > 1 ? "s" : ""}</span>
                                                                                                      )}
                                                                                    {!event.processed && <span className="text-xs text-pm-text-meta border border-pm-border px-1.5 py-0.5 rounded">unprocessed</span>}
                                                                                    </div>
                                                                                  <h3 className="text-sm font-medium leading-snug">
                                                                                    {event.url ? (
                                                          <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                                                            {decodeHtml(event.title)}
                                                          </a>
                                                        ) : decodeHtml(event.title)}
                                                                                    </h3>
                                                                  {event.extractedEntities && event.extractedEntities.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                          {event.extractedEntities.slice(0, 6).map((entity) => (
                                                                                  <span key={entity} className="text-xs text-pm-text-secondary bg-gray-100 px-1.5 py-0.5 rounded">{entity}</span>
                                                                                ))}
                                                        </div>
                                                                                  )}
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                                  <RelevanceDots score={event.aiRelevance} />
                                                                                  <span className="text-xs text-pm-text-meta">
                                                                                    {timeAgo(event.publishedAt || event.ingestedAt)}
                                                                                    </span>
                                                                </div>
                                                </div>
                                  </div>
                                ))}
                    </div>
                )}
          </div>
        );
}
