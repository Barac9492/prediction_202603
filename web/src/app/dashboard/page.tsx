import {
  listSignalClusters,
  getRecentEntityObservations,
  getUncoveredEntities,
} from "@/lib/db/graph-queries";

const PATTERN_STYLES: Record<string, string> = {
  convergence: "bg-green-50 text-green-800 border-green-200",
  divergence: "bg-red-50 text-red-800 border-red-200",
  acceleration: "bg-blue-50 text-blue-800 border-blue-200",
  reversal: "bg-orange-50 text-orange-800 border-orange-200",
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

export default async function DashboardPage() {
  const [activeClusters, recentObs, uncoveredEntities] = await Promise.all([
    listSignalClusters("active"),
    getRecentEntityObservations(20),
    getUncoveredEntities(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">Dashboard</h1>
        <p className="text-sm text-pm-muted mt-1">
          Detected patterns, entity signals, and coverage gaps.
        </p>
      </div>

      {/* Detected Patterns */}
      <section>
        <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
          Detected Patterns ({activeClusters.length})
        </h2>
        {activeClusters.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            <p>No active signal clusters detected yet.</p>
            <p className="text-xs mt-1">
              Run the pipeline to populate entity connections and detect patterns.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeClusters.map((cluster) => (
              <div
                key={cluster.id}
                className="rounded-lg border border-pm-border bg-white p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        PATTERN_STYLES[cluster.pattern] || PATTERN_STYLES.convergence
                      }`}
                    >
                      {cluster.pattern.toUpperCase()}
                    </span>
                    <h3 className="font-medium text-pm-text-primary">
                      {cluster.title}
                    </h3>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-lg font-bold text-pm-text-primary">
                      {Math.round(cluster.confidence * 100)}%
                    </div>
                    <div className="text-xs text-pm-muted">confidence</div>
                  </div>
                </div>
                <p className="text-sm text-pm-muted mb-2">{cluster.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    {((cluster.connectionIds as number[]) || []).length} signals
                  </span>
                  <span>
                    {((cluster.entityIds as number[]) || []).length} entities
                  </span>
                  <span>
                    {((cluster.thesisIds as number[]) || []).length} theses
                  </span>
                  <span>
                    Detected{" "}
                    {new Date(cluster.detectedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Entity Activity */}
      <section>
        <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
          Entity Activity
        </h2>
        {recentObs.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            <p>No entity observations yet.</p>
            <p className="text-xs mt-1">
              Observations are extracted from news articles during ingestion.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-pm-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-pm-muted">
                    Entity
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-pm-muted">
                    Attribute
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-pm-muted">
                    Value
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-pm-muted">
                    Confidence
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-pm-muted">
                    Observed
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentObs.map((row) => (
                  <tr
                    key={row.observation.id}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            CATEGORY_COLORS[row.entityCategory || "unknown"] ||
                            CATEGORY_COLORS.unknown
                          }`}
                        >
                          {row.entityName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-pm-muted">
                      {row.observation.attribute.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-pm-text-primary">
                      {row.observation.value}
                      {row.observation.numericValue != null && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({row.observation.numericValue})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{
                            width: `${row.observation.confidence * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {new Date(
                        row.observation.observedAt
                      ).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Uncovered Entities */}
      <section>
        <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
          Uncovered Entities
          <span className="text-sm font-normal text-pm-muted ml-2">
            (entities with signals but no thesis coverage)
          </span>
        </h2>
        {uncoveredEntities.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            <p>All entities are covered by at least one thesis.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-pm-border bg-white p-4">
            <div className="flex flex-wrap gap-2">
              {uncoveredEntities.map((item) => (
                <div
                  key={item.entity.id}
                  className="flex items-center gap-1.5 rounded-full border border-pm-border bg-gray-50 px-3 py-1.5"
                >
                  <span className="text-sm font-medium text-pm-text-primary">
                    {item.entity.name}
                  </span>
                  <span className="text-xs text-pm-muted">
                    {item.signalCount} signals
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      CATEGORY_COLORS[
                        item.entity.category || "unknown"
                      ] || CATEGORY_COLORS.unknown
                    }`}
                  >
                    {item.entity.category || item.entity.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
