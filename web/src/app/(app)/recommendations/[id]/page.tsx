import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceId } from "@/lib/db/workspace";
import {
  getRecommendation,
  getThesis,
  getThesisConnections,
  getNewsEventsByIds,
  getEntitiesForThesis,
} from "@/lib/db/graph-queries";
import { getProbabilityHistory } from "@/lib/db/probability";
import { PriceDisplay } from "@/components/price-display";
import { RecProbabilityChart } from "./probability-chart";
import { timeAgo, shortDate } from "@/lib/format-time";

export const dynamic = "force-dynamic";

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BUY: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
  SELL: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
  HOLD: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-300" },
  WATCH: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  AVOID: { bg: "bg-red-50", text: "text-red-700", border: "border-red-500" },
};

function daysRemaining(deadline: Date) {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspaceId = await getWorkspaceId();
  const { id } = await params;
  const recId = parseInt(id, 10);
  if (isNaN(recId)) notFound();

  const rec = await getRecommendation(workspaceId, recId);
  if (!rec) notFound();

  // Fetch thesis, connections, news, entities, probability history
  let thesis = null;
  let probHistory: Awaited<ReturnType<typeof getProbabilityHistory>> = [];
  let thesisConnections: Awaited<ReturnType<typeof getThesisConnections>> = [];
  let sourceNews: Awaited<ReturnType<typeof getNewsEventsByIds>> = [];
  let relatedEntities: Awaited<ReturnType<typeof getEntitiesForThesis>> = [];

  if (rec.thesisId) {
    [thesis, probHistory, thesisConnections] = await Promise.all([
      getThesis(workspaceId, rec.thesisId),
      getProbabilityHistory(workspaceId, rec.thesisId, 30),
      getThesisConnections(workspaceId, rec.thesisId),
    ]);

    const newsIds = [...new Set(
      thesisConnections
        .map((c) => c.sourceNewsId)
        .filter((id): id is number => id !== null),
    )];

    [sourceNews, relatedEntities] = await Promise.all([
      getNewsEventsByIds(workspaceId, newsIds),
      getEntitiesForThesis(workspaceId, rec.thesisId),
    ]);
  }

  const actionStyle = ACTION_COLORS[rec.action] || ACTION_COLORS.HOLD;
  const isResolved = rec.status !== "active";
  const days = daysRemaining(rec.deadline);
  const convPct = Math.round(rec.conviction * 100);

  // Separate bullish/bearish/neutral signals
  const bullishSignals = thesisConnections.filter((c) => c.direction === "bullish");
  const bearishSignals = thesisConnections.filter((c) => c.direction === "bearish");
  const neutralSignals = thesisConnections.filter((c) => c.direction !== "bullish" && c.direction !== "bearish");

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/"
        className="text-sm text-pm-blue hover:underline"
      >
        &larr; All Recommendations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <span
              className={`rounded-lg border-2 px-4 py-1.5 text-lg font-black ${actionStyle.bg} ${actionStyle.text} ${actionStyle.border}`}
            >
              {rec.action}
            </span>
            {isResolved && (
              <span
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  rec.status === "resolved_correct"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {rec.status === "resolved_correct" ? "Correct" : "Incorrect"}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-pm-text-primary">
            {rec.asset}
          </h1>
          {rec.ticker && (
            <span className="mt-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-sm font-mono text-pm-muted">
              {rec.ticker}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-pm-text-meta">Created</div>
          <div className="text-sm text-pm-text-primary">
            {shortDate(rec.createdAt)}
          </div>
          {isResolved && rec.resolvedAt && (
            <>
              <div className="mt-2 text-xs text-pm-text-meta">Resolved</div>
              <div className="text-sm text-pm-text-primary">
                {shortDate(rec.resolvedAt)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Conviction</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {convPct}%
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-pm-bg-search">
            <div
              className="h-full rounded-full bg-pm-blue"
              style={{ width: `${convPct}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Timeframe</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {rec.timeframeDays}d
          </div>
          <div className="text-xs text-pm-muted">
            {isResolved
              ? `Resolved ${Math.ceil((new Date(rec.resolvedAt!).getTime() - new Date(rec.createdAt).getTime()) / (1000 * 60 * 60 * 24))}d`
              : days > 0
                ? `${days} days left`
                : "Expired"}
          </div>
        </div>

        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            {isResolved ? "Return" : "Live P&L"}
          </div>
          {isResolved && rec.actualReturn !== null ? (
            <div
              className={`mt-1 text-2xl font-bold ${
                rec.actualReturn > 0 ? "text-pm-green" : "text-pm-red"
              }`}
            >
              {rec.actualReturn > 0 ? "+" : ""}
              {(rec.actualReturn * 100).toFixed(1)}%
            </div>
          ) : rec.ticker && rec.priceAtCreation ? (
            <div className="mt-1 text-xl font-bold">
              <PriceDisplay
                ticker={rec.ticker}
                entryPrice={rec.priceAtCreation}
              />
            </div>
          ) : (
            <div className="mt-1 text-2xl font-bold text-pm-text-primary">—</div>
          )}
        </div>

        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Brier Score</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {rec.brierScore !== null ? rec.brierScore.toFixed(3) : "—"}
          </div>
          {rec.brierScore !== null && (
            <div className="text-xs text-pm-muted">
              {rec.brierScore < 0.1
                ? "Excellent"
                : rec.brierScore < 0.2
                  ? "Good"
                  : rec.brierScore < 0.3
                    ? "Fair"
                    : "Poor"}
            </div>
          )}
        </div>
      </div>

      {/* Price Detail */}
      {rec.priceAtCreation !== null && (
        <div className="rounded-xl border border-pm-border p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
            Price Detail
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs text-pm-muted">Entry Price</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-pm-text-primary">
                ${rec.priceAtCreation.toFixed(2)}
              </div>
              <div className="text-xs text-pm-muted">
                {shortDate(rec.createdAt)}
              </div>
            </div>
            {isResolved && rec.priceAtResolution !== null ? (
              <div>
                <div className="text-xs text-pm-muted">Exit Price</div>
                <div className="mt-1 text-xl font-bold tabular-nums text-pm-text-primary">
                  ${rec.priceAtResolution.toFixed(2)}
                </div>
                <div className="text-xs text-pm-muted">
                  {rec.resolvedAt ? shortDate(rec.resolvedAt) : ""}
                </div>
              </div>
            ) : rec.ticker ? (
              <div>
                <div className="text-xs text-pm-muted">Current Price</div>
                <div className="mt-1 text-xl font-bold">
                  <PriceDisplay
                    ticker={rec.ticker}
                    entryPrice={rec.priceAtCreation}
                  />
                </div>
              </div>
            ) : null}
            <div>
              <div className="text-xs text-pm-muted">
                {isResolved ? "Actual Return" : "Unrealized P&L"}
              </div>
              {rec.actualReturn !== null ? (
                <div
                  className={`mt-1 text-xl font-bold tabular-nums ${
                    rec.actualReturn > 0 ? "text-pm-green" : "text-pm-red"
                  }`}
                >
                  {rec.actualReturn > 0 ? "+" : ""}
                  {(rec.actualReturn * 100).toFixed(2)}%
                </div>
              ) : (
                <div className="mt-1 text-xl font-bold text-pm-muted">—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="rounded-xl border border-pm-border p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
          Rationale
        </h2>
        <p className="text-sm leading-relaxed text-pm-text-primary">
          {rec.rationale}
        </p>
        {rec.outcomeNotes && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <div className="mb-1 text-xs font-medium text-pm-text-meta">
              Outcome Notes
            </div>
            <p className="text-sm text-pm-text-secondary">{rec.outcomeNotes}</p>
          </div>
        )}
      </div>

      {/* Thesis Context */}
      {thesis && (
        <div className="rounded-xl border border-pm-border p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
            Underlying Thesis
          </h2>
          <div className="mb-4 flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                thesis.direction === "bullish"
                  ? "bg-green-100 text-green-700"
                  : thesis.direction === "bearish"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {thesis.direction.toUpperCase()}
            </span>
            <Link
              href={`/thesis/${thesis.id}`}
              className="font-medium text-pm-text-primary hover:text-pm-blue"
            >
              {thesis.title}
            </Link>
            <span className="text-xs text-pm-muted">{thesis.domain}</span>
          </div>
          <p className="mb-4 text-sm text-pm-text-secondary">
            {thesis.description}
          </p>

          {/* Probability at creation vs resolution */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            {rec.probabilityAtCreation !== null && (
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <div className="text-xs text-pm-muted">Probability at Entry</div>
                <div className="mt-1 text-lg font-bold text-pm-text-primary">
                  {(rec.probabilityAtCreation * 100).toFixed(0)}%
                </div>
              </div>
            )}
            {rec.probabilityAtResolution !== null && (
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <div className="text-xs text-pm-muted">
                  Probability at Resolution
                </div>
                <div className="mt-1 text-lg font-bold text-pm-text-primary">
                  {(rec.probabilityAtResolution * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>

          {/* Probability chart */}
          {probHistory.length > 1 && (
            <RecProbabilityChart
              data={probHistory.map((p) => ({
                date: new Date(p.computedAt).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                }),
                probability: Math.round(p.probability * 100),
              }))}
            />
          )}
        </div>
      )}

      {/* Signal Breakdown */}
      {thesisConnections.length > 0 && (
        <div className="rounded-xl border border-pm-border p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
            Signal Breakdown ({thesisConnections.length} signals)
          </h2>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {bullishSignals.length}
              </div>
              <div className="text-xs text-green-600">Bullish</div>
            </div>
            <div className="rounded-lg bg-red-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-red-700">
                {bearishSignals.length}
              </div>
              <div className="text-xs text-red-600">Bearish</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-center">
              <div className="text-2xl font-bold text-gray-700">
                {neutralSignals.length}
              </div>
              <div className="text-xs text-gray-600">Neutral</div>
            </div>
          </div>

          {/* Signal strength bar */}
          {thesisConnections.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-xs text-pm-muted">
                Signal Balance
              </div>
              <div className="flex h-3 overflow-hidden rounded-full">
                {bullishSignals.length > 0 && (
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${(bullishSignals.length / thesisConnections.length) * 100}%`,
                    }}
                  />
                )}
                {neutralSignals.length > 0 && (
                  <div
                    className="bg-gray-300"
                    style={{
                      width: `${(neutralSignals.length / thesisConnections.length) * 100}%`,
                    }}
                  />
                )}
                {bearishSignals.length > 0 && (
                  <div
                    className="bg-red-500"
                    style={{
                      width: `${(bearishSignals.length / thesisConnections.length) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Top signals with reasoning */}
          <div className="space-y-2">
            {thesisConnections
              .filter((c) => c.reasoning)
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 8)
              .map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-start gap-2 rounded-lg border border-pm-border bg-white px-3 py-2"
                >
                  <span
                    className={`mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                      conn.direction === "bullish"
                        ? "bg-green-500"
                        : conn.direction === "bearish"
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-pm-text-secondary">
                      {conn.reasoning}
                    </p>
                    <div className="mt-0.5 flex gap-3 text-xs text-pm-muted">
                      <span>
                        Confidence: {(conn.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="capitalize">{conn.direction}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Source News */}
      {sourceNews.length > 0 && (
        <div className="rounded-xl border border-pm-border p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
            Source News ({sourceNews.length})
          </h2>
          <div className="space-y-2">
            {sourceNews.map((news) => (
              <div
                key={news.id}
                className="flex items-start justify-between rounded-lg border border-pm-border bg-white px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  {news.url ? (
                    <a
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-pm-blue hover:underline"
                    >
                      {news.title}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-pm-text-primary">
                      {news.title}
                    </span>
                  )}
                  {news.source && (
                    <span className="ml-2 text-xs text-pm-muted">
                      {news.source}
                    </span>
                  )}
                  {news.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-pm-text-secondary">
                      {news.summary}
                    </p>
                  )}
                </div>
                {news.publishedAt && (
                  <span className="ml-4 shrink-0 text-xs text-pm-muted">
                    {timeAgo(news.publishedAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Entities */}
      {relatedEntities.length > 0 && (
        <div className="rounded-xl border border-pm-border p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-pm-text-meta">
            Related Entities ({relatedEntities.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedEntities.map((entity) => (
              <div
                key={entity.id}
                className="rounded-lg border border-pm-border bg-white px-3 py-2"
              >
                <div className="text-sm font-medium text-pm-text-primary">
                  {entity.name}
                </div>
                <div className="text-xs text-pm-muted">
                  {entity.category || entity.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
