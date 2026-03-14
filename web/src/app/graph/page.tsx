import { getGraphData, getEntitiesForThesis } from "@/lib/db/graph-queries";
import { BackfillButton } from "@/components/backfill-button";
import { EntityNetworkPanel } from "@/components/entity-network-panel";

const RELATION_STYLES: Record<string, string> = {
  SUPPORTS: "text-green-700 bg-green-50 border-green-200",
  CONTRADICTS: "text-red-700 bg-red-50 border-red-200",
  AFFECTS: "text-yellow-700 bg-yellow-50 border-yellow-200",
  RELATED_TO: "text-blue-700 bg-blue-50 border-blue-200",
  MENTIONS: "text-gray-600 bg-gray-50 border-gray-200",
  DEPENDS_ON: "text-purple-700 bg-purple-50 border-purple-200",
  PRODUCES: "text-indigo-700 bg-indigo-50 border-indigo-200",
  COMPETES_WITH: "text-orange-700 bg-orange-50 border-orange-200",
  RELEVANT_TO: "text-teal-700 bg-teal-50 border-teal-200",
};

const DIRECTION_COLORS: Record<string, string> = {
  bullish: "text-green-700 border-green-300 bg-green-50",
  bearish: "text-red-700 border-red-300 bg-red-50",
  neutral: "text-yellow-700 border-yellow-300 bg-yellow-50",
};

const CATEGORY_COLORS: Record<string, string> = {
  company: "bg-blue-100 text-blue-800",
  person: "bg-purple-100 text-purple-800",
  technology: "bg-emerald-100 text-emerald-800",
  product: "bg-orange-100 text-orange-800",
  concept: "bg-pink-100 text-pink-800",
  regulatory_body: "bg-red-100 text-red-800",
  unknown: "bg-gray-100 text-gray-600",
};

