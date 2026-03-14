"use client";

import Link from "next/link";
import { GenerateRecsPanel } from "./generate-recs-panel";

type Recommendation = {
  id: number;
  thesisId: number | null;
  action: string;
  asset: string;
  conviction: number;
  timeframeDays: number;
  deadline: Date;
  rationale: string;
  status: string;
  outcomeNotes: string | null;
  brierScore: number | null;
  resolvedAt: Date | null;
  probabilityAtCreation: number | null;
  probabilityAtResolution: number | null;
  createdAt: Date;
};

const ACTION_BADGE: Record<string, string> = {
  BUY: "bg-pm-green/10 text-pm-green border-pm-green/30",
  SELL: "bg-pm-red/10 text-pm-red border-pm-red/30",
  WATCH: "bg-pm-blue/10 text-pm-blue border-pm-blue/30",
  HOLD: "bg-gray-100 text-gray-600 border-gray-300",
  AVOID: "bg-white text-pm-red border-pm-red",
};

function daysRemaining(deadline: Date) {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function RecommendationsLanding({
  allRecs,
  thesisMap,
  candidateCount,
  expiredCount,
}: {
  allRecs: Recommendation[];
  thesisMap: Record<number, { title: string; probability: number }>;
  candidateCount: number;
  expiredCount: number;
}) {
  const active = allRecs.filter((r) => r.status === "active");
  const resolved = allRecs.filter((r) => r.status !== "active");
  const correct = resolved.filter((r) => r.status === "resolved_correct");
  const incorrect = resolved.filter((r) => r.status === "resolved_incorrect");

  const brierScores = resolved
    .map((r) => r.brierScore)
    .filter((s): s is number => s !== null);
  const avgBrier =
    brierScores.length > 0
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          Recommendations
        </h1>
        <p className="mt-1 text-sm text-pm-muted">
          Actionable investment recommendations derived from your theses.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Active</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {active.length}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Resolved Correct
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-green">
            {correct.length}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Resolved Incorrect
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-red">
            {incorrect.length}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Avg Brier Score
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {avgBrier !== null ? avgBrier.toFixed(3) : "—"}
          </div>
        </div>
      </div>

      {/* Generate panel */}
      <GenerateRecsPanel
        candidateCount={candidateCount}
        expiredCount={expiredCount}
      />

      {/* Active Recommendations */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
          Active Recommendations ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            No active recommendations. Use the generate button above to create
            some.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((rec) => {
              const days = daysRemaining(rec.deadline);
              const convPct = Math.round(rec.conviction * 100);
              const thesis =
                rec.thesisId !== null ? thesisMap[rec.thesisId] : null;
              return (
                <div
                  key={rec.id}
                  className="rounded-[15px] border border-pm-border p-5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${ACTION_BADGE[rec.action] || ACTION_BADGE.HOLD}`}
                    >
                      {rec.action}
                    </span>
                    <span className="text-sm font-semibold text-pm-text-primary">
                      {rec.asset}
                    </span>
                  </div>

                  {/* Thesis title inline */}
                  {thesis && (
                    <Link
                      href={`/thesis/${rec.thesisId}`}
                      className="mb-2 block truncate text-xs text-pm-blue hover:underline"
                    >
                      {thesis.title}
                    </Link>
                  )}

                  {/* Conviction gauge */}
                  <div className="mb-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-pm-text-meta">
                      <span>Conviction</span>
                      <span className="font-bold text-pm-text-primary">
                        {convPct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-pm-bg-search">
                      <div
                        className="h-full rounded-full bg-pm-blue"
                        style={{ width: `${convPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Days remaining */}
                  <div className="mb-3 text-xs text-pm-text-meta">
                    {days > 0 ? (
                      <span>{days} days remaining</span>
                    ) : (
                      <span className="font-medium text-pm-red">Expired</span>
                    )}
                  </div>

                  {/* Rationale */}
                  <p className="line-clamp-3 text-sm text-pm-text-secondary">
                    {rec.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Resolved Recommendations */}
      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Resolved Recommendations ({resolved.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Asset
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Brier Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Outcome
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Resolved
                  </th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((rec) => (
                  <tr
                    key={rec.id}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          rec.status === "resolved_correct"
                            ? "bg-green-50 text-pm-green"
                            : rec.status === "resolved_incorrect"
                              ? "bg-red-50 text-pm-red"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {rec.status === "resolved_correct"
                          ? "Correct"
                          : rec.status === "resolved_incorrect"
                            ? "Incorrect"
                            : rec.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-pm-text-primary">
                      {rec.asset}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-bold ${ACTION_BADGE[rec.action] || ACTION_BADGE.HOLD}`}
                      >
                        {rec.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-text-primary">
                      {rec.brierScore !== null
                        ? rec.brierScore.toFixed(3)
                        : "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-pm-text-secondary">
                      {rec.outcomeNotes || "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-pm-text-meta">
                      {rec.resolvedAt
                        ? new Date(rec.resolvedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
