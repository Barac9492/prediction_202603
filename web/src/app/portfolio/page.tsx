import { listRecommendations, getThesis } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";

interface RecWithDomain {
  id: number;
  action: string;
  asset: string;
  ticker: string | null;
  conviction: number;
  timeframeDays: number;
  deadline: Date;
  rationale: string;
  thesisId: number | null;
  domain: string;
  thesisTitle: string;
  priceAtCreation: number | null;
}

export default async function PortfolioPage() {
  const activeRecs = await listRecommendations({ status: "active" });

  // Enrich with thesis domain
  const enriched: RecWithDomain[] = [];
  const thesisCache = new Map<number, { domain: string; title: string }>();

  for (const rec of activeRecs) {
    let domain = "Unknown";
    let thesisTitle = "";
    if (rec.thesisId) {
      if (!thesisCache.has(rec.thesisId)) {
        const thesis = await getThesis(rec.thesisId);
        if (thesis) {
          thesisCache.set(rec.thesisId, {
            domain: thesis.domain,
            title: thesis.title,
          });
        }
      }
      const cached = thesisCache.get(rec.thesisId);
      if (cached) {
        domain = cached.domain;
        thesisTitle = cached.title;
      }
    }
    enriched.push({ ...rec, domain, thesisTitle } as RecWithDomain);
  }

  // Group by domain
  const byDomain = new Map<string, RecWithDomain[]>();
  for (const rec of enriched) {
    const list = byDomain.get(rec.domain) || [];
    list.push(rec);
    byDomain.set(rec.domain, list);
  }

  // Concentration warnings
  const domainWarnings = [...byDomain.entries()].map(([domain, recs]) => ({
    domain,
    count: recs.length,
    level:
      recs.length > 5 ? "red" : recs.length > 3 ? "yellow" : ("green" as string),
  }));

  // Net exposure
  const buyCount = enriched.filter((r) =>
    ["BUY", "WATCH"].includes(r.action)
  ).length;
  const sellCount = enriched.filter((r) =>
    ["SELL", "AVOID"].includes(r.action)
  ).length;
  const holdCount = enriched.filter((r) => r.action === "HOLD").length;

  // Overlapping signals: recs sharing same thesis
  const thesisGroups = new Map<number, RecWithDomain[]>();
  for (const rec of enriched) {
    if (rec.thesisId) {
      const list = thesisGroups.get(rec.thesisId) || [];
      list.push(rec);
      thesisGroups.set(rec.thesisId, list);
    }
  }
  const overlapping = [...thesisGroups.entries()]
    .filter(([, recs]) => recs.length > 1)
    .map(([thesisId, recs]) => ({
      thesisId,
      thesisTitle: recs[0].thesisTitle,
      assets: recs.map((r) => r.asset),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          Portfolio View
        </h1>
        <p className="mt-1 text-sm text-pm-muted">
          Active positions grouped by sector with risk indicators.
        </p>
      </div>

      {/* Net exposure */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Long (BUY/WATCH)
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-green">
            {buyCount}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Short (SELL/AVOID)
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-red">
            {sellCount}
          </div>
        </div>
        <div className="rounded-xl border border-pm-border px-4 py-3">
          <div className="text-xs font-medium text-pm-text-meta">
            Neutral (HOLD)
          </div>
          <div className="mt-1 text-2xl font-bold text-pm-text-primary">
            {holdCount}
          </div>
        </div>
      </div>

      {/* Concentration warnings */}
      {domainWarnings.some((w) => w.level !== "green") && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Concentration Warnings
          </h2>
          <div className="space-y-2">
            {domainWarnings
              .filter((w) => w.level !== "green")
              .map((w) => (
                <div
                  key={w.domain}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    w.level === "red"
                      ? "border-red-300 bg-red-50 text-pm-red"
                      : "border-yellow-300 bg-yellow-50 text-yellow-700"
                  }`}
                >
                  <span className="font-medium">{w.domain}</span>: {w.count}{" "}
                  active recommendations
                  {w.level === "red"
                    ? " — high concentration risk"
                    : " — monitor closely"}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Overlapping signals */}
      {overlapping.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
            Overlapping Signals
          </h2>
          <div className="space-y-2">
            {overlapping.map((o) => (
              <div
                key={o.thesisId}
                className="rounded-lg border border-pm-border bg-white px-4 py-2 text-sm"
              >
                <span className="font-medium text-pm-text-primary">
                  {o.thesisTitle}
                </span>
                <span className="ml-2 text-pm-muted">
                  drives: {o.assets.join(", ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Positions by sector */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-pm-text-primary">
          Positions by Sector
        </h2>
        {byDomain.size === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-6 text-center text-pm-muted">
            No active positions.
          </div>
        ) : (
          <div className="space-y-4">
            {[...byDomain.entries()].map(([domain, recs]) => (
              <div
                key={domain}
                className="rounded-lg border border-pm-border bg-white"
              >
                <div className="border-b border-pm-border bg-gray-50 px-4 py-2">
                  <span className="text-sm font-semibold text-pm-text-primary">
                    {domain}
                  </span>
                  <span className="ml-2 text-xs text-pm-muted">
                    ({recs.length})
                  </span>
                </div>
                <div className="divide-y divide-pm-border">
                  {recs.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                            rec.action === "BUY"
                              ? "border-green-300 bg-green-50 text-pm-green"
                              : rec.action === "SELL" || rec.action === "AVOID"
                                ? "border-red-300 bg-red-50 text-pm-red"
                                : "border-gray-300 bg-gray-100 text-gray-600"
                          }`}
                        >
                          {rec.action}
                        </span>
                        <span className="text-sm font-medium text-pm-text-primary">
                          {rec.asset}
                        </span>
                        {rec.ticker && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-pm-muted">
                            {rec.ticker}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-pm-text-secondary">
                          {Math.round(rec.conviction * 100)}% conviction
                        </div>
                        {rec.priceAtCreation && (
                          <div className="text-pm-muted">
                            Entry: ${rec.priceAtCreation.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
