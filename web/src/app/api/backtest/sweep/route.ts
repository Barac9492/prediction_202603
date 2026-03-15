import { NextRequest, NextResponse } from "next/server";
import { runSweep, DEFAULT_SWEEP, type SweepConfig } from "@/lib/backtest/sweep";
import { getWorkspaceId } from "@/lib/db/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** POST /api/backtest/sweep - Run parameter sweep */
export async function POST(req: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId();
    const body = await req.json().catch(() => ({}));

    const config: SweepConfig = {
      decayRates: body.decayRates ?? DEFAULT_SWEEP.decayRates,
      modelWeights: body.modelWeights ?? DEFAULT_SWEEP.modelWeights,
      crossThesisCaps: body.crossThesisCaps ?? DEFAULT_SWEEP.crossThesisCaps,
      neutralFactors: body.neutralFactors ?? DEFAULT_SWEEP.neutralFactors,
      intervalHours: body.intervalHours ?? DEFAULT_SWEEP.intervalHours,
    };

    const totalCombinations =
      config.decayRates!.length *
      config.modelWeights!.length *
      config.crossThesisCaps!.length *
      config.neutralFactors!.length;

    const results = await runSweep(workspaceId, config);

    return NextResponse.json({
      totalCombinations,
      results: results.map((r, i) => ({
        rank: i + 1,
        params: r.params,
        aggregateBrier: r.aggregateBrier,
        thesisCount: r.thesisCount,
        perThesis: r.perThesis,
      })),
      best: results[0] ? {
        params: results[0].params,
        aggregateBrier: results[0].aggregateBrier,
      } : null,
    });
  } catch (err) {
    console.error("Sweep failed:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
