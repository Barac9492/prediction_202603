import { db } from "./index";
import { sql } from "drizzle-orm";

/**
 * Compute per-source credibility multiplier from historical accuracy.
 * Sources with >= 3 resolved connections get scored; others default to 1.0.
 * Score = 0.5 + correctRate → range [0.5, 1.5]
 */
export async function computeSourceCredibility(workspaceId: string): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT
      ne.source,
      COUNT(*) FILTER (WHERE t.status = 'resolved_correct') AS correct_count,
      COUNT(*) AS total_count
    FROM connections c
    JOIN news_events ne ON ne.id = c.source_news_id
    JOIN theses t ON t.id = c.to_id AND c.to_type = 'thesis'
    WHERE ne.source IS NOT NULL
      AND t.status LIKE 'resolved_%'
      AND c.workspace_id = ${workspaceId}
    GROUP BY ne.source
  `);

  const rows = result.rows as Array<{
    source: string;
    correct_count: string;
    total_count: string;
  }>;

  const credMap = new Map<string, number>();

  for (const row of rows) {
    const total = parseInt(row.total_count, 10);
    const correct = parseInt(row.correct_count, 10);
    if (total >= 3) {
      const correctRate = correct / total;
      credMap.set(row.source, 0.5 + correctRate);
    }
  }

  return credMap;
}

/**
 * Get credibility score for a specific source.
 * Returns 1.0 (neutral) if source has insufficient history.
 */
export function getCredibilityForSource(
  credMap: Map<string, number>,
  source: string | null | undefined,
): number {
  if (!source) return 1.0;
  return credMap.get(source) ?? 1.0;
}
