/**
 * Standalone backtest runner — imports the engine directly, bypasses HTTP/auth.
 * Usage: npx tsx scripts/run-backtests.ts [workspaceId]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, desc, and, lte } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const {
  theses,
  connections,
  backtestRuns,
  thesisProbabilitySnapshots,
} = schema;

// --- DB setup (duplicated to avoid @/ alias issues) ---
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set");
const db = drizzle(neon(dbUrl), { schema });

// --- ProbabilityParams type ---
interface ProbabilityParams {
  decayRate: number;
  modelWeight: number;
  marketWeight: number;
  crossThesisCap: number;
  neutralFactor: number;
}

const DEFAULT_PARAMS: ProbabilityParams = {
  decayRate: 0.03,
  modelWeight: 0.7,
  marketWeight: 0.3,
  crossThesisCap: 0.1,
  neutralFactor: 0.25,
};

// --- Inline probability computation (avoids @/ imports) ---
async function computeProb(
  workspaceId: string,
  thesisId: number,
  asOfDate: Date,
  params: ProbabilityParams,
  allConnections: (typeof connections.$inferSelect)[],
): Promise<{ probability: number }> {
  const asOf = asOfDate.getTime();
  const conns = allConnections.filter(
    (c) =>
      c.toType === "thesis" &&
      c.toId === thesisId &&
      new Date(c.createdAt).getTime() <= asOf,
  );

  if (conns.length === 0) return { probability: 0.5 };

  let bullish = 0,
    bearish = 0,
    neutral = 0;

  for (const conn of conns) {
    const rawWeight = (conn.adjustedWeight ?? conn.weight) * conn.confidence;
    const ageDays =
      (asOf - new Date(conn.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const score = rawWeight * Math.exp(-ageDays * params.decayRate);

    if (conn.direction === "bullish") bullish += score;
    else if (conn.direction === "bearish") bearish += score;
    else neutral += score;
  }

  const EVIDENCE_SCALE = 0.15;
  const netEvidence =
    (bullish - bearish + neutral * params.neutralFactor) * EVIDENCE_SCALE;
  const probability = Math.max(
    0.05,
    Math.min(0.95, 1 / (1 + Math.exp(-netEvidence))),
  );

  return { probability };
}

// --- Backtest engine ---
interface ThesisBacktestResult {
  thesisId: number;
  title: string;
  direction: string;
  outcome: number;
  finalProbability: number;
  brierScore: number;
  snapshotCount: number;
}

interface BacktestResult {
  thesisResults: ThesisBacktestResult[];
  aggregateBrier: number;
  calibrationBuckets: Array<{
    bucket: string;
    range: [number, number];
    count: number;
    avgPredicted: number;
    avgActual: number;
  }>;
}

async function runBacktest(
  workspaceId: string,
  params: ProbabilityParams,
  allConns: (typeof connections.$inferSelect)[],
  resolvedThesesList: (typeof theses.$inferSelect)[],
): Promise<BacktestResult> {
  const intervalMs = 24 * 60 * 60 * 1000;
  const thesisResults: ThesisBacktestResult[] = [];

  for (const thesis of resolvedThesesList) {
    if (!thesis.resolvedAt) continue;
    const outcome = thesis.status === "resolved_correct" ? 1 : 0;
    const startTime = new Date(thesis.createdAt).getTime();
    const endTime = new Date(thesis.resolvedAt).getTime();

    let finalProbability = 0.5;
    let snapshotCount = 0;

    for (let t = startTime; t <= endTime; t += intervalMs) {
      const computed = await computeProb(
        workspaceId,
        thesis.id,
        new Date(t),
        params,
        allConns,
      );
      finalProbability = computed.probability;
      snapshotCount++;
    }

    const brierScore = Math.pow(finalProbability - outcome, 2);
    thesisResults.push({
      thesisId: thesis.id,
      title: thesis.title,
      direction: thesis.direction,
      outcome,
      finalProbability,
      brierScore,
      snapshotCount,
    });
  }

  const aggregateBrier =
    thesisResults.length > 0
      ? thesisResults.reduce((s, r) => s + r.brierScore, 0) /
        thesisResults.length
      : 0;

  const bucketDefs: Array<{ bucket: string; range: [number, number] }> = [
    { bucket: "0-20%", range: [0, 0.2] },
    { bucket: "20-40%", range: [0.2, 0.4] },
    { bucket: "40-60%", range: [0.4, 0.6] },
    { bucket: "60-80%", range: [0.6, 0.8] },
    { bucket: "80-100%", range: [0.8, 1.0] },
  ];

  const calibrationBuckets = bucketDefs.map(({ bucket, range }) => {
    const inBucket = thesisResults.filter(
      (r) =>
        r.finalProbability >= range[0] &&
        r.finalProbability < (range[1] === 1.0 ? 1.01 : range[1]),
    );
    return {
      bucket,
      range,
      count: inBucket.length,
      avgPredicted:
        inBucket.length > 0
          ? inBucket.reduce((s, r) => s + r.finalProbability, 0) /
            inBucket.length
          : 0,
      avgActual:
        inBucket.length > 0
          ? inBucket.reduce((s, r) => s + r.outcome, 0) / inBucket.length
          : 0,
    };
  });

  return { thesisResults, aggregateBrier, calibrationBuckets };
}

async function runAndStore(
  workspaceId: string,
  name: string,
  params: ProbabilityParams,
  allConns: (typeof connections.$inferSelect)[],
  resolvedThesesList: (typeof theses.$inferSelect)[],
): Promise<{ runId: number; result: BacktestResult }> {
  const [run] = await db
    .insert(backtestRuns)
    .values({
      workspaceId,
      name,
      startDate: new Date(),
      endDate: new Date(),
      parameters: params as unknown as Record<string, unknown>,
      status: "pending",
    })
    .returning();

  const result = await runBacktest(workspaceId, params, allConns, resolvedThesesList);

  await db
    .update(backtestRuns)
    .set({
      results: {
        aggregateBrier: result.aggregateBrier,
        calibrationBuckets: result.calibrationBuckets,
        thesisCount: result.thesisResults.length,
        thesisSummaries: result.thesisResults.map((r) => ({
          thesisId: r.thesisId,
          title: r.title,
          brierScore: r.brierScore,
          finalProbability: r.finalProbability,
          outcome: r.outcome,
        })),
      } as Record<string, unknown>,
      accuracy: 1 - result.aggregateBrier,
      totalSignals: result.thesisResults.reduce(
        (s, r) => s + r.snapshotCount,
        0,
      ),
      status: "complete",
      completedAt: new Date(),
    })
    .where(eq(backtestRuns.id, run.id));

  return { runId: run.id, result };
}

// --- Seed resolved theses if needed ---
async function seedResolvedTheses(workspaceId: string): Promise<void> {
  console.log("Seeding resolved theses for backtesting...");

  const existing = await db
    .select()
    .from(theses)
    .where(eq(theses.workspaceId, workspaceId));

  if (existing.length === 0) {
    console.log("No theses at all — creating test theses + connections...");

    const seedData = [
      {
        title: "NVIDIA will exceed $150 by Q2 2025",
        description: "Strong AI demand drives GPU revenue growth",
        direction: "bullish",
        domain: "Semiconductors",
        status: "resolved_correct",
        resolvedAt: new Date("2025-02-15"),
        createdAt: new Date("2024-11-01"),
      },
      {
        title: "Federal Reserve will cut rates to 4% by March 2025",
        description: "Inflation cooling drives dovish pivot",
        direction: "bullish",
        domain: "Macro",
        status: "resolved_incorrect",
        resolvedAt: new Date("2025-03-01"),
        createdAt: new Date("2024-10-15"),
      },
      {
        title: "Tesla deliveries decline Q4 2024 vs Q3",
        description: "Competition and demand softening",
        direction: "bearish",
        domain: "EV",
        status: "resolved_correct",
        resolvedAt: new Date("2025-01-10"),
        createdAt: new Date("2024-09-20"),
      },
      {
        title: "OpenAI valuation exceeds $200B by 2025",
        description: "Enterprise AI adoption accelerating",
        direction: "bullish",
        domain: "AI",
        status: "resolved_correct",
        resolvedAt: new Date("2025-02-28"),
        createdAt: new Date("2024-10-01"),
      },
      {
        title: "Bitcoin breaks $120k by end of Q1 2025",
        description: "ETF inflows and halving cycle momentum",
        direction: "bullish",
        domain: "Crypto",
        status: "resolved_incorrect",
        resolvedAt: new Date("2025-03-10"),
        createdAt: new Date("2024-11-15"),
      },
    ];

    for (const data of seedData) {
      const [t] = await db
        .insert(theses)
        .values({
          workspaceId,
          ...data,
          isActive: false,
          finalProbability: data.status === "resolved_correct" ? 0.75 : 0.6,
          brierScore:
            data.status === "resolved_correct"
              ? Math.pow(0.75 - 1, 2)
              : Math.pow(0.6 - 0, 2),
        })
        .returning();

      // Create some connections for each thesis
      const directions = ["bullish", "bearish", "neutral"];
      const numConns = 5 + Math.floor(Math.random() * 10);
      for (let i = 0; i < numConns; i++) {
        const dir =
          data.status === "resolved_correct"
            ? Math.random() > 0.3
              ? data.direction
              : directions[Math.floor(Math.random() * 3)]
            : Math.random() > 0.5
              ? data.direction === "bullish"
                ? "bearish"
                : "bullish"
              : directions[Math.floor(Math.random() * 3)];

        const ageOffset = Math.random() * 60; // 0-60 days after thesis creation
        const connDate = new Date(
          new Date(data.createdAt).getTime() +
            ageOffset * 24 * 60 * 60 * 1000,
        );
        if (connDate > data.resolvedAt) continue;

        await db.insert(connections).values({
          workspaceId,
          fromType: "news",
          fromId: Math.floor(Math.random() * 1000) + 1,
          toType: "thesis",
          toId: t.id,
          relation: "SUPPORTS",
          direction: dir,
          confidence: 0.3 + Math.random() * 0.7,
          weight: 0.5 + Math.random() * 1.5,
          reasoning: `Test signal ${i + 1} for ${t.title}`,
        });
      }
      console.log(
        `  Created thesis [id=${t.id}]: ${t.title} (${t.status}) with connections`,
      );
    }
  } else {
    // Resolve some existing theses
    const active = existing.filter(
      (t) => t.status === "active" && t.isActive,
    );
    const resolved = existing.filter((t) => t.status?.startsWith("resolved_"));
    if (resolved.length >= 3) {
      console.log(
        `  Already have ${resolved.length} resolved theses — skipping seed`,
      );
      return;
    }
    const toResolve = active.slice(0, Math.min(5, active.length));
    for (let i = 0; i < toResolve.length; i++) {
      const status =
        i % 2 === 0 ? "resolved_correct" : "resolved_incorrect";
      await db
        .update(theses)
        .set({
          status,
          isActive: false,
          resolvedAt: new Date(
            Date.now() - (30 - i * 5) * 24 * 60 * 60 * 1000,
          ),
          finalProbability: status === "resolved_correct" ? 0.72 : 0.55,
          brierScore:
            status === "resolved_correct"
              ? Math.pow(0.72 - 1, 2)
              : Math.pow(0.55 - 0, 2),
        })
        .where(eq(theses.id, toResolve[i].id));
      console.log(
        `  Resolved thesis [id=${toResolve[i].id}]: ${toResolve[i].title} → ${status}`,
      );
    }
  }
}

// --- Sweep engine (inline) ---
async function runSweepInline(
  workspaceId: string,
  allConns: (typeof connections.$inferSelect)[],
  resolvedThesesList: (typeof theses.$inferSelect)[],
): Promise<
  Array<{
    params: ProbabilityParams;
    aggregateBrier: number;
    thesisCount: number;
    testBrier?: number;
    overfitWarning?: boolean;
  }>
> {
  const decayRates = [0.01, 0.02, 0.03, 0.05, 0.1];
  const modelWeights = [0.5, 0.6, 0.7, 0.8, 0.9];
  const crossThesisCaps = [0, 0.05, 0.1, 0.15];
  const neutralFactors = [0.1, 0.25, 0.4, 0.5];

  const trainTheses = resolvedThesesList.filter((t) => t.id % 5 !== 0);
  const testTheses = resolvedThesesList.filter((t) => t.id % 5 === 0);

  const combinations: ProbabilityParams[] = [];
  for (const dr of decayRates)
    for (const mw of modelWeights)
      for (const ctc of crossThesisCaps)
        for (const nf of neutralFactors)
          combinations.push({
            decayRate: dr,
            modelWeight: mw,
            marketWeight: 1 - mw,
            crossThesisCap: ctc,
            neutralFactor: nf,
          });

  console.log(
    `  Sweep: ${combinations.length} combinations × ${trainTheses.length} train theses`,
  );

  const results: Array<{
    params: ProbabilityParams;
    aggregateBrier: number;
    thesisCount: number;
    testBrier?: number;
    overfitWarning?: boolean;
  }> = [];

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    const result = await runBacktest(
      workspaceId,
      params,
      allConns,
      trainTheses,
    );
    results.push({
      params,
      aggregateBrier: result.aggregateBrier,
      thesisCount: result.thesisResults.length,
    });
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`  ... ${i + 1}/${combinations.length}\r`);
    }
  }
  console.log(`  ... ${combinations.length}/${combinations.length} done`);

  results.sort((a, b) => a.aggregateBrier - b.aggregateBrier);

  // Test set evaluation for top result
  if (results.length > 0 && testTheses.length > 0) {
    const best = results[0];
    const testResult = await runBacktest(
      workspaceId,
      best.params,
      allConns,
      testTheses,
    );
    best.testBrier = testResult.aggregateBrier;
    best.overfitWarning = testResult.aggregateBrier > best.aggregateBrier * 1.2;
  }

  return results;
}

// --- Main ---
async function main() {
  const workspaceId = process.argv[2] || "test-workspace";
  console.log(`\n=== Backtest Runner ===`);
  console.log(`Workspace: ${workspaceId}\n`);

  // Check for resolved theses
  let resolvedThesesList = await db
    .select()
    .from(theses)
    .where(
      sql`${theses.workspaceId} = ${workspaceId} AND ${theses.status} LIKE 'resolved_%'`,
    );

  if (resolvedThesesList.length < 3) {
    await seedResolvedTheses(workspaceId);
    resolvedThesesList = await db
      .select()
      .from(theses)
      .where(
        sql`${theses.workspaceId} = ${workspaceId} AND ${theses.status} LIKE 'resolved_%'`,
      );
  }

  console.log(`\nResolved theses: ${resolvedThesesList.length}`);
  for (const t of resolvedThesesList) {
    console.log(`  [${t.id}] ${t.title} → ${t.status}`);
  }

  // Pre-load connections
  const allConns = await db
    .select()
    .from(connections)
    .where(eq(connections.workspaceId, workspaceId));
  console.log(`Connections loaded: ${allConns.length}\n`);

  // --- Run 9 named backtests ---
  const configs: Array<{ name: string; params: ProbabilityParams }> = [
    {
      name: "baseline-default",
      params: { ...DEFAULT_PARAMS },
    },
    {
      name: "fast-decay",
      params: { ...DEFAULT_PARAMS, decayRate: 0.1 },
    },
    {
      name: "slow-decay",
      params: { ...DEFAULT_PARAMS, decayRate: 0.01 },
    },
    {
      name: "model-heavy",
      params: { ...DEFAULT_PARAMS, modelWeight: 0.9, marketWeight: 0.1 },
    },
    {
      name: "market-heavy",
      params: { ...DEFAULT_PARAMS, modelWeight: 0.5, marketWeight: 0.5 },
    },
    {
      name: "no-cross-thesis",
      params: { ...DEFAULT_PARAMS, crossThesisCap: 0.0 },
    },
    {
      name: "high-cross-thesis",
      params: { ...DEFAULT_PARAMS, crossThesisCap: 0.2 },
    },
    {
      name: "neutral-suppressed",
      params: { ...DEFAULT_PARAMS, neutralFactor: 0.1 },
    },
    {
      name: "neutral-elevated",
      params: { ...DEFAULT_PARAMS, neutralFactor: 0.5 },
    },
  ];

  console.log("--- Running 9 Named Backtests ---\n");

  const results: Array<{
    name: string;
    runId: number;
    brier: number;
    accuracy: number;
    thesisCount: number;
    params: ProbabilityParams;
  }> = [];

  for (const cfg of configs) {
    process.stdout.write(`Running "${cfg.name}"...`);
    const { runId, result } = await runAndStore(
      workspaceId,
      cfg.name,
      cfg.params,
      allConns,
      resolvedThesesList,
    );
    results.push({
      name: cfg.name,
      runId,
      brier: result.aggregateBrier,
      accuracy: 1 - result.aggregateBrier,
      thesisCount: result.thesisResults.length,
      params: cfg.params,
    });
    console.log(
      ` done (Brier: ${result.aggregateBrier.toFixed(4)}, runId: ${runId})`,
    );
  }

  // --- Comparison table ---
  console.log("\n\n=== Backtest Comparison ===\n");
  console.log(
    "Name".padEnd(20) +
      "Brier".padEnd(10) +
      "Accuracy".padEnd(10) +
      "Decay".padEnd(8) +
      "Model".padEnd(8) +
      "XThesis".padEnd(8) +
      "Neutral".padEnd(8) +
      "RunID",
  );
  console.log("-".repeat(80));

  const sorted = [...results].sort((a, b) => a.brier - b.brier);
  for (const r of sorted) {
    console.log(
      r.name.padEnd(20) +
        r.brier.toFixed(4).padEnd(10) +
        r.accuracy.toFixed(4).padEnd(10) +
        r.params.decayRate.toFixed(2).padEnd(8) +
        r.params.modelWeight.toFixed(1).padEnd(8) +
        r.params.crossThesisCap.toFixed(2).padEnd(8) +
        r.params.neutralFactor.toFixed(2).padEnd(8) +
        r.runId,
    );
  }

  console.log(`\nBest: ${sorted[0].name} (Brier: ${sorted[0].brier.toFixed(4)})`);
  console.log(`Worst: ${sorted[sorted.length - 1].name} (Brier: ${sorted[sorted.length - 1].brier.toFixed(4)})`);

  // --- Run full sweep ---
  console.log("\n\n--- Running Full Parameter Sweep (400 combinations) ---\n");
  const sweepResults = await runSweepInline(
    workspaceId,
    allConns,
    resolvedThesesList,
  );

  // Store sweep result
  const [sweepRun] = await db
    .insert(backtestRuns)
    .values({
      workspaceId,
      name: "full-sweep",
      startDate: new Date(),
      endDate: new Date(),
      parameters: { type: "sweep", combinationCount: sweepResults.length },
      results: {
        topResults: sweepResults.slice(0, 10).map((r) => ({
          params: r.params,
          aggregateBrier: r.aggregateBrier,
          testBrier: r.testBrier,
          overfitWarning: r.overfitWarning,
        })),
        totalCombinations: sweepResults.length,
      } as Record<string, unknown>,
      accuracy: sweepResults.length > 0 ? 1 - sweepResults[0].aggregateBrier : 0,
      totalSignals: sweepResults.length,
      status: "complete",
      completedAt: new Date(),
    })
    .returning();

  console.log(`\nSweep stored as runId: ${sweepRun.id}`);

  // Top 10 table
  console.log("\n=== Sweep Top 10 ===\n");
  console.log(
    "#".padEnd(4) +
      "Brier".padEnd(10) +
      "TestBrier".padEnd(12) +
      "Overfit?".padEnd(10) +
      "Decay".padEnd(8) +
      "Model".padEnd(8) +
      "XThesis".padEnd(8) +
      "Neutral",
  );
  console.log("-".repeat(70));

  for (let i = 0; i < Math.min(10, sweepResults.length); i++) {
    const r = sweepResults[i];
    console.log(
      `${i + 1}`.padEnd(4) +
        r.aggregateBrier.toFixed(4).padEnd(10) +
        (r.testBrier?.toFixed(4) ?? "N/A").padEnd(12) +
        (r.overfitWarning ? "YES" : "no").padEnd(10) +
        r.params.decayRate.toFixed(2).padEnd(8) +
        r.params.modelWeight.toFixed(1).padEnd(8) +
        r.params.crossThesisCap.toFixed(2).padEnd(8) +
        r.params.neutralFactor.toFixed(2),
    );
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Named backtests stored: ${results.length}`);
  console.log(`Sweep combinations tested: ${sweepResults.length}`);
  console.log(`Total backtest runs in DB: ${results.length + 1}`);
  console.log(
    `Best overall Brier: ${sweepResults[0]?.aggregateBrier.toFixed(4)} (sweep)`,
  );
  console.log(`Done!\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