export default async function GraphPage() {
  const { newsNodes, entityNodes, thesisNodes, edges } = await getGraphData();

  const newsById: Record<number, (typeof newsNodes)[0]> = {};
  for (const n of newsNodes) newsById[n.id] = n;

  // Build thesis→news connections
  const thesisEdges: Record<
    number,
    { news: (typeof newsNodes)[0]; relation: string; reasoning: string | null; direction: string | null }[]
  > = {};
  for (const thesis of thesisNodes) {
    thesisEdges[thesis.id] = [];
    for (const edge of edges) {
      if (edge.toType === "thesis" && edge.toId === thesis.id && edge.fromType === "news_event") {
        const news = newsById[edge.fromId];
        if (news) {
          thesisEdges[thesis.id].push({
            news,
            relation: edge.relation,
            reasoning: edge.reasoning,
            direction: edge.direction,
          });
        }
      }
    }
  }

  // Build entity→entity connections
  const entityEdges = edges.filter(
    (e) => e.fromType === "entity" && e.toType === "entity"
  );

  // Group entities by category
  const entitiesByCategory: Record<string, typeof entityNodes> = {};
  for (const entity of entityNodes) {
    const cat = entity.category || entity.type || "unknown";
    if (!entitiesByCategory[cat]) entitiesByCategory[cat] = [];
    entitiesByCategory[cat].push(entity);
  }

  // Count entity connections
  const entityConnCount: Record<number, number> = {};
  for (const edge of edges) {
    if (edge.fromType === "entity") entityConnCount[edge.fromId] = (entityConnCount[edge.fromId] || 0) + 1;
    if (edge.toType === "entity") entityConnCount[edge.toId] = (entityConnCount[edge.toId] || 0) + 1;
  }

  const totalConnections = edges.length;

  // Prefetch entity context for each thesis
  const thesisEntityContext: Record<number, typeof entityNodes> = {};
  for (const thesis of thesisNodes) {
    const thesisEntityEdges = edges.filter(
      (e) => e.fromType === "entity" && e.toType === "thesis" && e.toId === thesis.id
    );
    const entityIds = [...new Set(thesisEntityEdges.map((e) => e.fromId))];
    thesisEntityContext[thesis.id] = entityNodes.filter((e) => entityIds.includes(e.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pm-text-primary">Knowledge Graph</h1>
          <p className="text-sm text-pm-muted mt-1">
            Entities, theses, and their connections from AI news.
          </p>
        </div>
        <BackfillButton />
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        {[
          { label: "Active Theses", value: thesisNodes.length, color: "text-blue-600" },
          { label: "News Events", value: newsNodes.length, color: "text-pm-text-primary" },
          { label: "Entities", value: entityNodes.length, color: "text-purple-600" },
          { label: "Connections", value: totalConnections, color: "text-orange-600" },
          { label: "Entity Relations", value: entityEdges.length, color: "text-teal-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-pm-border bg-white px-4 py-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-pm-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Entity Network Section */}
      {entityNodes.length > 0 && (
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <h2 className="text-lg font-semibold text-pm-text-primary mb-4">
            Entity Network ({entityNodes.length})
          </h2>

          {/* Entities grouped by category */}
          <div className="space-y-3">
            {Object.entries(entitiesByCategory)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([category, ents]) => (
                <div key={category}>
                  <div className="text-xs font-medium text-pm-muted uppercase tracking-wide mb-1.5">
                    {category.replace("_", " ")} ({ents.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ents
                      .sort((a, b) => (entityConnCount[b.id] || 0) - (entityConnCount[a.id] || 0))
                      .map((entity) => (
                        <EntityNetworkPanel
                          key={entity.id}
                          entity={entity}
                          connCount={entityConnCount[entity.id] || 0}
                          categoryColor={CATEGORY_COLORS[category] || CATEGORY_COLORS.unknown}
                        />
                      ))}
                  </div>
                </div>
              ))}
          </div>

          {/* Entity-to-Entity relationships */}
          {entityEdges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-pm-border">
              <h3 className="text-sm font-semibold text-pm-text-primary mb-2">
                Entity Relationships ({entityEdges.length})
              </h3>
              <div className="grid gap-1.5 max-h-60 overflow-y-auto">
                {entityEdges.slice(0, 30).map((edge) => {
                  const from = entityNodes.find((e) => e.id === edge.fromId);
                  const to = entityNodes.find((e) => e.id === edge.toId);
                  if (!from || !to) return null;
                  return (
                    <div
                      key={edge.id}
                      className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-gray-50"
                    >
                      <span className="font-medium text-pm-text-primary">{from.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${RELATION_STYLES[edge.relation] || RELATION_STYLES.MENTIONS}`}>
                        {edge.relation}
                      </span>
                      <span className="font-medium text-pm-text-primary">{to.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Thesis Section */}
      {thesisNodes.length === 0 ? (
        <div className="rounded-lg border border-pm-border bg-white p-8 text-center text-pm-muted">
          <p className="text-lg mb-2">No graph data yet</p>
          <p className="text-sm">
            Start by creating theses at{" "}
            <a href="/thesis" className="text-blue-600 hover:underline">/thesis</a>, then
            ingest news at{" "}
            <a href="/feed" className="text-blue-600 hover:underline">/feed</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {thesisNodes.map((thesis) => {
            const conns = thesisEdges[thesis.id] || [];
            const supports = conns.filter((c) => c.relation === "SUPPORTS").length;
            const contradicts = conns.filter((c) => c.relation === "CONTRADICTS").length;
            const netScore = supports - contradicts;
            const entityContext = thesisEntityContext[thesis.id] || [];

            return (
              <div key={thesis.id} className="rounded-lg border border-pm-border bg-white p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                          DIRECTION_COLORS[thesis.direction] || DIRECTION_COLORS.neutral
                        }`}
                      >
                        {thesis.direction.toUpperCase()}
                      </span>
                      <span className="text-xs text-pm-muted">{thesis.domain}</span>
                    </div>
                    <h2 className="font-semibold text-pm-text-primary">{thesis.title}</h2>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div
                      className={`text-xl font-bold ${
                        netScore > 0 ? "text-green-600" : netScore < 0 ? "text-red-600" : "text-gray-400"
                      }`}
                    >
                      {netScore > 0 ? "+" : ""}
                      {netScore}
                    </div>
                    <div className="text-xs text-pm-muted">net score</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {supports} for / {contradicts} against
                    </div>
                  </div>
                </div>

                {/* Entity Context */}
                {entityContext.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-pm-border">
                    <div className="text-xs font-medium text-pm-muted mb-1.5">Entity Context</div>
                    <div className="flex flex-wrap gap-1">
                      {entityContext.slice(0, 10).map((entity) => (
                        <span
                          key={entity.id}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            CATEGORY_COLORS[entity.category || "unknown"] || CATEGORY_COLORS.unknown
                          }`}
                        >
                          {entity.name}
                        </span>
                      ))}
                      {entityContext.length > 10 && (
                        <span className="text-xs text-pm-muted">
                          +{entityContext.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {conns.length === 0 ? (
                  <p className="text-xs text-pm-muted italic">
                    No news connections yet. Process news events to generate links.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conns.map((conn, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded border border-pm-border bg-gray-50 px-3 py-2"
                      >
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${
                            RELATION_STYLES[conn.relation] || RELATION_STYLES.MENTIONS
                          }`}
                        >
                          {conn.relation}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug text-pm-text-primary">
                            {conn.news.url ? (
                              <a
                                href={conn.news.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 transition-colors"
                              >
                                {conn.news.title}
                              </a>
                            ) : (
                              conn.news.title
                            )}
                          </p>
                          {conn.reasoning && (
                            <p className="text-xs text-pm-muted mt-0.5 italic">{conn.reasoning}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {conn.news.source && (
                              <span className="text-xs text-gray-500">{conn.news.source}</span>
                            )}
                            {conn.news.publishedAt && (
                              <span className="text-xs text-gray-400">
                                {new Date(conn.news.publishedAt).toLocaleDateString()}
                              </span>
                            )}
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
    </div>
  );
}
