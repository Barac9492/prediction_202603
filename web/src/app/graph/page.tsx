import { getGraphData } from "@/lib/db/graph-queries";
import { BackfillButton } from "@/components/backfill-button";

const RELATION_STYLES: Record<string, string> = {
  SUPPORTS: "text-green-400 bg-green-950/30 border-green-800",
  CONTRADICTS: "text-red-400 bg-red-950/30 border-red-800",
  AFFECTS: "text-yellow-400 bg-yellow-950/30 border-yellow-800",
  RELATED_TO: "text-blue-400 bg-blue-950/30 border-blue-800",
  MENTIONS: "text-zinc-400 bg-zinc-800/40 border-zinc-700",
};

const DIRECTION_COLORS: Record<string, string> = {
  bullish: "text-green-400 border-green-800 bg-green-950/30",
  bearish: "text-red-400 border-red-800 bg-red-950/30",
  neutral: "text-yellow-400 border-yellow-800 bg-yellow-950/30",
};

export default async function GraphPage() {
  const { newsNodes, entityNodes, thesisNodes, edges } = await getGraphData();

  const newsById: Record<number, (typeof newsNodes)[0]> = {};
  for (const n of newsNodes) newsById[n.id] = n;

  const thesisEdges: Record<
    number,
    { news: (typeof newsNodes)[0]; relation: string; reasoning: string | null }[]
  > = {};

  for (const thesis of thesisNodes) {
    thesisEdges[thesis.id] = [];
    for (const edge of edges) {
      if (edge.toType === "thesis" && edge.toId === thesis.id) {
        const news = newsById[edge.fromId];
        if (news) {
          thesisEdges[thesis.id].push({ news, relation: edge.relation, reasoning: edge.reasoning });
        }
      }
    }
  }

  const totalConnections = edges.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-sm text-zinc-400 mt-1">How recent AI news connects to your investment theses.</p>
        </div>
        {entityNodes.length === 0 && newsNodes.length > 0 && <BackfillButton />}
      </div>

      <div className="flex gap-4 text-sm">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="text-2xl font-bold text-blue-400">{thesisNodes.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Active Theses</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="text-2xl font-bold">{newsNodes.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">News Events</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="text-2xl font-bold text-purple-400">{entityNodes.length}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Entities</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="text-2xl font-bold text-orange-400">{totalConnections}</div>
          <div className="text-xs text-zinc-500 mt-0.5">Connections</div>
        </div>
      </div>

      {thesisNodes.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
          <p className="text-lg mb-2">No graph data yet</p>
          <p className="text-sm">
            Start by creating theses at{" "}
            <a href="/thesis" className="text-blue-400 hover:underline">/thesis</a>, then
            ingest news at{" "}
            <a href="/feed" className="text-blue-400 hover:underline">/feed</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thesisNodes.map((thesis) => {
            const connections = thesisEdges[thesis.id] || [];
            const supports = connections.filter((c) => c.relation === "SUPPORTS").length;
            const contradicts = connections.filter((c) => c.relation === "CONTRADICTS").length;
            const netScore = supports - contradicts;
            return (
              <div key={thesis.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${DIRECTION_COLORS[thesis.direction] || DIRECTION_COLORS.neutral}`}>
                        {thesis.direction.toUpperCase()}
                      </span>
                      <span className="text-xs text-zinc-500">{thesis.domain}</span>
                    </div>
                    <h2 className="font-semibold">{thesis.title}</h2>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className={`text-xl font-bold ${netScore > 0 ? "text-green-400" : netScore < 0 ? "text-red-400" : "text-zinc-400"}`}>
                      {netScore > 0 ? "+" : ""}{netScore}
                    </div>
                    <div className="text-xs text-zinc-500">net score</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{supports} for / {contradicts} against</div>
                  </div>
                </div>
                {connections.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No news connections yet. Process news events to generate links.</p>
                ) : (
                  <div className="space-y-2">
                    {connections.map((conn, i) => (
                      <div key={i} className="flex items-start gap-3 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${RELATION_STYLES[conn.relation] || RELATION_STYLES.MENTIONS}`}>
                          {conn.relation}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {conn.news.url ? (
                              <a href={conn.news.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">{conn.news.title}</a>
                            ) : conn.news.title}
                          </p>
                          {conn.reasoning && <p className="text-xs text-zinc-500 mt-0.5 italic">{conn.reasoning}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {conn.news.source && <span className="text-xs text-zinc-600">{conn.news.source}</span>}
                            {conn.news.publishedAt && <span className="text-xs text-zinc-700">{new Date(conn.news.publishedAt).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entityNodes.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Tracked Entities ({entityNodes.length})</h2>
            <BackfillButton />
          </div>
          <div className="flex flex-wrap gap-2">
            {entityNodes.map((entity) => (
              <span key={entity.id} className="text-xs text-zinc-300 bg-zinc-800 px-2.5 py-1 rounded-full">
                {entity.name}
                {entity.type !== "unknown" && <span className="text-zinc-500 ml-1">({entity.type})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
