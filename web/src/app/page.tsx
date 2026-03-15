import { getCurrentProbabilities } from "@/lib/db/probability";
import { listRecommendations } from "@/lib/db/graph-queries";
import { RecommendationsLanding } from "@/components/recommendations-landing";
import { NewsTicker } from "@/components/news-ticker";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";

export default async function PicksHomePage() {
  const workspaceId = await getWorkspaceId();

  const [allRecs, probabilities] = await Promise.all([
    listRecommendations(workspaceId, { limit: 200 }),
    getCurrentProbabilities(workspaceId),
  ]);

  const candidateCount = probabilities.filter(
    (t) =>
      t.probability > 0.65 ||
      t.probability < 0.35 ||
      Math.abs(t.momentum ?? 0) > 0.05
  ).length;

  const thesisMap: Record<number, { title: string; probability: number }> = {};
  for (const t of probabilities) {
    thesisMap[t.thesisId] = { title: t.title, probability: t.probability };
  }

  const now = Date.now();
  const expiredCount = allRecs.filter(
    (r) => r.status === "active" && new Date(r.deadline).getTime() < now
  ).length;

  return (
    <div className="space-y-6">
      <NewsTicker />
      <RecommendationsLanding
        allRecs={allRecs}
        thesisMap={thesisMap}
        candidateCount={candidateCount}
        expiredCount={expiredCount}
      />
    </div>
  );
}
