export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getEntity,
  getEntityTimeline,
  getEntityNetwork,
} from "@/lib/db/graph-queries";
import { getCurrentProbabilities } from "@/lib/db/probability";
import { getWorkspaceId } from "@/lib/db/workspace";
import { EntityTimelineChart } from "./timeline-chart";

const CATEGORY_COLORS: Record<string, string> = {
  company: "bg-blue-100 text-blue-800",
  person: "bg-purple-100 text-purple-800",
  technology: "bg-emerald-100 text-emerald-800",
  product: "bg-orange-100 text-orange-800",
  concept: "bg-pink-100 text-pink-800",
  regulatory_body: "bg-red-100 text-red-800",
  unknown: "bg-gray-100 text-gray-600",
};

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();

  const entity = await getEntity(workspaceId, Number(id));
  if (!entity) return notFound();

  const [timeline, network, probabilities] = await Promise.all([
    getEntityTimeline(workspaceId, entity.id),
    getEntityNetwork(workspaceId, entity.id),
    getCurrentProbabilities(workspaceId),
  ]);

  // Build probability lookup
  const probMap = new Map(probabilities.map((p) => [p.thesisId, p]));

  // Extract connected theses from network
  const connectedTheses = (network?.relatedTheses ?? []).map((t: any) => ({
    ...t,
    prob: probMap.get(t.id),
  }));

  // Extract neighbor entities
  const neighbors = network?.neighbors ?? [];

  // Extract related news
  const relatedNews = network?.relatedNews ?? [];

  // Group timeline observations by attribute for chart
  const timelineWithNumbers = timeline.filter(
    (o: any) => o.numericValue != null
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              CATEGORY_COLORS[entity.category || "unknown"] ||
              CATEGORY_COLORS.unknown
            }`}
          >
            {entity.category || entity.type || "entity"}
          </span>
          <span className="text-xs text-pm-text-meta">{entity.type}</span>
        </div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          {entity.name}
        </h1>
        {entity.description && (
          <p className="mt-1 text-sm text-pm-muted">{entity.description}</p>
        )}
      </div>

      {/* Observation Timeline Chart */}
      {timelineWithNumbers.length >= 2 && (
        <section>
          <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
            Observation Timeline
          </h2>
          <div className="rounded-lg border border-pm-border bg-white p-4">
            <EntityTimelineChart
              data={timelineWithNumbers.map((o: any) => ({
                date: new Date(o.observedAt).toLocaleDateString(),
                value: o.numericValue,
                attribute: o.attribute,
              }))}
            />
          </div>
        </section>
      )}

      {/* Connected Theses */}
      {connectedTheses.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
            Connected Theses ({connectedTheses.length})
          </h2>
          <div className="space-y-2">
            {connectedTheses.map((t: any) => (
              <Link
                key={t.id}
                href={`/thesis/${t.id}`}
                className="flex items-center gap-3 rounded-lg border border-pm-border bg-white p-3 hover:bg-pm-bg-search transition-colors"
              >
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${
                    t.direction === "bullish"
                      ? "text-green-700 border-green-200 bg-green-50"
                      : t.direction === "bearish"
                        ? "text-red-700 border-red-200 bg-red-50"
                        : "text-yellow-700 border-yellow-200 bg-yellow-50"
                  }`}
                >
                  {t.direction}
                </span>
                <span className="text-sm font-medium text-pm-text-primary truncate">
                  {t.title}
                </span>
                {t.prob && (
                  <div className="ml-auto shrink-0 text-right">
                    <span className="text-sm font-bold text-pm-text-primary">
                      {Math.round(t.prob.probability * 100)}%
                    </span>
                    {t.prob.momentum != null && (
                      <span
                        className={`ml-2 text-xs ${
                          t.prob.momentum > 0
                            ? "text-green-600"
                            : t.prob.momentum < 0
                              ? "text-red-600"
                              : "text-pm-muted"
                        }`}
                      >
                        {t.prob.momentum > 0 ? "+" : ""}
                        {(t.prob.momentum * 100).toFixed(1)}pp
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* News Mentions */}
      {relatedNews.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
            News Mentions ({relatedNews.length})
          </h2>
          <div className="space-y-2">
            {relatedNews.slice(0, 20).map((n: any) => (
              <div
                key={n.id}
                className="flex items-center gap-3 rounded-lg border border-pm-border bg-white p-3"
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    n.sentiment === "bullish"
                      ? "bg-green-500"
                      : n.sentiment === "bearish"
                        ? "bg-red-500"
                        : "bg-gray-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-pm-text-primary">
                    {n.title}
                  </p>
                  <p className="text-xs text-pm-muted">
                    {n.source}
                    {n.publishedAt && (
                      <span className="ml-2">
                        {new Date(n.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Observation Log */}
      {timeline.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
            All Observations ({timeline.length})
          </h2>
          <div className="rounded-lg border border-pm-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
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
                {timeline.map((o: any) => (
                  <tr
                    key={o.id}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2 text-pm-text-primary">
                      {o.attribute.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-pm-text-primary">
                      {o.value}
                      {o.numericValue != null && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({o.numericValue})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${o.confidence * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {new Date(o.observedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Network Neighbors */}
      {neighbors.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-pm-text-primary mb-3">
            Network Neighbors ({neighbors.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {neighbors.map((n: any) => (
              <Link
                key={n.id}
                href={`/entities/${n.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-pm-border bg-white px-3 py-1.5 hover:bg-pm-bg-search transition-colors"
              >
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    CATEGORY_COLORS[n.category || "unknown"] ||
                    CATEGORY_COLORS.unknown
                  }`}
                >
                  {n.category || n.type}
                </span>
                <span className="text-sm font-medium text-pm-text-primary">
                  {n.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
