"use client";

import { useState } from "react";
import Link from "next/link";

type TradeRec = {
  id: number;
  action: string;
  asset: string;
  ticker: string | null;
  conviction: number;
  rationale: string;
  status: string;
  outcomeNotes: string | null;
  brierScore: number | null;
  priceAtCreation: number | null;
  priceAtResolution: number | null;
  actualReturn: number | null;
  createdAt: string;
  resolvedAt: string | null;
  thesisId: number | null;
  thesisTitle: string | null;
  thesisDirection: string | null;
};

const ACTION_BADGE: Record<string, string> = {
  BUY: "bg-green-50 text-green-700 border-green-300",
  SELL: "bg-red-50 text-red-700 border-red-300",
  HOLD: "bg-gray-50 text-gray-700 border-gray-300",
  WATCH: "bg-blue-50 text-blue-700 border-blue-300",
  AVOID: "bg-red-50 text-red-700 border-red-500",
};

export function TradeLog({ trades }: { trades: TradeRec[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sorted = [...trades].sort(
    (a, b) =>
      new Date(b.resolvedAt ?? b.createdAt).getTime() -
      new Date(a.resolvedAt ?? a.createdAt).getTime(),
  );

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
        Trade Log ({sorted.length} transactions)
      </h2>
      <div className="overflow-x-auto rounded-lg border border-pm-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pm-border bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Outcome
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Action
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Asset
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Conviction
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Entry
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Exit
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Return
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Opened
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Closed
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Days
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-pm-muted">
                Brier
              </th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          {sorted.map((rec) => {
              const holdDays = rec.resolvedAt
                ? Math.ceil(
                    (new Date(rec.resolvedAt).getTime() -
                      new Date(rec.createdAt).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                : null;
              const isExpanded = expandedId === rec.id;

              return (
                <tbody key={rec.id}>
                  <tr
                    className={`border-b border-pm-border cursor-pointer transition-colors ${
                      isExpanded ? "bg-blue-50/30" : "hover:bg-gray-50"
                    }`}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : rec.id)
                    }
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          rec.status === "resolved_correct"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {rec.status === "resolved_correct" ? "Win" : "Loss"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold ${
                          ACTION_BADGE[rec.action] || ACTION_BADGE.HOLD
                        }`}
                      >
                        {rec.action}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-pm-text-primary">
                        {rec.ticker || rec.asset}
                      </div>
                      {rec.ticker && rec.ticker !== rec.asset && (
                        <div className="max-w-[140px] truncate text-xs text-pm-muted">
                          {rec.asset}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-pm-text-primary">
                      {(rec.conviction * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums text-pm-text-secondary">
                      {rec.priceAtCreation !== null
                        ? `$${rec.priceAtCreation.toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-pm-text-secondary">
                      {rec.priceAtResolution !== null
                        ? `$${rec.priceAtResolution.toFixed(2)}`
                        : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums font-medium ${
                        rec.actualReturn !== null && rec.actualReturn > 0
                          ? "text-pm-green"
                          : rec.actualReturn !== null && rec.actualReturn < 0
                            ? "text-pm-red"
                            : "text-pm-text-secondary"
                      }`}
                    >
                      {rec.actualReturn !== null
                        ? `${rec.actualReturn > 0 ? "+" : ""}${(rec.actualReturn * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-pm-muted">
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-pm-muted">
                      {rec.resolvedAt
                        ? new Date(rec.resolvedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-pm-muted">
                      {holdDays !== null ? `${holdDays}d` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-pm-text-secondary">
                      {rec.brierScore !== null
                        ? rec.brierScore.toFixed(3)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-pm-muted">
                      <span className="text-xs">{isExpanded ? "▲" : "▼"}</span>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr className="border-b border-pm-border bg-gray-50/50">
                      <td colSpan={12} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Entry rationale */}
                          <div className="rounded-lg border border-pm-border bg-white p-4">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-pm-text-meta">
                                Entry Rationale
                              </span>
                              <span className="text-xs text-pm-muted">
                                {new Date(rec.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-pm-text-primary">
                              {rec.rationale}
                            </p>
                          </div>

                          {/* Exit / outcome */}
                          <div className="rounded-lg border border-pm-border bg-white p-4">
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${
                                  rec.status === "resolved_correct"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                              />
                              <span className="text-xs font-semibold uppercase tracking-wider text-pm-text-meta">
                                Exit Outcome
                              </span>
                              {rec.resolvedAt && (
                                <span className="text-xs text-pm-muted">
                                  {new Date(
                                    rec.resolvedAt,
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {rec.outcomeNotes ? (
                              <p className="text-sm text-pm-text-primary">
                                {rec.outcomeNotes}
                              </p>
                            ) : (
                              <p className="text-sm text-pm-text-secondary">
                                {rec.status === "resolved_correct"
                                  ? rec.action === "BUY"
                                    ? `Price moved from $${rec.priceAtCreation?.toFixed(2)} → $${rec.priceAtResolution?.toFixed(2)} within ${holdDays}d timeframe, confirming the ${(rec.conviction * 100).toFixed(0)}% conviction ${rec.action} call.`
                                    : rec.action === "AVOID"
                                      ? `Price declined from $${rec.priceAtCreation?.toFixed(2)} → $${rec.priceAtResolution?.toFixed(2)}, validating the AVOID recommendation. Avoiding this position preserved capital.`
                                      : rec.action === "HOLD"
                                        ? `Position held steady. Price moved from $${rec.priceAtCreation?.toFixed(2)} → $${rec.priceAtResolution?.toFixed(2)} (+${((rec.actualReturn ?? 0) * 100).toFixed(1)}%), confirming HOLD was the right call.`
                                        : `Recommendation resolved correctly. The ${rec.action} signal at ${(rec.conviction * 100).toFixed(0)}% conviction played out as expected.`
                                  : rec.action === "BUY"
                                    ? `Price declined from $${rec.priceAtCreation?.toFixed(2)} → $${rec.priceAtResolution?.toFixed(2)} (${((rec.actualReturn ?? 0) * 100).toFixed(1)}%), contradicting the BUY thesis. Position closed at deadline.`
                                    : rec.action === "WATCH"
                                      ? `Price moved significantly while on WATCH list. The opportunity was missed — should have entered earlier or the watch criteria were too conservative.`
                                      : `Recommendation resolved incorrectly. The ${rec.action} signal at ${(rec.conviction * 100).toFixed(0)}% conviction did not play out as expected.`}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Linked thesis + detail link */}
                        <div className="mt-3 flex items-center justify-between">
                          {rec.thesisTitle && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-pm-muted">Thesis:</span>
                              <Link
                                href={`/thesis/${rec.thesisId}`}
                                className="text-pm-blue hover:underline"
                              >
                                {rec.thesisTitle}
                              </Link>
                              {rec.thesisDirection && (
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                    rec.thesisDirection === "bullish"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {rec.thesisDirection.toUpperCase()}
                                </span>
                              )}
                            </div>
                          )}
                          <Link
                            href={`/recommendations/${rec.id}`}
                            className="text-xs font-medium text-pm-blue hover:underline"
                          >
                            Full details &rarr;
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
        </table>
      </div>
    </section>
  );
}
