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

interface PipelineRun {
    id: number;
    startedAt: string;
    completedAt: string | null;
    status: string;
    steps: Record<string, unknown>;
    triggeredBy: string;
}

const SENTIMENT_STYLES: Record<string, string> = {
    bullish: "text-green-700 bg-green-50 border-green-200",
    bearish: "text-red-700 bg-red-50 border-red-200",
    neutral: "text-yellow-700 bg-yellow-50 border-yellow-200",
};

const STATUS_STYLES: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    running: "bg-blue-100 text-blue-800",
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

function StepSummary({ steps }: { steps: Record<string, unknown> }) {
    const stepNames: Record<string, string> = {
        vaultIngest: "Vault",
        feedFetch: "RSS Fetch",
        feedIngest: "LLM Ingest",
        marketFetch: "Markets",
        probabilitySnapshot: "Probabilities",
        signalFusion: "Clusters",
        thesisInteractions: "Interactions",
        recEvaluate: "Eval Recs",
        recGenerate: "Gen Recs",
        backtestRefine: "Backtest",
        thesisDeadlines: "Deadlines",
    };

    return (
        <div className="flex flex-wrap gap-1">
            {Object.entries(steps).map(([key, value]) => {
                const hasError = value && typeof value === "object" && "error" in (value as Record<string, unknown>);
                return (
                    <span
                        key={key}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                            hasError ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        }`}
                        title={hasError ? String((value as Record<string, unknown>).error) : "OK"}
                    >
                        {stepNames[key] || key}
                    </span>
                );
            })}
        </div>
    );
}

function durationStr(start: string, end: string | null): string {
    if (!end) return "running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export default function FeedPage() {
    const [events, setEvents] = useState<NewsEvent[]>([]);
    const [unprocessedCount, setUnprocessedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [fetchingNews, setFetchingNews] = useState(false);
    const [fetchResult, setFetchResult] = useState<string | null>(null);
    const [runningPipeline, setRunningPipeline] = useState(false);
    const [pipelineResult, setPipelineResult] = useState<string | null>(null);
    const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
    const [loadingRuns, setLoadingRuns] = useState(true);

    const loadFeed = useCallback(async () => {
          try {
                  const res = await fetch("/api/feed/ingest");
                  const data = await res.json();
                  setEvents(data.recentEvents || []);
                  setUnprocessedCount(data.unprocessedCount || 0);
          } catch (e) { console.error(e); }
          finally { setLoading(false); }
    }, []);

    const loadPipelineStatus = useCallback(async () => {
          try {
                  const res = await fetch("/api/pipeline/status");
                  const data = await res.json();
                  setRecentRuns(data.recentRuns || []);
          } catch (e) { console.error(e); }
          finally { setLoadingRuns(false); }
    }, []);

    useEffect(() => { loadFeed(); loadPipelineStatus(); }, [loadFeed, loadPipelineStatus]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
          const id = setInterval(() => { loadFeed(); loadPipelineStatus(); }, 300_000);
          return () => clearInterval(id);
    }, [loadFeed, loadPipelineStatus]);

    async function handleFetchNews() {
          setFetchingNews(true);
          setFetchResult(null);
          try {
                  // Step 1: Fetch RSS
                  const fetchRes = await fetch("/api/feed/fetch", { method: "POST" });
                  const fetchData = await fetchRes.json();
                  const newArticles = fetchData.inserted ?? 0;

                  // Step 2: Process/ingest unprocessed events
                  const ingestRes = await fetch("/api/feed/ingest", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ limit: 20 }),
                  });
                  const ingestData = await ingestRes.json();
                  const processed = ingestData.processed ?? 0;

                  setFetchResult(`Fetched ${newArticles} new articles, processed ${processed} events.`);
                  await loadFeed();
          } catch {
                  setFetchResult("Error fetching news.");
          } finally {
                  setFetchingNews(false);
          }
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
                            setPipelineResult("Pipeline completed successfully.");
                  }
                  await Promise.all([loadFeed(), loadPipelineStatus()]);
          } catch {
                  setPipelineResult("Error running pipeline.");
          } finally {
                  setRunningPipeline(false);
          }
    }

    const lastRun = recentRuns[0] ?? null;

    return (
          <div className="space-y-6">
                <div className="flex items-start justify-between">
                        <div>
                                  <h1 className="text-2xl font-bold">News Feed</h1>
                                  <p className="text-sm text-pm-muted mt-1">Pipeline runs automatically daily. Fetch news anytime or run the full pipeline manually.</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                                  <div className="flex gap-2">
                                              <button onClick={handleFetchNews} disabled={fetchingNews || runningPipeline} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-40 transition-colors">
                                                {fetchingNews ? "Fetching..." : "Fetch News"}
                                              </button>
                                              <button onClick={handleRunPipeline} disabled={runningPipeline || fetchingNews} className="rounded-md bg-pm-text-primary text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors">
                                                {runningPipeline ? "Running pipeline..." : "Run Full Pipeline"}
                                              </button>
                                  </div>
                          {fetchResult && <span className="text-xs text-blue-600">{fetchResult}</span>}
                          {pipelineResult && <span className="text-xs text-emerald-600">{pipelineResult}</span>}
                        </div>
                </div>

                {/* Pipeline Status */}
                <div className="rounded-lg border border-pm-border bg-white p-4">
                        <h2 className="text-sm font-semibold text-pm-text-primary mb-3">Pipeline Status</h2>
                        {loadingRuns ? (
                            <p className="text-sm text-pm-muted">Loading...</p>
                        ) : lastRun ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                                        lastRun.status === "completed" ? "bg-green-500" :
                                        lastRun.status === "failed" ? "bg-red-500" : "bg-blue-500"
                                    }`} />
                                    <span className="text-sm text-pm-text-primary">
                                        Last run: {timeAgo(lastRun.startedAt)}
                                    </span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[lastRun.status] || ""}`}>
                                        {lastRun.status}
                                    </span>
                                    <span className="text-xs text-pm-muted">
                                        ({lastRun.triggeredBy} · {durationStr(lastRun.startedAt, lastRun.completedAt)})
                                    </span>
                                </div>
                                {lastRun.steps && Object.keys(lastRun.steps).length > 0 && (
                                    <StepSummary steps={lastRun.steps} />
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-pm-muted">No pipeline runs yet. Click &quot;Run Pipeline Now&quot; to start.</p>
                        )}
                </div>

                {/* Run History */}
                {recentRuns.length > 1 && (
                    <div className="rounded-lg border border-pm-border bg-white p-4">
                        <h2 className="text-sm font-semibold text-pm-text-primary mb-3">Recent Runs</h2>
                        <div className="space-y-2">
                            {recentRuns.slice(1).map((run) => (
                                <div key={run.id} className="flex items-center gap-3 text-sm">
                                    <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                                        run.status === "completed" ? "bg-green-500" :
                                        run.status === "failed" ? "bg-red-500" : "bg-blue-500"
                                    }`} />
                                    <span className="text-pm-muted">{timeAgo(run.startedAt)}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_STYLES[run.status] || ""}`}>
                                        {run.status}
                                    </span>
                                    <span className="text-xs text-pm-muted">
                                        {run.triggeredBy} · {durationStr(run.startedAt, run.completedAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats */}
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

                {/* News Feed */}
            {loading ? (
                    <div className="text-pm-text-secondary text-sm">Loading feed...</div>
                  ) : events.length === 0 ? (
                    <div className="rounded-lg border border-pm-border p-8 text-center text-pm-text-secondary">
                              <p className="text-lg mb-2">No news events yet</p>
                              <p className="text-sm">Click <strong>Run Pipeline Now</strong> to fetch and process the latest AI news.</p>
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
