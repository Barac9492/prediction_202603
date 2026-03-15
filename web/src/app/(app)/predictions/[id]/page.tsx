export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getPredictionDetail } from "@/lib/db/queries";
import { SignalCard } from "@/components/signal-card";
import { ResolveDialog } from "@/components/resolve-dialog";
import { getWorkspaceId } from "@/lib/db/workspace";

const directionColor: Record<string, string> = {
  bullish: "text-green-600",
  bearish: "text-red-600",
  neutral: "text-yellow-600",
};

const directionBg: Record<string, string> = {
  bullish: "bg-green-50 border-green-200",
  bearish: "bg-red-50 border-red-200",
  neutral: "bg-yellow-50 border-yellow-200",
};

export default async function PredictionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId();

  const detail = await getPredictionDetail(workspaceId, Number(id));
  if (!detail) return notFound();

  const { prediction: p, signals, sources } = detail;
  const topReasons = (p.topReasons as string[]) || [];
  const contradictions = (p.contradictions as string[]) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{p.topic}</h1>
          <p className="text-sm text-pm-text-secondary">
            #{p.id} — {p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"}
          </p>
        </div>
        <ResolveDialog
          predictionId={p.id}
          currentOutcome={p.actualOutcome}
        />
      </div>

      <div className={`rounded-lg border p-5 ${directionBg[p.direction] || ""}`}>
        <div className="mb-3 flex items-baseline gap-3">
          <span
            className={`text-2xl font-bold uppercase ${directionColor[p.direction] || ""}`}
          >
            {p.direction}
          </span>
          <span className="text-lg text-pm-text-primary">
            {p.confidence}% confidence
          </span>
        </div>

        <div className="mb-3 text-sm text-pm-muted">
          Score: {p.weightedScore.toFixed(1)} | Signals: {p.signalCount} (
          {p.bullishCount}↑ {p.bearishCount}↓ {p.neutralCount}→)
        </div>

        {topReasons.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-pm-text-secondary">
              Top reasons
            </p>
            {topReasons.map((r, i) => (
              <p key={i} className="text-sm text-pm-text-primary">
                • {r}
              </p>
            ))}
          </div>
        )}

        {contradictions.length > 0 && (
          <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-yellow-600">
              Contradictions
            </p>
            {contradictions.map((c, i) => (
              <p key={i} className="text-sm text-yellow-700">
                {c}
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
          Signals ({signals.length})
        </h2>
        <div className="space-y-2">
          {signals.map((s) => (
            <SignalCard
              key={s.id}
              signal={{
                description: s.description,
                direction: s.direction as "bullish" | "bearish" | "neutral",
                strength: s.strength,
                reasoning: s.reasoning,
                sourceTitle: s.sourceTitle || "",
              }}
            />
          ))}
        </div>
      </div>

      {sources.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
            Sources ({sources.length})
          </h2>
          <div className="space-y-2">
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-md border border-pm-border bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-pm-text-primary">
                    {src.title}
                  </span>
                  <span className="text-xs text-pm-text-meta">
                    relevance {src.relevanceScore}/5
                  </span>
                </div>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {src.url}
                  </a>
                )}
                {src.summary && (
                  <p className="mt-1 text-xs text-pm-text-secondary">{src.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
