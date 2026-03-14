import { getCurrentProbabilities } from "@/lib/db/probability";
import { listRecommendations } from "@/lib/db/graph-queries";
import { RecommendationsLanding } from "@/components/recommendations-landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [allRecs, probabilities] = await Promise.all([
    listRecommendations({ limit: 200 }),
    getCurrentProbabilities(),
  ]);

  // Candidate count: same filter as generator.ts
  const candidateCount = probabilities.filter(
    (t) =>
      t.probability > 0.65 ||
      t.probability < 0.35 ||
      Math.abs(t.momentum ?? 0) > 0.05
  ).length;

  // Build thesis lookup for enriching rec cards
  const thesisMap: Record<number, { title: string; probability: number }> = {};
  for (const t of probabilities) {
    thesisMap[t.thesisId] = { title: t.title, probability: t.probability };
  }

  // Check for expired recs
  const now = Date.now();
  const expiredCount = allRecs.filter(
    (r) => r.status === "active" && new Date(r.deadline).getTime() < now
  ).length;

  return (
    <RecommendationsLanding
      allRecs={allRecs}
      thesisMap={thesisMap}
      candidateCount={candidateCount}
      expiredCount={expiredCount}
    />
  );
}
