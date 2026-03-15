import { getCurrentProbabilities, getLastPipelineRun } from "@/lib/db/probability";
import {
  getExpiringSoonRecommendations,
  getContradictingEvidence,
} from "@/lib/db/graph-queries";
import { BriefingView } from "@/components/briefing-view";
import { BriefingNarrative } from "@/components/briefing-narrative";
import { getWorkspaceId } from "@/lib/db/workspace";
import { DataFreshness } from "@/components/data-freshness";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const workspaceId = await getWorkspaceId();

  const [theses, expiring, lastRun] = await Promise.all([
    getCurrentProbabilities(workspaceId),
    getExpiringSoonRecommendations(workspaceId, 7),
    getLastPipelineRun(workspaceId),
  ]);
  const lastRunIso = lastRun?.toISOString() ?? null;

  // Biggest moves: top 10 by absolute momentum
  const biggestMoves = [...theses]
    .filter((t) => t.momentum !== null)
    .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))
    .slice(0, 10);

  // High-conviction theses for contradicting evidence
  const highConviction = theses
    .filter((t) => t.probability > 0.75 || t.probability < 0.25)
    .map((t) => ({ thesisId: t.thesisId, direction: t.direction }));

  const contradictions = await getContradictingEvidence(workspaceId, highConviction);

  // Group contradictions by thesis for display
  const contradictionsByThesis = new Map<
    number,
    Array<{
      newsId: number;
      newsTitle: string;
      newsSentiment: string | null;
      newsPublishedAt: Date | null;
      newsSource: string | null;
    }>
  >();
  for (const c of contradictions) {
    const list = contradictionsByThesis.get(c.thesisId) ?? [];
    list.push(c);
    contradictionsByThesis.set(c.thesisId, list);
  }

  const contradictingTheses = theses
    .filter((t) => contradictionsByThesis.has(t.thesisId))
    .map((t) => ({
      ...t,
      contradictions: contradictionsByThesis.get(t.thesisId)!,
    }));

  return (
    <AutoRefresh>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pm-text-primary">
            Morning Briefing
          </h1>
          <p className="mt-1 text-sm text-pm-muted">
            Your daily actionable summary.
          </p>
        </div>
        <DataFreshness lastUpdated={lastRunIso} />
      </div>
      <BriefingNarrative />
      <BriefingView
        expiring={expiring}
        biggestMoves={biggestMoves}
        contradictingTheses={contradictingTheses}
      />
    </div>
    </AutoRefresh>
  );
}
