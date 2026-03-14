import { getCurrentProbabilities } from "@/lib/db/probability";
import {
  listSignalClusters,
  listNewsEvents,
  getUncoveredEntities,
} from "@/lib/db/graph-queries";
import { HomeGrid } from "@/components/home-grid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [theses, activeClusters, recentNews, uncoveredEntities] =
    await Promise.all([
      getCurrentProbabilities(),
      listSignalClusters("active"),
      listNewsEvents({ limit: 5 }),
      getUncoveredEntities(),
    ]);

  // Sort by absolute momentum for trending
  const trending = [...theses]
    .filter((t) => t.momentum !== null)
    .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))
    .slice(0, 5);

  // Extract unique domains for category pills
  const domains = Array.from(new Set(theses.map((t) => t.domain))).sort();

  // Sort theses by momentum (biggest movers first)
  const sorted = [...theses].sort(
    (a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0)
  );

  return (
    <HomeGrid
      theses={sorted}
      trending={trending}
      domains={domains}
      recentNews={recentNews}
      activeClusters={activeClusters}
      uncoveredEntities={uncoveredEntities}
    />
  );
}
