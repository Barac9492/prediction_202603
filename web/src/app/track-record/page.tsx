import {
  getTrackRecordSummary,
  getResolvedTheses,
  getProbabilityCalibration,
  getOverallBrierScore,
  getSignalQuality,
} from "@/lib/db/scoring";
import { CalibrationCurve } from "./calibration-curve";

export const dynamic = "force-dynamic";

function brierColor(score: number | null) {
  if (score == null) return "text-pm-muted";
  if (score < 0.15) return "text-green-600";
  if (score < 0.25) return "text-yellow-600";
  return "text-red-600";
}

export default async function TrackRecordPage() {
  const [summary, resolved, calibration, brier, signals] = await Promise.all([
    getTrackRecordSummary(),
    getResolvedTheses(),
    getProbabilityCalibration(),
    getOverallBrierScore(),
    getSignalQuality(),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Track Record</h1>
        <p className="text-pm-muted text-sm mt-1">
          Unified accuracy view across all prediction systems
        </p>
      </div>

      {/* Section 1: Headline Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <p className="text-xs text-pm-text-secondary uppercase tracking-wider">Brier Score</p>
          <p className={`text-2xl font-bold mt-1 ${brierColor(summary.system2.brierScore)}`}>
            {summary.system2.brierScore != null
              ? summary.system2.brierScore.toFixed(3)
              : "—"}
          </p>
          <p className="text-xs text-pm-text-meta mt-1">Lower is better (0 = perfect)</p>
        </div>
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <p className="text-xs text-pm-text-secondary uppercase tracking-wider">Resolved Theses</p>
          <p className="text-2xl font-bold mt-1 text-pm-text-primary">
            {summary.system2.resolvedCount}
          </p>
          <p className="text-xs text-pm-text-meta mt-1">System 2 (probability)</p>
        </div>
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <p className="text-xs text-pm-text-secondary uppercase tracking-wider">Legacy Accuracy</p>
          <p className="text-2xl font-bold mt-1 text-blue-600">
            {summary.system1.total > 0
              ? `${summary.system1.accuracy}%`
              : "—"}
          </p>
          <p className="text-xs text-pm-text-meta mt-1">
            System 1 ({summary.system1.correct}/{summary.system1.total})
          </p>
        </div>
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <p className="text-xs text-pm-text-secondary uppercase tracking-wider">Avg Probability</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-green-600">
              {summary.avgProbCorrect != null
                ? `${(summary.avgProbCorrect * 100).toFixed(0)}%`
                : "—"}
            </span>
            <span className="text-xs text-pm-text-secondary">correct</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-red-600">
              {summary.avgProbIncorrect != null
                ? `${(summary.avgProbIncorrect * 100).toFixed(0)}%`
                : "—"}
            </span>
            <span className="text-xs text-pm-text-secondary">incorrect</span>
          </div>
        </div>
      </div>

      {/* Section 2: Calibration Chart */}
      <div className="rounded-lg border border-pm-border bg-white p-4">
        <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-4">
          Calibration Curve
        </h2>
        {calibration.some((b) => b.count > 0) ? (
          <CalibrationCurve data={calibration} />
        ) : (
          <p className="text-pm-text-secondary text-sm py-8 text-center">
            No resolved theses with probability data yet
          </p>
        )}
      </div>

      {/* Section 3: Resolved Theses Table */}
      <div className="rounded-lg border border-pm-border bg-white p-4">
        <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-4">
          Resolved Theses
        </h2>
        {resolved.length === 0 ? (
          <p className="text-pm-text-secondary text-sm py-8 text-center">
            No resolved theses yet. Resolve theses from the Thesis page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-pm-text-secondary border-b border-pm-border">
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Domain</th>
                  <th className="pb-2 pr-4">Dir</th>
                  <th className="pb-2 pr-4">Final Prob</th>
                  <th className="pb-2 pr-4">Outcome</th>
                  <th className="pb-2 pr-4">Brier</th>
                  <th className="pb-2 pr-4">Resolved</th>
                  <th className="pb-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((t) => {
                  const isCorrect = t.status === "resolved_correct";
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-pm-border ${
                        isCorrect ? "bg-green-50/50" : "bg-red-50/50"
                      }`}
                    >
                      <td className="py-2 pr-4 max-w-[200px] truncate">{t.title}</td>
                      <td className="py-2 pr-4 text-pm-muted">{t.domain}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            t.direction === "bullish"
                              ? "text-green-600"
                              : t.direction === "bearish"
                                ? "text-red-600"
                                : "text-yellow-600"
                          }
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {t.finalProbability != null
                          ? `${(t.finalProbability * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            isCorrect
                              ? "bg-green-50 text-green-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </td>
                      <td className={`py-2 pr-4 ${brierColor(t.brierScore)}`}>
                        {t.brierScore != null ? t.brierScore.toFixed(3) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-pm-text-secondary">
                        {t.resolvedAt
                          ? new Date(t.resolvedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2">
                        {t.resolutionSource ? (
                          t.resolutionSource.startsWith("http") ? (
                            <a
                              href={t.resolutionSource}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate block max-w-[150px]"
                            >
                              Link
                            </a>
                          ) : (
                            <span className="text-pm-muted truncate block max-w-[150px]">
                              {t.resolutionSource}
                            </span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Brier by Domain */}
      {Object.keys(brier.byDomain).length > 0 && (
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-4">
            Brier Score by Domain
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-pm-text-secondary border-b border-pm-border">
                <th className="pb-2 pr-4">Domain</th>
                <th className="pb-2 pr-4">Avg Brier</th>
                <th className="pb-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(brier.byDomain)
                .sort(([, a], [, b]) => a.avgBrier - b.avgBrier)
                .map(([domain, data]) => (
                  <tr key={domain} className="border-b border-pm-border">
                    <td className="py-2 pr-4">{domain}</td>
                    <td className={`py-2 pr-4 ${brierColor(data.avgBrier)}`}>
                      {data.avgBrier.toFixed(3)}
                    </td>
                    <td className="py-2 text-pm-muted">{data.count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 5: Signal Quality */}
      {signals.length > 0 && (
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider mb-4">
            Signal Quality by Source
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-pm-text-secondary border-b border-pm-border">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Connections</th>
                <th className="pb-2 pr-4">Avg Weight (Correct)</th>
                <th className="pb-2">Avg Weight (Incorrect)</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.source} className="border-b border-pm-border">
                  <td className="py-2 pr-4">{s.source}</td>
                  <td className="py-2 pr-4 text-pm-muted">{s.connectionCount}</td>
                  <td className="py-2 pr-4 text-green-600">
                    {s.avgWeightCorrect != null ? s.avgWeightCorrect.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-red-600">
                    {s.avgWeightIncorrect != null ? s.avgWeightIncorrect.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
