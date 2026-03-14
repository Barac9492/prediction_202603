import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predictions } from "@/lib/db/schema";
import { sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/predictions/stale?days=7
 * Returns unresolved predictions older than N days (default 7).
 */
export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") ?? 7);

  const stale = await db
    .select({
      id: predictions.id,
      topic: predictions.topic,
      direction: predictions.direction,
      confidence: predictions.confidence,
      createdAt: predictions.createdAt,
      signalCount: predictions.signalCount,
    })
    .from(predictions)
    .where(
      sql`${predictions.actualOutcome} IS NULL AND ${predictions.createdAt} < NOW() - INTERVAL '${sql.raw(String(days))} days'`
    )
    .orderBy(desc(predictions.createdAt))
    .limit(50);

  return NextResponse.json({
    count: stale.length,
    days,
    predictions: stale,
  });
}
