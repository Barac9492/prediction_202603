import { getGraphData } from "@/lib/db/graph-queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

const RELATION_COLORS: Record<string, string> = {
    SUPPORTS: "text-green-400 border-green-800 bg-green-950/30",
    CONTRADICTS: "text-red-400 border-red-800 bg-red-950/30",
    AFFECTS: "text-blue-400 border-blue-800 bg-blue-950/30",
    RELATED_TO: "text-zinc-400 border-zinc-700 bg-zinc-900/30",
    MENTIONS: "text-zinc-500 border-zinc-800 bg-zinc-950/30",
};

const DIRECTION_COLORS: Record<string, string> = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    neutral: "text-yellow-400",
};

export default async function GraphPage() {
    const { newsNodes, entityNodes, thesisNodes, edges } = await getGraphData({
          limit: 100,
    });

  // Build adjacency: for each thesis, find all connected news
  const thesisConnections = new Map<
        number,
        Array<{
                newsId: number;
                newsTitle: string;
                newsSource: string | null;
                relation: string;
                direction: string | null;
                confidence: number;
                reasoning: string | null;
                publishedAt: string | null;
        }>
      >();

  const newsById = new Map(newsNodes.map((n) => [n.id, n]));

  for (const edge of edges) {
        if (edge.fromType === "news_event" && edge.toType === "thesis") {
                const news = newsById.get(edge.fromId);
                if (!news) continue;
                if (!thesisConnections.has(edge.toId)) {
                          thesisConnections.set(edge.toId, []);
                }
                thesisConnections.get(edge.toId)!.push({
                          newsId: edge.fromId,
                          newsTitle: news.title,
                          newsSource: news.source,
                          relation: edge.relation,
                          direction: edge.direction,
                          confidence: edge.confidence,
                          reasoning: edge.reasoning,
                          publishedAt: news.publishedAt ? new Date(news.publishedAt).toLocaleDateString() : null,
                });
        }
  }

  // Summary stats
  const totalEdges = edges.length;
    const supportEdges = edges.filter((e) => e.relation === "SUPPORTS").length;
    const contradictEdges = edges.filter((e) => e.relation === "CONTRADICTS").length;

  return (
        <div className="space-y-8">
              <div>
                      <h1 className="text-2xl font-bold">Knowledge Graph</h1>h1>
                      <p className="text-sm text-zinc-400 mt-1">
                                Investment intelligence graph — news events connected to theses via AI-extracted signals.
                      </p>p>
              </div>div>
        
          {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
          { label: "Theses", value: thesisNodes.length, color: "text-purple-400" },
          { label: "News Events", value: newsNodes.length, color: "text-blue-400" },
          { label: "Entities", value: entityNodes.length, color: "text-orange-400" },
          { label: "Connections", value: totalEdges, color: "text-zinc-300" },
                  ].map(({ label, value, color }) => (
                              <div
                                            key={label}
                                            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-center"
                                          >
                                          <div className={`text-2xl font-bold ${color}`}>{value}</div>div>
                                          <div className="text-xs text-zinc-500 mt-0.5">{label}</div>div>
                              </div>div>
                            ))}
              </div>div>
        
          {thesisNodes.length === 0 ? (
                  <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
                            <p className="text-lg mb-2">No data in the graph yet</p>p>
                            <p className="text-sm mb-4">To build the graph:</p>p>
                            <ol className="text-sm text-left max-w-md mx-auto space-y-2">
                                        <li>
                                                      1.{" "}
                                                      <Link href="/thesis" className="text-blue-400 hover:underline">
                                                                      Create investment theses
                                                      </Link>Link>
                                        </li>li>
                                        <li>
                                                      2. Run the Python news ingester:{" "}
                                                      <code className="text-xs bg-zinc-900 px-1.5 py-0.5 rounded">
                                                                      python -m signal_tracker.news_ingester
                                                      </code>code>
                                        </li>li>
                                        <li>
                                                      3.{" "}
                                                      <Link href="/feed" className="text-blue-400 hover:underline">
                                                                      Process news events
                                                      </Link>Link>{" "}
                                                      to extract connections
                                        </li>li>
                            </ol>ol>
                  </div>div>
                ) : (
                  <div className="space-y-6">
                    {thesisNodes.map((thesis) => {
                                const connections = thesisConnections.get(thesis.id) || [];
                                const supports = connections.filter((c) => c.relation === "SUPPORTS");
                                const contradicts = connections.filter((c) => c.relation === "CONTRADICTS");
                                const score = supports.length - contradicts.length;
                    
                                return (
                                                <div
                                                                  key={thesis.id}
                                                                  className="rounded-lg border border-zinc-800 bg-zinc-900/30 overflow-hidden"
                                                                >
                                                  {/* Thesis header */}
                                                                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                                                                                  <div className="flex items-center justify-between">
                                                                                                      <div className="flex items-center gap-2">
                                                                                                                            <span
                                                                                                                                                      className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                                                                                                                                                  DIRECTION_COLORS[thesis.direction] || "text-zinc-400"
                                                                                                                                                        } border-zinc-700`}
                                                                                                                                                    >
                                                                                                                              {thesis.direction.toUpperCase()}
                                                                                                                              </span>span>
                                                                                                                            <h2 className="font-semibold text-sm">{thesis.title}</h2>h2>
                                                                                                        </div>div>
                                                                                                      <div className="flex items-center gap-3 text-xs">
                                                                                                                            <span className="text-green-400">{supports.length} supports</span>span>
                                                                                                                            <span className="text-red-400">{contradicts.length} contradicts</span>span>
                                                                                                                            <span
                                                                                                                                                      className={`font-bold ${
                                                                                                                                                                                  score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-zinc-400"
                                                                                                                                                        }`}
                                                                                                                                                    >
                                                                                                                                                    Net: {score > 0 ? "+" : ""}{score}
                                                                                                                              </span>span>
                                                                                                        </div>div>
                                                                                    </div>div>
                                                                                  <p className="text-xs text-zinc-500 mt-1">{thesis.description}</p>p>
                                                                </div>div>
                                                
                                                  {/* Connected news events */}
                                                  {connections.length === 0 ? (
                                                                                    <div className="p-4 text-xs text-zinc-600">
                                                                                                        No news events connected yet. Process the feed to extract connections.
                                                                                      </div>div>
                                                                                  ) : (
                                                                                    <div className="divide-y divide-zinc-800/50">
                                                                                      {connections.slice(0, 10).map((conn, i) => (
                                                                                                            <div key={i} className="px-4 py-2.5 hover:bg-zinc-900/50 transition-colors">
                                                                                                                                    <div className="flex items-start gap-2">
                                                                                                                                                              <span
                                                                                                                                                                                            className={`text-xs px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${
                                                                                                                                                                                                                            RELATION_COLORS[conn.relation] || RELATION_COLORS.RELATED_TO
                                                                                                                                                                                                                          }`}
                                                                                                                                                                                          >
                                                                                                                                                                {conn.relation}
                                                                                                                                                                </span>span>
                                                                                                                                                              <div className="flex-1 min-w-0">
                                                                                                                                                                                          <p className="text-xs font-medium leading-snug">{conn.newsTitle}</p>p>
                                                                                                                                                                {conn.reasoning && (
                                                                                                                                            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                                                                                                                                              {conn.reasoning}
                                                                                                                                              </p>p>
                                                                                                                                                                                          )}
                                                                                                                                                                                          <div className="flex items-center gap-3 mt-1">
                                                                                                                                                                                                                        {conn.newsSource && (
                                                                                                                                              <span className="text-xs text-zinc-600">{conn.newsSource}</span>span>
                                                                                                                                                                                                                        )}
                                                                                                                                                                                                                        {conn.publishedAt && (
                                                                                                                                              <span className="text-xs text-zinc-600">{conn.publishedAt}</span>span>
                                                                                                                                                                                                                        )}
                                                                                                                                                                                                                        <span className="text-xs text-zinc-600">
                                                                                                                                                                                                                                                        conf: {Math.round(conn.confidence * 100)}%
                                                                                                                                                                                                                                                      </span>span>
                                                                                                                                                                                                                      </div>div>
                                                                                                                                                                </div>div>
                                                                                                                                      </div>div>
                                                                                                              </div>div>
                                                                                                          ))}
                                                                                      {connections.length > 10 && (
                                                                                                            <div className="px-4 py-2 text-xs text-zinc-600">
                                                                                                                                    +{connections.length - 10} more connections
                                                                                                              </div>div>
                                                                                                        )}
                                                                                      </div>div>
                                                                )}
                                                </div>div>
                                              );
                  })}
                  </div>div>
              )}
        
          {/* Entity cloud */}
          {entityNodes.length > 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                            <h2 className="text-sm font-semibold mb-3">Tracked Entities</h2>h2>
                            <div className="flex flex-wrap gap-2">
                              {entityNodes.map((entity) => (
                                  <span
                                                    key={entity.id}
                                                    className="text-xs text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-full"
                                                  >
                                    {entity.name}
                                    {entity.type !== "unknown" && (
                                                                      <span className="text-zinc-500 ml-1">({entity.type})</span>span>
                                                  )}
                                  </span>span>
                                ))}
                            </div>div>
                  </div>div>
              )}
        </div>div>
      );
}
</div>
