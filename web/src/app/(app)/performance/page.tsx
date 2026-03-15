import {
  getHitRateByConvictionQuintile,
  getReturnsByAction,
  getCumulativeReturns,
  getWorstMisses,
  getRollingAccuracy,
  getSharpeRatio,
  getMaxDrawdown,
  getProfitFactor,
  getMagnitudeAnalysis,
} from "@/lib/db/performance";
import {
  getProbabilityCalibration,
  getOverallBrierScore,
  getSignalQuality,
} from "@/lib/db/scoring";
import { listRecommendations } from "@/lib/db/graph-queries";
import { CumulativeChart } from "@/components/cumulative-chart";
import { HitRateChart } from "./hit-rate-chart";
import { CalibrationCurve } from "@/app/(app)/track-record/calibration-curve";
import { TradeLog } from "./trade-log";
import { listTheses } from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const workspaceId = await getWorkspaceId();

  const [quintiles, actionReturns, cumReturns, worstMisses, rolling, allRecs, sharpe, drawdown, profitFactor, magnitude, calibration, brier, signals, allTheses] =
    await Promise.all([
      getHitRateByConvictionQuintile(workspaceId),
      getReturnsByAction(workspaceId),
      getCumulativeReturns(workspaceId),
      getWorstMisses(workspaceId),
      getRollingAccuracy(workspaceId),
      listRecommendations(workspaceId, { limit: 500 }),
      getSharpeRatio(workspaceId),
      getMaxDrawdown(workspaceId),
      getProfitFactor(workspaceId),
      getMagnitudeAnalysis(workspaceId),
      getProbabilityCalibration(workspaceId),
      getOverallBrierScore(workspaceId),
      getSignalQuality(workspaceId),
      listTheses(workspaceId),
    ]);

  // Build thesis lookup for trade log
  const thesisLookup = new Map(allTheses.map((t) => [t.id, t]));

  const resolved = allRecs.filter((r) => r.status !== "active");
  const correct = resolved.filter(
    (r) => r.status === "resolved_correct"
  ).length;
  const hitRate = resolved.length > 0 ? correct / resolved.length : null;
  const returns = resolved
    .map((r) => r.actualReturn)
    .filter((r): r is number => r !== null);
  const avgReturn =
    returns.length > 0
      ? returns.reduce((a, b) => a + b, 0) / returns.length
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          Performance Analytics
        </h1>
        <p className="mt-1 text-sm text-pm-muted">
          Track record based on real price data.
        </p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Hit Rate</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {hitRate !== null ? `${(hitRate * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Avg Return
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${avgReturn !== null && avgReturn > 0 ? "text-pm-green" : avgReturn !== null && avgReturn < 0 ? "text-pm-red" : "text-pm-text-primary"}`}
          >
            {avgReturn !== null
              ? `${avgReturn > 0 ? "+" : ""}${(avgReturn * 100).toFixed(2)}%`
              : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Total Resolved
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {resolved.length}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            With Price Data
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {returns.length}
          </div>
        </div>
      </div>

      {/* Rolling accuracy */}
      <div className="grid grid-cols-3 gap-3">
        {rolling.map((r) => (
          <div
            key={r.window}
            className="rounded-xl border border-pm-border px-4 py-3"
          >
            <div className="text-xs font-medium text-pm-text-meta">
              {r.window}d Accuracy
            </div>
            <div className="mt-1 text-xl font-bold text-pm-text-primary">
              {r.hitRate !== null
                ? `${(r.hitRate * 100).toFixed(1)}%`
                : "—"}
            </div>
            <div className="text-xs text-pm-muted">n = {r.count}</div>
          </div>
        ))}
      </div>

      {/* Risk metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta" title="Risk-adjusted return: higher means better returns per unit of risk">Sharpe Ratio</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {sharpe !== null ? sharpe.toFixed(2) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">Max Drawdown</div>
          <div className="mt-1 text-2xl font-bold text-pm-red">
            {drawdown ? `-${(drawdown.pct * 100).toFixed(1)}%` : "—"}
          </div>
          {drawdown?.start && drawdown?.end && (
            <div className="text-xs text-pm-muted">
              {drawdown.start} → {drawdown.end}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta" title="Total gains divided by total losses: above 1.0 means profitable overall">Profit Factor</div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {profitFactor !== null
              ? profitFactor === Infinity
                ? "∞"
                : profitFactor.toFixed(2)
              : "—"}
          </div>
        </div>
      </div>

      {/* Magnitude analysis */}
      {magnitude.some((m) => m.count > 0) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Performance by Return Magnitude
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Return Bucket
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Count
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Conviction
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Hit Rate
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Return
                  </th>
                </tr>
              </thead>
              <tbody>
                {magnitude.map((m) => (
                  <tr
                    key={m.label}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-pm-text-primary">
                      {m.label}
                    </td>
                    <td className="px-4 py-2 text-pm-text-secondary">{m.count}</td>
                    <td className="px-4 py-2 tabular-nums text-pm-text-secondary">
                      {m.count > 0 ? `${(m.avgConviction * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-text-secondary">
                      {m.count > 0 ? `${(m.hitRate * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td
                      className={`px-4 py-2 tabular-nums ${m.avgReturn > 0 ? "text-pm-green" : m.avgReturn < 0 ? "text-pm-red" : "text-pm-text-secondary"}`}
                    >
                      {m.count > 0
                        ? `${m.avgReturn > 0 ? "+" : ""}${(m.avgReturn * 100).toFixed(2)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Hit rate by conviction quintile */}
      {quintiles.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Hit Rate by Conviction Quintile
          </h2>
          <div className="rounded-lg border border-pm-border bg-white p-4">
            <HitRateChart data={quintiles} />
          </div>
        </section>
      )}

      {/* Returns by action type */}
      {actionReturns.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Returns by Action Type
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Count
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Win Rate
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Return
                  </th>
                </tr>
              </thead>
              <tbody>
                {actionReturns.map((r) =>
                  r ? (
                    <tr
                      key={r.action}
                      className="border-b border-pm-border last:border-0"
                    >
                      <td className="px-4 py-2 font-medium text-pm-text-primary">
                        {r.action}
                      </td>
                      <td className="px-4 py-2 text-pm-text-secondary">
                        {r.count}
                      </td>
                      <td className="px-4 py-2 text-pm-text-secondary">
                        {(r.winRate * 100).toFixed(1)}%
                      </td>
                      <td
                        className={`px-4 py-2 tabular-nums ${r.avgReturn !== null && r.avgReturn > 0 ? "text-pm-green" : r.avgReturn !== null && r.avgReturn < 0 ? "text-pm-red" : "text-pm-text-secondary"}`}
                      >
                        {r.avgReturn !== null
                          ? `${r.avgReturn > 0 ? "+" : ""}${(r.avgReturn * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Cumulative returns */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
          Cumulative Returns (Equal-Weight)
        </h2>
        <div className="rounded-lg border border-pm-border bg-white p-4">
          <CumulativeChart data={cumReturns} />
        </div>
      </section>

      {/* Trade Log */}
      {resolved.length > 0 && (
        <TradeLog
          trades={resolved.map((rec) => {
            const thesis = rec.thesisId ? thesisLookup.get(rec.thesisId) : null;
            return {
              id: rec.id,
              action: rec.action,
              asset: rec.asset,
              ticker: rec.ticker,
              conviction: rec.conviction,
              rationale: rec.rationale,
              status: rec.status,
              outcomeNotes: rec.outcomeNotes,
              brierScore: rec.brierScore,
              priceAtCreation: rec.priceAtCreation,
              priceAtResolution: rec.priceAtResolution,
              actualReturn: rec.actualReturn,
              createdAt: rec.createdAt.toISOString(),
              resolvedAt: rec.resolvedAt?.toISOString() ?? null,
              thesisId: rec.thesisId,
              thesisTitle: thesis?.title ?? null,
              thesisDirection: thesis?.direction ?? null,
            };
          })}
        />
      )}

      {/* Worst misses */}
      {worstMisses.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Worst Misses (Highest Conviction Incorrect)
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Asset
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Conviction
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Actual Return
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Brier
                  </th>
                </tr>
              </thead>
              <tbody>
                {worstMisses.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-pm-text-primary">
                      {r.ticker || r.asset}
                    </td>
                    <td className="px-4 py-2 text-pm-text-secondary">
                      {r.action}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-text-primary">
                      {(r.conviction * 100).toFixed(0)}%
                    </td>
                    <td
                      className={`px-4 py-2 tabular-nums ${r.actualReturn !== null && r.actualReturn > 0 ? "text-pm-green" : "text-pm-red"}`}
                    >
                      {r.actualReturn !== null
                        ? `${r.actualReturn > 0 ? "+" : ""}${(r.actualReturn * 100).toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-text-secondary">
                      {r.brierScore !== null ? r.brierScore.toFixed(3) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Calibration Curve */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
          Calibration Curve
        </h2>
        <div className="rounded-lg border border-pm-border bg-white p-4">
          {calibration.some((b) => b.count > 0) ? (
            <CalibrationCurve data={calibration} />
          ) : (
            <p className="text-pm-text-secondary text-sm py-8 text-center">
              No resolved theses with probability data yet
            </p>
          )}
        </div>
      </section>

      {/* Accuracy by Domain */}
      {Object.keys(brier.byDomain).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Accuracy by Domain
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Domain
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Brier Score
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(brier.byDomain)
                  .sort(([, a], [, b]) => a.avgBrier - b.avgBrier)
                  .map(([domain, data]) => (
                    <tr
                      key={domain}
                      className="border-b border-pm-border last:border-0"
                    >
                      <td className="px-4 py-2 font-medium text-pm-text-primary">
                        {domain}
                      </td>
                      <td
                        className={`px-4 py-2 tabular-nums ${
                          data.avgBrier < 0.15
                            ? "text-green-600"
                            : data.avgBrier < 0.25
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {data.avgBrier.toFixed(3)}
                      </td>
                      <td className="px-4 py-2 text-pm-muted">{data.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Signal Quality */}
      {signals.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Signal Quality by Source
          </h2>
          <div className="overflow-hidden rounded-lg border border-pm-border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Source
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Connections
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Weight (Correct)
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-pm-muted">
                    Avg Weight (Incorrect)
                  </th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr
                    key={s.source}
                    className="border-b border-pm-border last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-pm-text-primary">
                      {s.source}
                    </td>
                    <td className="px-4 py-2 text-pm-muted">
                      {s.connectionCount}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-green">
                      {s.avgWeightCorrect != null
                        ? s.avgWeightCorrect.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-pm-red">
                      {s.avgWeightIncorrect != null
                        ? s.avgWeightIncorrect.toFixed(2)
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
