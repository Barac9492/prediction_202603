export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import {
  getThesis,
  getThesisConnections,
  getThesisInteractions,
  getEntitiesForThesis,
  listRecommendations,
  getNewsEventsByIds,
} from "@/lib/db/graph-queries";
import { getProbabilityHistory } from "@/lib/db/probability";
import { ThesisDetail } from "@/components/thesis-detail";
import { getWorkspaceId } from "@/lib/db/workspace";

export default async function ThesisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();

  const thesis = await getThesis(workspaceId, Number(id));
  if (!thesis) return notFound();

  const [history, thesisConnections, interactions, relatedEntities, allRecs] =
    await Promise.all([
      getProbabilityHistory(workspaceId, thesis.id, 90),
      getThesisConnections(workspaceId, thesis.id),
      getThesisInteractions(workspaceId, thesis.id),
      getEntitiesForThesis(workspaceId, thesis.id),
      listRecommendations(workspaceId, { limit: 100 }),
    ]);

  // Get news events from connections where fromType='news_event'
  const newsConnectionIds = thesisConnections
    .filter((c) => c.fromType === "news_event")
    .map((c) => c.fromId);
  const newsEvents = await getNewsEventsByIds(workspaceId, newsConnectionIds);

  // Map connections to news for sentiment info
  const newsWithSentiment = newsEvents.map((ne) => {
    const conn = thesisConnections.find(
      (c) => c.fromType === "news_event" && c.fromId === ne.id
    );
    return { ...ne, connectionDirection: conn?.direction ?? null };
  });

  // Filter recs for this thesis
  const linkedRecs = allRecs.filter((r) => r.thesisId === thesis.id);

  // Resolve related thesis titles for interactions
  const interactionThesisIds = interactions.map((c) =>
    c.fromId === thesis.id ? c.toId : c.fromId
  );
  const uniqueInteractionIds = [...new Set(interactionThesisIds)];
  const relatedThesesMap = new Map<number, string>();
  for (const tid of uniqueInteractionIds) {
    const t = await getThesis(workspaceId, tid);
    if (t) relatedThesesMap.set(tid, t.title);
  }

  const interactionsWithTitles = interactions.map((c) => {
    const otherId = c.fromId === thesis.id ? c.toId : c.fromId;
    return {
      id: c.id,
      relation: c.relation,
      confidence: c.confidence,
      reasoning: c.reasoning,
      otherThesisId: otherId,
      otherThesisTitle: relatedThesesMap.get(otherId) ?? `Thesis #${otherId}`,
    };
  });

  // Compute current stats
  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase ${
              thesis.direction === "bullish"
                ? "bg-green-50 text-green-700 border border-green-200"
                : thesis.direction === "bearish"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-yellow-50 text-yellow-700 border border-yellow-200"
            }`}
          >
            {thesis.direction}
          </span>
          {thesis.domain && (
            <span className="text-xs text-pm-text-meta">{thesis.domain}</span>
          )}
          {thesis.status && (
            <span className="text-xs text-pm-text-meta capitalize">
              {thesis.status.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          {thesis.title}
        </h1>
        <p className="mt-1 text-sm text-pm-text-secondary">
          Created{" "}
          {thesis.createdAt
            ? new Date(thesis.createdAt).toLocaleDateString()
            : "—"}
          {(thesis.tags as string[] | null)?.length
            ? ` · ${(thesis.tags as string[]).join(", ")}`
            : ""}
        </p>
      </div>

      {/* Probability Chart (client component) */}
      {history.length >= 2 && (
        <ThesisDetail
          history={history.map((h) => ({
            probability: h.probability,
            momentum: h.momentum,
            signalCount: h.signalCount,
            computedAt: h.computedAt.toISOString(),
          }))}
          direction={thesis.direction}
        />
      )}

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-pm-border p-3">
          <p className="text-xs text-pm-text-secondary">Current Probability</p>
          <p className="text-lg font-bold text-pm-text-primary">
            {latestSnapshot
              ? `${(latestSnapshot.probability * 100).toFixed(1)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-pm-border p-3">
          <p className="text-xs text-pm-text-secondary">Momentum</p>
          <p
            className={`text-lg font-bold ${
              latestSnapshot?.momentum
                ? latestSnapshot.momentum > 0
                  ? "text-green-600"
                  : "text-red-600"
                : "text-pm-text-primary"
            }`}
          >
            {latestSnapshot?.momentum != null
              ? `${latestSnapshot.momentum > 0 ? "+" : ""}${(latestSnapshot.momentum * 100).toFixed(1)}%`
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-pm-border p-3">
          <p className="text-xs text-pm-text-secondary">Signal Count</p>
          <p className="text-lg font-bold text-pm-text-primary">
            {latestSnapshot?.signalCount ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-pm-border p-3">
          <p className="text-xs text-pm-text-secondary">Recommendations</p>
          <p className="text-lg font-bold text-pm-text-primary">
            {linkedRecs.length}
          </p>
        </div>
      </div>

      {/* Description & Resolution Criteria */}
      {(thesis.description || thesis.resolutionCriteria) && (
        <div className="space-y-4">
          {thesis.description && (
            <div>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
                Description
              </h2>
              <p className="text-sm text-pm-text-primary whitespace-pre-wrap">
                {thesis.description}
              </p>
            </div>
          )}
          {thesis.resolutionCriteria && (
            <div>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
                Resolution Criteria
              </h2>
              <p className="text-sm text-pm-text-primary whitespace-pre-wrap">
                {thesis.resolutionCriteria}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Evidence Trail */}
      {newsWithSentiment.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
            Evidence Trail ({newsWithSentiment.length})
          </h2>
          <div className="space-y-2">
            {newsWithSentiment.map((ne) => (
              <div
                key={ne.id}
                className="flex items-start gap-3 rounded-md border border-pm-border bg-white p-3"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    ne.sentiment === "bullish"
                      ? "bg-green-500"
                      : ne.sentiment === "bearish"
                        ? "bg-red-500"
                        : "bg-gray-400"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pm-text-primary">
                    {ne.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ne.source && (
                      <span className="text-xs text-pm-text-meta">
                        {ne.source}
                      </span>
                    )}
                    {ne.publishedAt && (
                      <span className="text-xs text-pm-text-meta">
                        {new Date(ne.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Entities */}
      {relatedEntities.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
            Related Entities ({relatedEntities.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedEntities.map((e) => (
              <span
                key={e.id}
                className="inline-flex items-center rounded-full border border-pm-border bg-white px-3 py-1 text-xs font-medium text-pm-text-primary"
              >
                {e.name}
                {e.type && (
                  <span className="ml-1.5 text-pm-text-meta">{e.type}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Related Theses (Interactions) */}
      {interactionsWithTitles.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
            Related Theses ({interactionsWithTitles.length})
          </h2>
          <div className="space-y-2">
            {interactionsWithTitles.map((ix) => (
              <a
                key={ix.id}
                href={`/thesis/${ix.otherThesisId}`}
                className="flex items-center gap-3 rounded-md border border-pm-border bg-white p-3 hover:bg-pm-bg-search transition-colors"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    ix.relation === "REINFORCES"
                      ? "bg-green-50 text-green-700"
                      : ix.relation === "CONTRADICTS"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {ix.relation}
                </span>
                <span className="text-sm text-pm-text-primary truncate">
                  {ix.otherThesisTitle}
                </span>
                {ix.confidence != null && (
                  <span className="ml-auto shrink-0 text-xs text-pm-text-meta">
                    {(ix.confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Linked Recommendations */}
      {linkedRecs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
            Linked Recommendations ({linkedRecs.length})
          </h2>
          <div className="space-y-2">
            {linkedRecs.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center gap-3 rounded-md border border-pm-border bg-white p-3"
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    rec.action === "BUY" || rec.action === "LONG"
                      ? "bg-green-50 text-green-700"
                      : rec.action === "SELL" || rec.action === "SHORT"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {rec.action}
                </span>
                <span className="text-sm font-medium text-pm-text-primary">
                  {rec.asset}
                </span>
                <span className="text-xs text-pm-text-meta">
                  Conviction: {rec.conviction}/10
                </span>
                <span className="text-xs text-pm-text-meta">
                  {rec.deadline
                    ? `Deadline: ${new Date(rec.deadline).toLocaleDateString()}`
                    : ""}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                    rec.status === "active"
                      ? "bg-blue-50 text-blue-700"
                      : rec.status === "resolved_correct"
                        ? "bg-green-50 text-green-700"
                        : rec.status === "resolved_incorrect"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-700"
                  }`}
                >
                  {rec.status?.replace(/_/g, " ") ?? "active"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
