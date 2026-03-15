import {
  listSignalClusters,
  getRecentEntityObservations,
  getUncoveredEntities,
  getRecentNews,
  getProbabilityMovers,
  getContradictingEvidence,
} from "@/lib/db/graph-queries";
import { getCurrentProbabilities, getLastPipelineRun } from "@/lib/db/probability";
import Link from "next/link";
import { getWorkspaceId } from "@/lib/db/workspace";
import { timeAgo } from "@/lib/format-time";
import { DataFreshness } from "@/components/data-freshness";
import { AutoRefresh } from "@/components/auto-refresh";

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
  const workspaceId = await getWorkspaceId();

  const [activeClusters, recentObs, uncoveredEntities, recentNews, movers, currentProbs, lastRun] = await Promise.all([
    listSignalClusters(workspaceId, "active"),
    getRecentEntityObservations(workspaceId, 20),
    getUncoveredEntities(workspaceId),
    getRecentNews(workspaceId, 5),
    getProbabilityMovers(workspaceId, 5),
    getCurrentProbabilities(workspaceId),
    getLastPipelineRun(workspaceId),
  ]);

  const lastRunIso = lastRun?.toISOString() ?? null;
  const isStaleData = lastRun ? Date.now() - lastRun.getTime() > 24 * 60 * 60 * 1000 : true;

  // Find high-conviction theses and check for contradicting evidence
  const highConviction = currentProbs.filter(
    (t) => t.probability > 0.75 || t.probability < 0.25
  );
  const contradictions = highConviction.length > 0
    ? await getContradictingEvidence(
        workspaceId,
        highConviction.map((t) => ({ thesisId: t.thesisId, direction: t.direction }))
      )
    : [];

  // Group contradictions by thesis
  const contradictionsByThesis = new Map<number, typeof contradictions>();
  for (const c of contradictions) {
    const arr = contradictionsByThesis.get(c.thesisId) ?? [];
    arr.push(c);
    contradictionsByThesis.set(c.thesisId, arr);
  }
  const contradictedTheses = highConviction.filter(
    (t) => contradictionsByThesis.has(t.thesisId)
  );

  return (
    <AutoRefresh>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pm-text-primary">Dashboard</h1>
          <p className="text-sm text-pm-muted mt-1">
            Detected patterns, entity signals, and coverage gaps.
          </p>
        </div>
        <DataFreshness lastUpdated={lastRunIso} />
      </div>

      {isStaleData && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No pipeline run in the last 24 hours. Data may be outdated.{" "}
          <Link href="/feed" className="font-medium underline hover:text-red-900">
            Run pipeline
          </Link>
        </div>
      )}

      {/* Contradiction Alert */}
      {contradictedTheses.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-amber-800">
              Contradicting Evidence Detected
            </h2>
            <Link
              href="/briefing"
              className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
            >
              View briefing
            </Link>
          </div>
          <div className="space-y-2">
            {contradictedTheses.map((t) => {
              const news = contradictionsByThesis.get(t.thesisId) ?? [];
              const severity = t.probability > 0.85 || t.probability < 0.15;
              return (
                <div
                  key={t.thesisId}
                  className={`rounded border px-3 py-2 ${
                    severity
                      ? "border-red-300 bg-red-50"
                      : "border-amber-200 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${severity ? "text-red-700" : "text-amber-700"}`}>
                      {severity ? "HIGH" : "WARN"}
                    </span>
                    <Link
                      href={`/thesis/${t.thesisId}`}
                      className="text-sm font-medium text-pm-text-primary hover:text-pm-blue"
                    >
                      {t.title}
                    </Link>
                    <span className="text-xs text-pm-muted">
                      {Math.round(t.probability * 100)}% {t.direction}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {news.map((n) => (
                      <span
                        key={n.newsId}
                        className="text-xs text-pm-muted"
                      >
                        {n.newsSource ? `${n.newsSource}: ` : ""}{n.newsTitle.length > 60 ? n.newsTitle.slice(0, 60) + "..." : n.newsTitle}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
                    Detected {timeAgo(cluster.detectedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent News */}
      <section>
        <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
          Recent News
        </h2>
        {recentNews.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            <p>No news events yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentNews.map((news) => (
              <div
                key={news.id}
                className="flex items-center gap-3 rounded-lg border border-pm-border bg-white p-3"
              >
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                    news.sentiment === "bullish"
                      ? "bg-green-500"
                      : news.sentiment === "bearish"
                        ? "bg-red-500"
                        : "bg-gray-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-pm-text-primary">
                    {news.title}
                  </p>
                  <p className="text-xs text-pm-muted">
                    {news.source}
                    {news.publishedAt && (
                      <span className="ml-2">
                        {timeAgo(news.publishedAt)}
                      </span>
                    )}
                  </p>
                </div>
                {news.sentiment && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      news.sentiment === "bullish"
                        ? "bg-green-100 text-green-700"
                        : news.sentiment === "bearish"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {news.sentiment}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Probability Movers */}
      <section>
        <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
          Probability Movers
        </h2>
        {movers.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            <p>No probability snapshots yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {movers.map((m) => {
              const mom = m.momentum ?? 0;
              const absMom = Math.abs(mom);
              return (
                <Link
                  key={m.thesisId}
                  href={`/thesis/${m.thesisId}`}
                  className="flex items-center gap-3 rounded-lg border border-pm-border bg-white p-3 hover:bg-pm-bg-search transition-colors"
                >
                  <span
                    className={`text-lg ${
                      absMom < 0.005
                        ? "text-pm-muted"
                        : mom > 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {absMom < 0.005 ? "–" : mom > 0 ? "▲" : "▼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-pm-text-primary">
                      {m.thesisTitle}
                    </p>
                    <p className="text-xs text-pm-muted">
                      {Math.round(m.probability * 100)}% · {m.thesisDirection}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      absMom < 0.005
                        ? "text-pm-muted"
                        : mom > 0
                          ? "text-green-600"
                          : "text-red-600"
                    }`}
                  >
                    {absMom < 0.005
                      ? "—"
                      : absMom < 0.05
                        ? `${mom > 0 ? "+" : "-"}${(absMom * 100).toFixed(1)}pp`
                        : `${mom > 0 ? "+" : "-"}${Math.round(absMom * 100)}pp`}
                  </span>
                </Link>
              );
            })}
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
                      {timeAgo(row.observation.observedAt)}
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
    </AutoRefresh>
  );
}
