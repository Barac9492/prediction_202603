import { getCurrentProbabilities } from "@/lib/db/probability";
import { HomeGrid } from "@/components/home-grid";

export const dynamic = "force-dynamic";

export default async function Home() {
  const theses = await getCurrentProbabilities();

  // Sort by absolute momentum for trending
  const trending = [...theses]
    .filter((t) => t.momentum !== null)
    .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))
    .slice(0, 5);

  // Extract unique domains for category pills
  const domains = Array.from(new Set(theses.map((t) => t.domain))).sort();

  return <HomeGrid theses={theses} trending={trending} domains={domains} />;
}
