export const dynamic = "force-dynamic";

import Link from "next/link";
import { listPredictions } from "@/lib/db/queries";
import { listTheses } from "@/lib/db/graph-queries";
import { db } from "@/lib/db/index";
import { thesisProbabilitySnapshots, theses as thesesTable } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

const directionColor: Record<string, string> = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    neutral: "text-yellow-400",
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

  const [preds, snapshots, allTheses] = await Promise.all([
        listPredictions(f),
        getRecentSnapshots(50),
        listTheses(),
      ]);

  const resolvedTheses = allTheses.filter(
        (t) => t.status?.startsWith("resolved_")
      );

  return (
        <div className="space-y-6">
              <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold">Prediction Log</h1>
              </div>
        
          {/* Tab bar */}
              <div className="flex gap-1 border-b border-zinc-800 pb-2">
                      <Link
                                  href="/log?tab=predictions"
                                  className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                                                activeTab === "predictions"
                                                  ? "bg-zinc-800 text-white"
                                                  : "text-zinc-500 hover:text-white"
                                  }`}
                                >
                                Analysis Predictions ({preds.length})
                      </Link>
                      <Link
                                  href="/log?tab=snapshots"
                                  className={`rounded-t-md px-4 py-2 text-sm font-medium ${
                                                activeTab === "snapshots"
                                                  ? "bg-zinc-800 text-white"
                                                  : "text-zinc-500 hover:text-white"
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
                                                                          ? "bg-zinc-800 text-white"
                                                                          : "text-zinc-500 hover:text-white"
                                                    }`}
                                                  >
                                    {v}
                                  </Link>
                                ))}
                            </div>
                  
                    {preds.length === 0 ? (
                                <div className="rounded-lg border border-zinc-800 p-8 text-center">
                                              <p className="text-sm text-zinc-500">
                                                              No analysis predictions yet.
                                              </p>
                                              <p className="mt-2 text-xs text-zinc-600">
                                                              Use the{" "}
                                                              <Link href="/analyze" className="text-blue-400 hover:underline">
                                                                                Analyze
                                                              </Link>{" "}
                                                              page to create signal-based predictions from URLs and text.
                                              </p>
                                </div>
                              ) : (
                                <div className="overflow-hidden rounded-lg border border-zinc-800">
                                              <table className="w-full text-sm">
                                                              <thead>
                                                                                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase tracking-wider text-zinc-500">
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
                                                                              className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                                                                            >
                                                                            <td className="px-4 py-2 text-zinc-500">{p.id}</td>
                                                                            <td className="px-4 py-2 text-zinc-500">
                                                                              {p.createdAt
                                                                                                          ? new Date(p.createdAt).toLocaleDateString()
                                                                                                          : "\u2014"}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                                    <span className="text-zinc-300">{p.topic}</span>
                                                                            </td>
                                                                            <td
                                                                                                      className={`px-4 py-2 font-medium uppercase ${
                                                                                                                                  directionColor[p.direction] || "text-zinc-400"
                                                                                                        }`}
                                                                                                    >
                                                                              {p.direction}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-zinc-300">
                                                                              {p.confidence}%
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                              {p.actualOutcome ? (
                                                                                                        <span
                                                                                                                                      className={`text-xs font-medium uppercase ${
                                                                                                                                                                      p.direction === p.actualOutcome
                                                                                                                                                                        ? "text-green-400"
                                                                                                                                                                        : "text-red-400"
                                                                                                                                        }`}
                                                                                                                                    >
                                                                                                          {p.actualOutcome}
                                                                                                          {p.direction === p.actualOutcome
                                                                                                                                          ? " \u2713"
                                                                                                                                          : " \u2717"}
                                                                                                          </span>
                                                                                                      ) : (
                                                                                                        <span className="text-xs text-zinc-600">pending</span>
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
                                              <h2 className="text-lg font-semibold text-zinc-300">
                                                              Resolved Theses
                                              </h2>
                                              <div className="overflow-hidden rounded-lg border border-zinc-800">
                                                              <table className="w-full text-sm">
                                                                                <thead>
                                                                                                    <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase tracking-wider text-zinc-500">
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
                                                                                  className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                                                                                >
                                                                                <td className="px-4 py-2 text-zinc-300 max-w-xs truncate">
                                                                                  {t.title}
                                                                                  </td>
                                                                                <td
                                                                                                            className={`px-4 py-2 font-medium uppercase ${
                                                                                                                                          directionColor[t.direction] || "text-zinc-400"
                                                                                                              }`}
                                                                                                          >
                                                                                  {t.direction}
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-zinc-300">
                                                                                  {t.finalProbability != null
                                                                                                                ? `${(t.finalProbability * 100).toFixed(0)}%`
                                                                                                                : "\u2014"}
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-zinc-400">
                                                                                  {t.brierScore != null
                                                                                                                ? t.brierScore.toFixed(3)
                                                                                                                : "\u2014"}
                                                                                  </td>
                                                                                <td className="px-4 py-2">
                                                                                                          <span
                                                                                                                                        className={`text-xs font-medium ${
                                                                                                                                                                        t.status === "resolved_correct"
                                                                                                                                                                          ? "text-green-400"
                                                                                                                                                                          : "text-red-400"
                                                                                                                                          }`}
                                                                                                                                      >
                                                                                                            {t.status === "resolved_correct"
                                                                                                                                            ? "Correct \u2713"
                                                                                                                                            : "Incorrect \u2717"}
                                                                                                            </span>
                                                                                  </td>
                                                                                <td className="px-4 py-2 text-zinc-500 text-xs">
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
                                <div className="rounded-lg border border-zinc-800 p-8 text-center">
                                              <p className="text-sm text-zinc-500">
                                                              No probability snapshots yet.
                                              </p>
                                              <p className="mt-2 text-xs text-zinc-600">
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
                                <div className="overflow-hidden rounded-lg border border-zinc-800">
                                              <table className="w-full text-sm">
                                                              <thead>
                                                                                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase tracking-wider text-zinc-500">
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
                                                                              className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                                                                            >
                                                                            <td className="px-4 py-2 text-zinc-500 text-xs">
                                                                              {new Date(s.computedAt).toLocaleString()}
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                                                    <Link
                                                                                                                                href="/predictions"
                                                                                                                                className="text-zinc-300 hover:text-white hover:underline"
                                                                                                                              >
                                                                                                      {s.thesisTitle}
                                                                                                      </Link>
                                                                            </td>
                                                                            <td
                                                                                                      className={`px-4 py-2 font-medium uppercase text-xs ${
                                                                                                                                  directionColor[s.thesisDirection] || "text-zinc-400"
                                                                                                        }`}
                                                                                                    >
                                                                              {s.thesisDirection}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-zinc-300">
                                                                              {(s.probability * 100).toFixed(1)}%
                                                                            </td>
                                                                            <td className="px-4 py-2">
                                                                              {s.momentum != null ? (
                                                                                                        <span
                                                                                                                                      className={`text-xs font-medium ${
                                                                                                                                                                      s.momentum > 0
                                                                                                                                                                        ? "text-green-400"
                                                                                                                                                                        : s.momentum < 0
                                                                                                                                                                        ? "text-red-400"
                                                                                                                                                                        : "text-zinc-500"
                                                                                                                                        }`}
                                                                                                                                    >
                                                                                                          {s.momentum > 0 ? "+" : ""}
                                                                                                          {(s.momentum * 100).toFixed(1)}%
                                                                                                          </span>
                                                                                                      ) : (
                                                                                                        <span className="text-xs text-zinc-600">\u2014</span>
                                                                                                    )}
                                                                            </td>
                                                                            <td className="px-4 py-2 text-zinc-400">
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
