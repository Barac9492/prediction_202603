"use client";

import Link from "next/link";

type ExpiringRec = {
  id: number;
  asset: string;
  action: string;
  conviction: number;
  deadline: Date;
  thesisId: number | null;
  rationale: string;
};

type MovingThesis = {
  thesisId: number;
  title: string;
  direction: string;
  probability: number;
  momentum: number | null;
};

type ContradictingThesis = MovingThesis & {
  contradictions: Array<{
    newsId: number;
    newsTitle: string;
    newsSentiment: string | null;
    newsPublishedAt: Date | null;
    newsSource: string | null;
  }>;
};

function daysUntil(deadline: Date): number {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    BUY: "bg-green-100 text-green-800",
    SELL: "bg-red-100 text-red-800",
    HOLD: "bg-yellow-100 text-yellow-800",
    WATCH: "bg-blue-100 text-blue-800",
    AVOID: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[action] || "bg-gray-100 text-gray-800"}`}
    >
      {action}
    </span>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-bold text-pm-text-primary">{title}</h2>
      {count > 0 && (
        <span className="rounded-full bg-pm-bg-search px-2 py-0.5 text-xs text-pm-muted">
          {count}
        </span>
      )}
    </div>
  );
}

export function BriefingView({
  expiring,
  biggestMoves,
  contradictingTheses,
}: {
  expiring: ExpiringRec[];
  biggestMoves: MovingThesis[];
  contradictingTheses: ContradictingThesis[];
}) {
  const isEmpty =
    expiring.length === 0 &&
    biggestMoves.length === 0 &&
    contradictingTheses.length === 0;

  if (isEmpty) {
    return (
      <div className="rounded-[15px] border border-pm-border p-8 text-center">
        <p className="text-lg font-semibold text-pm-text-primary">
          Nothing urgent today.
        </p>
        <p className="mt-2 text-sm text-pm-muted">
          Your portfolio is steady.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <Link
            href="/"
            className="rounded-full bg-pm-bg-search px-4 py-2 text-sm font-medium text-pm-text-secondary hover:text-pm-text-primary"
          >
            Dashboard
          </Link>
          <Link
            href="/thesis"
            className="rounded-full bg-pm-bg-search px-4 py-2 text-sm font-medium text-pm-text-secondary hover:text-pm-text-primary"
          >
            Research
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Expiring Soon */}
      {expiring.length > 0 && (
        <section className="rounded-[15px] border border-pm-border p-5">
          <SectionHeader title="Expiring Soon" count={expiring.length} />
          <div className="space-y-2">
            {expiring.map((rec) => {
              const days = daysUntil(rec.deadline);
              return (
                <Link
                  key={rec.id}
                  href={`/recommendations/${rec.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-pm-bg-search"
                >
                  <ActionBadge action={rec.action} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-pm-text-primary">
                    {rec.asset}
                  </span>
                  <span className="shrink-0 text-xs text-pm-muted">
                    {Math.round(rec.conviction * 100)}% conviction
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      days <= 2
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Section B: Biggest Moves */}
      {biggestMoves.length > 0 && (
        <section className="rounded-[15px] border border-pm-border p-5">
          <SectionHeader title="Biggest Moves" count={biggestMoves.length} />
          <div className="space-y-2">
            {biggestMoves.map((t) => {
              const mom = t.momentum ?? 0;
              const momPct = Math.round(Math.abs(mom) * 100);
              return (
                <Link
                  key={t.thesisId}
                  href={`/thesis/${t.thesisId}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-pm-bg-search"
                >
                  <span
                    className={`text-lg ${mom > 0 ? "text-pm-green" : "text-pm-red"}`}
                  >
                    {mom > 0 ? "▲" : "▼"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-pm-text-primary">
                    {t.title}
                  </span>
                  <span className="shrink-0 text-xs text-pm-muted">
                    {Math.round(t.probability * 100)}%
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold ${mom > 0 ? "text-pm-green" : "text-pm-red"}`}
                  >
                    {mom > 0 ? "+" : "-"}{momPct}pp
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Section C: Contradicting Evidence */}
      {contradictingTheses.length > 0 && (
        <section className="rounded-[15px] border border-pm-border p-5">
          <SectionHeader
            title="Contradicting Evidence"
            count={contradictingTheses.length}
          />
          <div className="space-y-4">
            {contradictingTheses.map((t) => (
              <div key={t.thesisId}>
                <Link
                  href={`/thesis/${t.thesisId}`}
                  className="text-sm font-semibold text-pm-text-primary hover:text-pm-blue"
                >
                  {t.title}
                  <span className="ml-2 text-xs font-normal text-pm-muted">
                    {Math.round(t.probability * 100)}% {t.direction}
                  </span>
                </Link>
                <div className="mt-1 space-y-1 pl-3 border-l-2 border-pm-border">
                  {t.contradictions.map((c) => (
                    <div
                      key={c.newsId}
                      className="flex items-center gap-2 text-xs text-pm-text-secondary"
                    >
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                          c.newsSentiment === "bullish"
                            ? "bg-pm-green"
                            : c.newsSentiment === "bearish"
                              ? "bg-pm-red"
                              : "bg-pm-muted"
                        }`}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {c.newsTitle}
                      </span>
                      {c.newsSource && (
                        <span className="shrink-0 text-pm-muted">
                          {c.newsSource}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
