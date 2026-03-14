import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { theses, connections, thesisProbabilitySnapshots } from "@/lib/db/schema";
import { eq, and, desc, lte } from "drizzle-orm";
import { computeThesisProbabilityAtTime, DEFAULT_PARAMS } from "@/lib/db/probability";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const thesisIdParam = url.searchParams.get("thesisId");
  const intervalHours = parseInt(url.searchParams.get("interval") || "24", 10);
  const dryRun = url.searchParams.get("dryRun") === "true";

  // Get target theses
  let targetTheses;
  if (thesisIdParam) {
    targetTheses = await db
      .select()
      .from(theses)
      .where(eq(theses.id, parseInt(thesisIdParam, 10)));
  } else {
    targetTheses = await db.select().from(theses);
  }

  if (targetTheses.length === 0) {
    return NextResponse.json({ error: "No theses found" }, { status: 404 });
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;
  const results = [];

  for (const thesis of targetTheses) {
    const startTime = new Date(thesis.createdAt).getTime();
    const endTime = thesis.resolvedAt
      ? new Date(thesis.resolvedAt).getTime()
      : Date.now();

    // Pre-load all connections for this thesis
    const allConns = await db
      .select()
      .from(connections)
      .where(and(eq(connections.toType, "thesis"), eq(connections.toId, thesis.id)));

    // Get existing snapshots to skip
    const existingSnapshots = await db
      .select({ computedAt: thesisProbabilitySnapshots.computedAt })
      .from(thesisProbabilitySnapshots)
      .where(eq(thesisProbabilitySnapshots.thesisId, thesis.id));

    const existingTimes = new Set(
      existingSnapshots.map((s) => new Date(s.computedAt).getTime())
    );

    const snapshots: Array<{
      timestamp: string;
      probability: number;
      signalCount: number;
      momentum: number | null;
    }> = [];

    let prevProbability: number | null = null;

    for (let t = startTime; t <= endTime; t += intervalMs) {
      // Idempotent: skip if snapshot already exists at this timestamp
      if (existingTimes.has(t)) {
        // Still track prev probability for momentum calc
        const existing = existingSnapshots.find(
          (s) => new Date(s.computedAt).getTime() === t
        );
        // We don't have probability in our select, so just skip momentum tracking
        prevProbability = null;
        continue;
      }

      const asOfDate = new Date(t);

      const computed = await computeThesisProbabilityAtTime(
        thesis.id,
        asOfDate,
        DEFAULT_PARAMS,
        {
          allConnections: allConns,
          skipCrossThesis: true, // First pass: no cross-thesis (no prior snapshots to reference)
          skipMarketBlend: true, // Market signals don't have historical timestamps
        },
      );

      const momentum = prevProbability !== null
        ? computed.probability - prevProbability
        : null;

      prevProbability = computed.probability;

      if (!dryRun) {
        await db.insert(thesisProbabilitySnapshots).values({
          thesisId: thesis.id,
          probability: computed.probability,
          bullishWeight: computed.bullishWeight,
          bearishWeight: computed.bearishWeight,
          neutralWeight: computed.neutralWeight,
          signalCount: computed.signalCount,
          momentum: momentum ?? undefined,
          computedAt: asOfDate,
          topNewsIds: computed.topNewsIds,
        });
      }

      snapshots.push({
        timestamp: asOfDate.toISOString(),
        probability: computed.probability,
        signalCount: computed.signalCount,
        momentum,
      });
    }

    results.push({
      thesisId: thesis.id,
      title: thesis.title,
      snapshotsGenerated: snapshots.length,
      existingSkipped: existingTimes.size,
      timeRange: {
        from: new Date(startTime).toISOString(),
        to: new Date(endTime).toISOString(),
      },
      ...(dryRun ? { preview: snapshots.slice(0, 5) } : {}),
    });
  }

  return NextResponse.json({
    dryRun,
    intervalHours,
    thesesProcessed: results.length,
    totalSnapshots: results.reduce((s, r) => s + r.snapshotsGenerated, 0),
    results,
  });
}
