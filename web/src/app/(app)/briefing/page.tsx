import { getCurrentProbabilities } from "@/lib/db/probability";
import {
  getExpiringSoonRecommendations,
  getContradictingEvidence,
} from "@/lib/db/graph-queries";
import { BriefingView } from "@/components/briefing-view";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const workspaceId = await getWorkspaceId();

  const [theses, expiring] = await Promise.all([
    getCurrentProbabilities(workspaceId),
    getExpiringSoonRecommendations(workspaceId, 7),
  ]);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">
          Morning Briefing
        </h1>
        <p className="mt-1 text-sm text-pm-muted">
          Your daily actionable summary.
        </p>
      </div>
      <BriefingView
        expiring={expiring}
        biggestMoves={biggestMoves}
        contradictingTheses={contradictingTheses}
      />
    </div>
  );
}
