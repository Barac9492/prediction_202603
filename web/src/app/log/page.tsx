export const dynamic = "force-dynamic";

import Link from "next/link";
import { listPredictions, listStalePredictions } from "@/lib/db/queries";
import { listTheses } from "@/lib/db/graph-queries";
import { db } from "@/lib/db/index";
import { thesisProbabilitySnapshots, theses as thesesTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

const directionColor: Record<string, string> = {
    bullish: "text-green-600",
    bearish: "text-red-600",
    neutral: "text-yellow-600",
};

async function getRecentSnapshots(limit = 30) {
    return db
      .select({
              id: thesisProbabilitySnapshots.id,
              thesisId: thesisProbabilitySnapshots.thesisId,
              probability: thesisProbabilitySnapshots.probability,
              momentum: thesisProbabilitySnapshots.momentum,
              signalCount: thesisProbabilitySnapshots.signalCount,
              computedAt: thesisProbabilitySnapshots.computedAt,
              thesisTitle: thesesTable.title,
              thesisDirection: thesesTable.direction,
      })
      .from(thesisProbabilitySnapshots)
      .innerJoin(thesesTable, eq(thesisProbabilitySnapshots.thesisId, thesesTable.id))
      .orderBy(desc(thesisProbabilitySnapshots.computedAt))
      .limit(limit);
}

export default async function LogPage({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string; tab?: string }>;
}) {
    const { filter, tab } = await searchParams;
    const activeTab = tab === "snapshots" ? "snapshots" : "predictions";
    const f = (filter as "all" | "pending" | "resolved") || "all";

  const [preds, stale, snapshots, allTheses] = await Promise.all([
        listPredictions(f),
        listStalePredictions(7, 5),
        getRecentSnapshots(50),
        listTheses(),
      ]);

  const resolvedTheses = allTheses.filter(
        (t) => t.status?.startsWith("resolved_")
      );

  return (
        <div className="space-y-6">
              {/* Resolution nudge banner */}
              {stale.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-amber-700">
                        {stale.length} prediction{stale.length > 1 ? "s" : ""} awaiting resolution
                      </h3>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Recording outcomes improves calibration accuracy and strengthens the knowledge graph.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stale.map((p) => (
                      <Link
                        key={p.id}
                        href={`/predictions/${p.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        <span className={`font-medium uppercase ${directionColor[p.direction] || ""}`}>
                          {p.direction}
                        </span>
                        <span className="text-amber-400">|</span>
                        <span className="truncate max-w-[200px]">{p.topic}</span>
                        <span className="text-amber-500 text-[10px]">
                          {p.createdAt
                            ? `${Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)}d ago`
                            : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold">Prediction Log</h1>
              </div>

          {/* Tab bar */}
              <div className="flex gap-1 border-b border-pm-border pb-2">
                      <Link
                                  href="/log?tab=predictions"
                                  className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                                                activeTab === "predictions"
                                                  ? "bg-pm-bg-search text-pm-text-primary"
                                                  : "text-pm-text-secondary hover:text-pm-text-primary"
                                  }`}
                                >
                                Analysis Predictions ({preds.length})
                      </Link>
                      <Link
                                  href="/log?tab=snapshots"
                                  className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                                                activeTab === "snapshots"
                                                  ? "bg-pm-bg-search text-pm-text-primary"
                                                  : "text-pm-text-secondary hover:text-pm-text-primary"
                                  }`}
                                >
                                Probability Snapshots ({snapshots.length})
                      </Link>
              </div>

          {activeTab === "predictions" && (
                  <>
                    {/* Filter pills */}
                            <div className="flex gap-1">
                              {(["all", "pending", "resolved"] as const).map((v) => (
                                  <Link
                                                    key={v}
                                                    href={`/log?tab=predictions&filter=${v}`}
                                                    className={`rounded-md px-3 py-1 text-sm capitalize ${
                                                                        f === v
                                                                          ? "bg-pm-bg-search text-pm-text-primary"
                                                                          : "text-pm-text-secondary hover:text-pm-text-primary"
                                                    }`}
                                                  >
                                    {v}
                                  </Link>
                                ))}
                            </div>

                    {preds.length === 0 ? (
                                <div className="rounded-lg border border-pm-border p-8 text-center">
                                              <p className="text-sm text-pm-text-secondary">
                                                              No analysis predictions yet.
                                              </p>
                                              <p className="mt-2 text-xs text-pm-text-meta">
                                                              Use the{" "}
                                                              <Link href="/analyze" className="text-blue-400 hover:underline">
                                                                                Analyze
                                                              </Link>{" "}
                                                              page to create signal-based predictions from URLs and text.
                                              </p>
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-pm-border">
                                              <table className="w-full text-sm">
                                                              <thead>
                                                                                <tr className="border-b border-pm-border bg-white text-left text-xs uppercase tracking-wider text-pm-text-secondary">
                                                                                                    <th className="px-4 py-2">ID</th>
                                                                                                    <th className="px-4 py-2">Date</th>
                                                                                                    <th className="px-4 py-2">Topic</th>
                                                                                                    <th className="px-4 py-2">Direction</th>
                                                                                                    <th className="px-4 py-2">Confidence</th>
                                                                                                    <th className="px-4 py-2">Outcome</th>
                                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {preds.map((p) => (
                                                      <tr
                                                                              key={p.id}
                                                                              className="border-b border-pm-border hover:bg-pm-bg-search"
                                                                            >
                                                                            <td className="px-4 py-2 text-pm-text-secondary">{p.id}</td>
                                                                            <td className="px-4 py-2 text-pm-text-secondary">
                                                                              {p.createdAt
                                                                                                          ? new Date(p.createdAt).toLocaleDateString()
                                                                                                          : "\u2014"}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                                    <span className="text-pm-text-primary">{p.topic}</span>
                                                                            </td>
                                                                            <td
                                                                                                      className={`px-4 py-2 font-medium uppercase ${
                                                                                                                                  directionColor[p.direction] || "text-pm-muted"
                                                                                                        }`}
                                                                                                    >
                                                                              {p.direction}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-pm-text-primary">
                                                                              {p.confidence}%
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                              {p.actualOutcome ? (
                                                                                                        <span
                                                                                                                                      className={`text-xs font-medium uppercase ${
                                                                                                                                                                      p.direction === p.actualOutcome
                                                                                                                                                                        ? "text-green-600"
                                                                                                                                                                        : "text-red-600"
                                                                                                                                        }`}
                                                                                                                                    >
                                                                                                          {p.actualOutcome}
                                                                                                          {p.direction === p.actualOutcome
                                                                                                                                          ? " \u2713"
                                                                                                                                          : " \u2717"}
                                                                                                          </span>
                                                                                                      ) : (
                                                                                                        <span className="text-xs text-pm-text-meta">pending</span>
                                                                                                    )}
                                                                            </td>
                                                      </tr>
                                                    ))}
                                                              </tbody>
                                              </table>
                                </div>
                            )}

                    {/* Resolved Theses summary */}
                    {resolvedTheses.length > 0 && (
                                <div className="space-y-3">
                                              <h2 className="text-lg font-semibold text-pm-text-primary">
                                                              Resolved Theses
                                              </h2>
                                              <div className="overflow-hidden rounded-lg border border-pm-border">
                                                              <table className="w-full text-sm">
                                                                                <thead>
                                                                                                    <tr className="border-b border-pm-border bg-white text-left text-xs uppercase tracking-wider text-pm-text-secondary">
                                                                                                                          <th className="px-4 py-2">Thesis</th>
                                                                                                                          <th className="px-4 py-2">Direction</th>
                                                                                                                          <th className="px-4 py-2">Final Prob</th>
                                                                                                                          <th className="px-4 py-2">Brier</th>
                                                                                                                          <th className="px-4 py-2">Result</th>
                                                                                                                          <th className="px-4 py-2">Resolved</th>
                                                                                                      </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                  {resolvedTheses.map((t) => (
                                                        <tr
                                                                                  key={t.id}
                                                                                  className="border-b border-pm-border hover:bg-pm-bg-search"
                                                                                >
                                                                                <td className="px-4 py-2 text-pm-text-primary max-w-xs truncate">
                                                                                  {t.title}
                                                                                  </td>
                                                                                <td
                                                                                                            className={`px-4 py-2 font-medium uppercase ${
                                                                                                                                          directionColor[t.direction] || "text-pm-muted"
                                                                                                              }`}
                                                                                                          >
                                                                                  {t.direction}
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-pm-text-primary">
                                                                                  {t.finalProbability != null
                                                                                                                ? `${(t.finalProbability * 100).toFixed(0)}%`
                                                                                                                : "\u2014"}
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-pm-muted">
                                                                                  {t.brierScore != null
                                                                                                                ? t.brierScore.toFixed(3)
                                                                                                                : "\u2014"}
                                                                                  </td>
                                                                                <td className="px-4 py-2">
                                                                                                          <span
                                                                                                                                        className={`text-xs font-medium ${
                                                                                                                                                                        t.status === "resolved_correct"
                                                                                                                                                                          ? "text-green-600"
                                                                                                                                                                          : "text-red-600"
                                                                                                                                          }`}
                                                                                                                                      >
                                                                                                            {t.status === "resolved_correct"
                                                                                                                                            ? "Correct \u2713"
                                                                                                                                            : "Incorrect \u2717"}
                                                                                                            </span>
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-pm-text-secondary text-xs">
                                                                                  {t.resolvedAt
                                                                                                                ? new Date(t.resolvedAt).toLocaleDateString()
                                                                                                                : "\u2014"}
                                                                                  </td>
                                                        </tr>
                                                      ))}
                                                                                </tbody>
                                                              </table>
                                              </div>
                                </div>
                            )}
                  </>
                )}

          {activeTab === "snapshots" && (
                  <>
                    {snapshots.length === 0 ? (
                                <div className="rounded-lg border border-pm-border p-8 text-center">
                                              <p className="text-sm text-pm-text-secondary">
                                                              No probability snapshots yet.
                                              </p>
                                              <p className="mt-2 text-xs text-pm-text-meta">
                                                              Use{" "}
                                                              <Link
                                                                                  href="/predictions"
                                                                                  className="text-blue-400 hover:underline"
                                                                                >
                                                                                Compute Probabilities
                                                              </Link>{" "}
                                                              to generate thesis probability snapshots.
                                              </p>
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-pm-border">
                                              <table className="w-full text-sm">
                                                              <thead>
                                                                                <tr className="border-b border-pm-border bg-white text-left text-xs uppercase tracking-wider text-pm-text-secondary">
                                                                                                    <th className="px-4 py-2">Date</th>
                                                                                                    <th className="px-4 py-2">Thesis</th>
                                                                                                    <th className="px-4 py-2">Direction</th>
                                                                                                    <th className="px-4 py-2">Probability</th>
                                                                                                    <th className="px-4 py-2">Momentum</th>
                                                                                                    <th className="px-4 py-2">Signals</th>
                                                                                </tr>
                                                              </thead>
                                                              <tbody>
                                                                {snapshots.map((s) => (
                                                      <tr
                                                                              key={s.id}
                                                                              className="border-b border-pm-border hover:bg-pm-bg-search"
                                                                            >
                                                                            <td className="px-4 py-2 text-pm-text-secondary text-xs">
                                                                              {new Date(s.computedAt).toLocaleString()}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                                    <Link
                                                                                                                                href="/predictions"
                                                                                                                                className="text-pm-text-primary hover:text-pm-text-primary hover:underline"
                                                                                                                              >
                                                                                                      {s.thesisTitle}
                                                                                                      </Link>
                                                                            </td>
                                                                            <td
                                                                                                      className={`px-4 py-2 font-medium uppercase text-xs ${
                                                                                                                                  directionColor[s.thesisDirection] || "text-pm-muted"
                                                                                                        }`}
                                                                                                    >
                                                                              {s.thesisDirection}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-pm-text-primary">
                                                                              {(s.probability * 100).toFixed(1)}%
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                              {s.momentum != null ? (
                                                                                                        <span
                                                                                                                                      className={`text-xs font-medium ${
                                                                                                                                                                      s.momentum > 0
                                                                                                                                                                        ? "text-green-600"
                                                                                                                                                                        : s.momentum < 0
                                                                                                                                                                        ? "text-red-600"
                                                                                                                                                                        : "text-pm-text-secondary"
                                                                                                                                        }`}
                                                                                                                                    >
                                                                                                          {s.momentum > 0 ? "+" : ""}
                                                                                                          {(s.momentum * 100).toFixed(1)}%
                                                                                                          </span>
                                                                                                      ) : (
                                                                                                        <span className="text-xs text-pm-text-meta">{"\u2014"}</span>
                                                                                                    )}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-pm-muted">
                                                                              {s.signalCount}
                                                                            </td>
                                                      </tr>
                                                    ))}
                                                              </tbody>
                                              </table>
                                </div>
                            )}
                  </>
                )}
        </div>
      );
}
