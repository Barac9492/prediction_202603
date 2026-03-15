/**
 * Seed historical track record data — resolved recommendations with actual returns,
 * additional resolved theses with Brier scores, and connections for signal quality.
 *
 * Usage: npx tsx scripts/seed-track-record.ts [workspaceId]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, and } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const { theses, connections, recommendations, newsEvents, priceSnapshots } = schema;
const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function main() {
  const workspaceId = process.argv[2] || "test-workspace";
  console.log(`\n=== Seeding Track Record for workspace: ${workspaceId} ===\n`);

  // ── Step 1: Create historical resolved theses ─────────────────
  console.log("--- Step 1: Historical resolved theses ---");

  const historicalTheses = [
    // Correctly predicted
    {
      title: "NVIDIA H100 demand exceeds supply through Q3 2024",
      description: "H100 GPU demand from hyperscalers exceeds NVIDIA's production capacity, leading to multi-quarter backlogs.",
      direction: "bullish", domain: "Semiconductors", tags: ["NVIDIA", "H100", "GPU"],
      status: "resolved_correct", resolvedAt: new Date("2024-10-01"),
      createdAt: new Date("2024-03-15"), finalProbability: 0.82, brierScore: 0.0324,
      resolutionSource: "NVIDIA Q3 2024 earnings confirmed continued supply constraints",
    },
    {
      title: "ChatGPT reaches 200M weekly active users by mid-2024",
      description: "ChatGPT usage accelerates with enterprise rollout and mobile app growth.",
      direction: "bullish", domain: "AI", tags: ["OpenAI", "ChatGPT", "adoption"],
      status: "resolved_correct", resolvedAt: new Date("2024-08-15"),
      createdAt: new Date("2024-01-10"), finalProbability: 0.71, brierScore: 0.0841,
      resolutionSource: "OpenAI blog post confirmed 200M+ WAU",
    },
    {
      title: "Microsoft Azure AI revenue grows >50% YoY in 2024",
      description: "Azure AI services revenue growth accelerates driven by OpenAI integration and Copilot.",
      direction: "bullish", domain: "AI", tags: ["Microsoft", "Azure", "cloud"],
      status: "resolved_correct", resolvedAt: new Date("2024-07-25"),
      createdAt: new Date("2024-02-01"), finalProbability: 0.68, brierScore: 0.1024,
      resolutionSource: "Microsoft FY24 Q4 earnings: Azure AI growth ~60% YoY",
    },
    {
      title: "Meta releases Llama 3 with GPT-3.5+ performance",
      description: "Meta's next-gen open model matches or exceeds GPT-3.5 on major benchmarks.",
      direction: "bullish", domain: "AI", tags: ["Meta AI", "Llama", "open-source"],
      status: "resolved_correct", resolvedAt: new Date("2024-04-18"),
      createdAt: new Date("2023-12-01"), finalProbability: 0.65, brierScore: 0.1225,
      resolutionSource: "Llama 3 released April 2024, beat GPT-3.5 on MMLU/HumanEval",
    },
    {
      title: "AI-related M&A exceeds $50B total in 2024",
      description: "Major acquisitions in AI infrastructure, startups, and talent drive record deal volume.",
      direction: "bullish", domain: "Macro", tags: ["M&A", "acquisition", "investment"],
      status: "resolved_correct", resolvedAt: new Date("2024-12-15"),
      createdAt: new Date("2024-03-01"), finalProbability: 0.58, brierScore: 0.1764,
      resolutionSource: "PitchBook data confirmed >$60B in AI M&A for 2024",
    },
    {
      title: "Anthropic raises at >$15B valuation in 2024",
      description: "Strong enterprise traction drives next fundraise at significantly higher valuation.",
      direction: "bullish", domain: "AI", tags: ["Anthropic", "valuation", "funding"],
      status: "resolved_correct", resolvedAt: new Date("2024-03-28"),
      createdAt: new Date("2023-11-15"), finalProbability: 0.75, brierScore: 0.0625,
      resolutionSource: "Anthropic raised $2.75B at $18.4B valuation (March 2024)",
    },
    // Incorrectly predicted
    {
      title: "Google Gemini overtakes ChatGPT in market share by Q3 2024",
      description: "Gemini's multimodal capabilities and Google distribution drive rapid adoption past ChatGPT.",
      direction: "bullish", domain: "AI", tags: ["Google DeepMind", "Gemini", "competition"],
      status: "resolved_incorrect", resolvedAt: new Date("2024-10-01"),
      createdAt: new Date("2024-02-15"), finalProbability: 0.45, brierScore: 0.2025,
      resolutionSource: "Gemini usage remained well below ChatGPT through Q3 2024",
    },
    {
      title: "US passes comprehensive AI legislation by end 2024",
      description: "Bipartisan pressure leads to federal AI safety and governance framework legislation.",
      direction: "bullish", domain: "Policy", tags: ["regulation", "AI safety", "policy"],
      status: "resolved_incorrect", resolvedAt: new Date("2024-12-31"),
      createdAt: new Date("2024-01-20"), finalProbability: 0.35, brierScore: 0.1225,
      resolutionSource: "No comprehensive federal AI legislation passed in 2024",
    },
    {
      title: "AMD MI300X captures >15% of AI training GPU market in 2024",
      description: "AMD's MI300X gains significant market share from NVIDIA in data center AI training.",
      direction: "bullish", domain: "Semiconductors", tags: ["AMD", "MI300X", "GPU"],
      status: "resolved_incorrect", resolvedAt: new Date("2024-12-20"),
      createdAt: new Date("2024-04-01"), finalProbability: 0.52, brierScore: 0.2704,
      resolutionSource: "AMD MI300X estimated ~5-8% AI training share, well below 15% target",
    },
    {
      title: "Autonomous AI agents handle 20% of customer service interactions",
      description: "AI agents (not just chatbots) autonomously resolve customer service issues end-to-end.",
      direction: "bullish", domain: "AI", tags: ["agents", "automation", "customer service"],
      status: "resolved_incorrect", resolvedAt: new Date("2024-11-15"),
      createdAt: new Date("2024-02-01"), finalProbability: 0.40, brierScore: 0.16,
      resolutionSource: "Autonomous resolution rates remained ~5-10% across major deployments",
    },
    // More correct predictions for better hit rate
    {
      title: "TSMC revenue grows >25% in 2024 driven by AI chip demand",
      description: "AI accelerator demand drives TSMC revenue growth well above historical averages.",
      direction: "bullish", domain: "Semiconductors", tags: ["TSMC", "fab capacity", "revenue"],
      status: "resolved_correct", resolvedAt: new Date("2025-01-15"),
      createdAt: new Date("2024-04-01"), finalProbability: 0.72, brierScore: 0.0784,
      resolutionSource: "TSMC FY2024 revenue grew ~33% YoY",
    },
    {
      title: "Enterprise AI spending growth exceeds 30% YoY in 2024",
      description: "Corporate AI budgets expand rapidly as companies move from pilot to production.",
      direction: "bullish", domain: "Macro", tags: ["enterprise", "spending", "adoption"],
      status: "resolved_correct", resolvedAt: new Date("2025-01-20"),
      createdAt: new Date("2024-05-01"), finalProbability: 0.66, brierScore: 0.1156,
      resolutionSource: "IDC: Enterprise AI spending grew ~38% YoY in 2024",
    },
    {
      title: "OpenAI annual revenue exceeds $3B by end of 2024",
      description: "ChatGPT Plus, Teams, and API revenue growth pushes OpenAI past $3B ARR.",
      direction: "bullish", domain: "AI", tags: ["OpenAI", "revenue", "SaaS"],
      status: "resolved_correct", resolvedAt: new Date("2025-01-05"),
      createdAt: new Date("2024-06-01"), finalProbability: 0.70, brierScore: 0.09,
      resolutionSource: "Reports indicate OpenAI reached ~$4B ARR by end of 2024",
    },
  ];

  const createdThesisIds: number[] = [];
  for (const data of historicalTheses) {
    const [existing] = await db
      .select()
      .from(theses)
      .where(and(eq(theses.workspaceId, workspaceId), eq(theses.title, data.title)));

    if (existing) {
      createdThesisIds.push(existing.id);
      console.log(`  [exists] ${data.title.slice(0, 60)}`);
    } else {
      const [t] = await db
        .insert(theses)
        .values({
          workspaceId, ...data,
          isActive: false,
          deadline: data.resolvedAt,
        })
        .returning();
      createdThesisIds.push(t.id);
      console.log(`  [created id=${t.id}] ${data.title.slice(0, 60)} → ${data.status}`);
    }
  }
  console.log(`  Total historical theses: ${createdThesisIds.length}\n`);

  // ── Step 2: Create historical resolved recommendations ────────
  console.log("--- Step 2: Historical resolved recommendations ---");

  const historicalRecs = [
    // BUY correct
    {
      action: "BUY", asset: "NVIDIA Corporation", ticker: "NVDA", conviction: 0.88,
      priceAtCreation: 78.50, priceAtResolution: 145.20, actualReturn: 0.85,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-01-15"), resolvedAt: new Date("2024-04-15"),
      rationale: "H100 demand surge and data center growth acceleration",
      brierScore: 0.014, thesisIdx: 0,
    },
    {
      action: "BUY", asset: "NVIDIA Corporation", ticker: "NVDA", conviction: 0.82,
      priceAtCreation: 120.50, priceAtResolution: 148.30, actualReturn: 0.231,
      status: "resolved_correct", timeframeDays: 60,
      createdAt: new Date("2024-06-01"), resolvedAt: new Date("2024-08-01"),
      rationale: "Blackwell pre-orders exceeded expectations, data center revenue guidance raised",
      brierScore: 0.032, thesisIdx: 0,
    },
    {
      action: "BUY", asset: "Microsoft Corporation", ticker: "MSFT", conviction: 0.72,
      priceAtCreation: 378.00, priceAtResolution: 425.50, actualReturn: 0.126,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-03-01"), resolvedAt: new Date("2024-06-01"),
      rationale: "Azure AI growth accelerating, Copilot enterprise adoption rising",
      brierScore: 0.078, thesisIdx: 2,
    },
    {
      action: "BUY", asset: "Meta Platforms", ticker: "META", conviction: 0.68,
      priceAtCreation: 390.00, priceAtResolution: 510.00, actualReturn: 0.308,
      status: "resolved_correct", timeframeDays: 120,
      createdAt: new Date("2024-02-15"), resolvedAt: new Date("2024-06-15"),
      rationale: "Llama ecosystem growth + AI-driven ad revenue improvements",
      brierScore: 0.102, thesisIdx: 3,
    },
    {
      action: "BUY", asset: "Taiwan Semiconductor", ticker: "TSM", conviction: 0.75,
      priceAtCreation: 135.00, priceAtResolution: 178.00, actualReturn: 0.319,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-04-01"), resolvedAt: new Date("2024-07-01"),
      rationale: "Advanced node demand outpacing capacity, AI chip revenue accelerating",
      brierScore: 0.063, thesisIdx: 10,
    },
    {
      action: "BUY", asset: "Broadcom", ticker: "AVGO", conviction: 0.70,
      priceAtCreation: 142.00, priceAtResolution: 176.00, actualReturn: 0.239,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-05-01"), resolvedAt: new Date("2024-08-01"),
      rationale: "Custom AI chip (TPU/ASIC) demand growing rapidly",
      brierScore: 0.09, thesisIdx: 4,
    },
    {
      action: "BUY", asset: "Arista Networks", ticker: "ANET", conviction: 0.65,
      priceAtCreation: 280.00, priceAtResolution: 340.00, actualReturn: 0.214,
      status: "resolved_correct", timeframeDays: 60,
      createdAt: new Date("2024-06-15"), resolvedAt: new Date("2024-08-15"),
      rationale: "AI data center networking demand driving order growth",
      brierScore: 0.122, thesisIdx: 11,
    },
    // BUY incorrect
    {
      action: "BUY", asset: "Advanced Micro Devices", ticker: "AMD", conviction: 0.62,
      priceAtCreation: 175.00, priceAtResolution: 155.00, actualReturn: -0.114,
      status: "resolved_incorrect", timeframeDays: 60,
      createdAt: new Date("2024-05-15"), resolvedAt: new Date("2024-07-15"),
      rationale: "MI300X ramp expected to accelerate GPU market share gain",
      brierScore: 0.144, thesisIdx: 8,
    },
    {
      action: "BUY", asset: "C3.ai", ticker: "AI", conviction: 0.55,
      priceAtCreation: 28.50, priceAtResolution: 22.00, actualReturn: -0.228,
      status: "resolved_incorrect", timeframeDays: 90,
      createdAt: new Date("2024-03-01"), resolvedAt: new Date("2024-06-01"),
      rationale: "Enterprise AI platform demand should accelerate with sector tailwinds",
      brierScore: 0.202, thesisIdx: 11,
    },
    {
      action: "BUY", asset: "SoundHound AI", ticker: "SOUN", conviction: 0.50,
      priceAtCreation: 7.50, priceAtResolution: 5.20, actualReturn: -0.307,
      status: "resolved_incorrect", timeframeDays: 60,
      createdAt: new Date("2024-04-01"), resolvedAt: new Date("2024-06-01"),
      rationale: "Voice AI adoption in automotive and restaurant sectors",
      brierScore: 0.25, thesisIdx: 9,
    },
    // AVOID correct (price went down as predicted)
    {
      action: "AVOID", asset: "Snap Inc.", ticker: "SNAP", conviction: 0.72,
      priceAtCreation: 17.00, priceAtResolution: 11.50, actualReturn: 0.324,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-02-01"), resolvedAt: new Date("2024-05-01"),
      rationale: "AI ad competition from Meta and Google eroding Snap's position",
      brierScore: 0.078, thesisIdx: 6,
    },
    {
      action: "AVOID", asset: "Chegg Inc.", ticker: "CHGG", conviction: 0.80,
      priceAtCreation: 8.50, priceAtResolution: 3.20, actualReturn: 0.624,
      status: "resolved_correct", timeframeDays: 120,
      createdAt: new Date("2024-01-15"), resolvedAt: new Date("2024-05-15"),
      rationale: "ChatGPT disrupting homework help market, subscriber losses accelerating",
      brierScore: 0.04, thesisIdx: 9,
    },
    // HOLD
    {
      action: "HOLD", asset: "Alphabet Inc.", ticker: "GOOGL", conviction: 0.60,
      priceAtCreation: 152.00, priceAtResolution: 168.00, actualReturn: 0.105,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-04-01"), resolvedAt: new Date("2024-07-01"),
      rationale: "Gemini potential offset by regulatory risk, hold existing position",
      brierScore: 0.16, thesisIdx: 6,
    },
    {
      action: "HOLD", asset: "Amazon.com", ticker: "AMZN", conviction: 0.58,
      priceAtCreation: 178.00, priceAtResolution: 195.00, actualReturn: 0.096,
      status: "resolved_correct", timeframeDays: 60,
      createdAt: new Date("2024-06-01"), resolvedAt: new Date("2024-08-01"),
      rationale: "AWS AI services growing but Bedrock adoption pace unclear",
      brierScore: 0.176, thesisIdx: 11,
    },
    // WATCH correct
    {
      action: "WATCH", asset: "Palantir Technologies", ticker: "PLTR", conviction: 0.65,
      priceAtCreation: 24.00, priceAtResolution: 38.00, actualReturn: 0.583,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-05-01"), resolvedAt: new Date("2024-08-01"),
      rationale: "AIP platform gaining enterprise traction, wait for valuation pullback to enter",
      brierScore: 0.122, thesisIdx: 11,
    },
    // WATCH incorrect (missed the move)
    {
      action: "WATCH", asset: "AppLovin Corporation", ticker: "APP", conviction: 0.55,
      priceAtCreation: 65.00, priceAtResolution: 180.00, actualReturn: -1.769,
      status: "resolved_incorrect", timeframeDays: 120,
      createdAt: new Date("2024-03-01"), resolvedAt: new Date("2024-07-01"),
      rationale: "AI-driven ad optimization interesting but valuation stretched — watch for entry",
      brierScore: 0.202, thesisIdx: 11,
    },
    // More recent resolved recs
    {
      action: "BUY", asset: "Vertiv Holdings", ticker: "VRT", conviction: 0.70,
      priceAtCreation: 68.00, priceAtResolution: 95.00, actualReturn: 0.397,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-07-01"), resolvedAt: new Date("2024-10-01"),
      rationale: "Data center power infrastructure demand from AI buildout",
      brierScore: 0.09, thesisIdx: 11,
    },
    {
      action: "BUY", asset: "Arm Holdings", ticker: "ARM", conviction: 0.68,
      priceAtCreation: 115.00, priceAtResolution: 140.00, actualReturn: 0.217,
      status: "resolved_correct", timeframeDays: 60,
      createdAt: new Date("2024-08-01"), resolvedAt: new Date("2024-10-01"),
      rationale: "ARM architecture gaining AI inference workload share",
      brierScore: 0.102, thesisIdx: 0,
    },
    {
      action: "AVOID", asset: "UiPath", ticker: "PATH", conviction: 0.65,
      priceAtCreation: 22.00, priceAtResolution: 14.50, actualReturn: 0.341,
      status: "resolved_correct", timeframeDays: 90,
      createdAt: new Date("2024-06-01"), resolvedAt: new Date("2024-09-01"),
      rationale: "Traditional RPA being disrupted by AI agents, customer churn risk",
      brierScore: 0.122, thesisIdx: 9,
    },
    {
      action: "BUY", asset: "Super Micro Computer", ticker: "SMCI", conviction: 0.72,
      priceAtCreation: 800.00, priceAtResolution: 450.00, actualReturn: -0.4375,
      status: "resolved_incorrect", timeframeDays: 90,
      createdAt: new Date("2024-07-15"), resolvedAt: new Date("2024-10-15"),
      rationale: "AI server demand driving rapid revenue growth, GPU proximity advantage",
      brierScore: 0.078, thesisIdx: 0,
    },
  ];

  let recCount = 0;
  for (const rec of historicalRecs) {
    const thesisId = createdThesisIds[rec.thesisIdx] ?? createdThesisIds[0];

    await db.insert(recommendations).values({
      workspaceId,
      thesisId,
      action: rec.action,
      asset: rec.asset,
      ticker: rec.ticker,
      conviction: rec.conviction,
      timeframeDays: rec.timeframeDays,
      deadline: rec.resolvedAt,
      rationale: rec.rationale,
      status: rec.status,
      priceAtCreation: rec.priceAtCreation,
      priceAtResolution: rec.priceAtResolution,
      actualReturn: rec.actualReturn,
      brierScore: rec.brierScore,
      probabilityAtCreation: historicalTheses[rec.thesisIdx]?.finalProbability ?? 0.6,
      probabilityAtResolution: rec.status === "resolved_correct" ? 0.8 : 0.4,
      resolvedAt: rec.resolvedAt,
      createdAt: rec.createdAt,
    });

    const returnStr = rec.actualReturn > 0
      ? `+${(rec.actualReturn * 100).toFixed(1)}%`
      : `${(rec.actualReturn * 100).toFixed(1)}%`;
    console.log(
      `  ${rec.action.padEnd(6)} ${rec.asset.padEnd(25)} ${returnStr.padEnd(10)} ${rec.status === "resolved_correct" ? "CORRECT" : "INCORRECT"}`,
    );

    // Store price snapshots for these tickers
    if (rec.ticker) {
      await db.insert(priceSnapshots).values({
        workspaceId,
        ticker: rec.ticker,
        price: rec.priceAtCreation,
        capturedAt: rec.createdAt,
      });
      await db.insert(priceSnapshots).values({
        workspaceId,
        ticker: rec.ticker,
        price: rec.priceAtResolution,
        capturedAt: rec.resolvedAt,
      });
    }
    recCount++;
  }
  console.log(`  Total historical recommendations: ${recCount}\n`);

  // ── Step 3: Create connections from news to resolved theses ───
  console.log("--- Step 3: Connecting news to resolved theses ---");

  // Get existing news events
  const existingNews = await db
    .select()
    .from(newsEvents)
    .where(eq(newsEvents.workspaceId, workspaceId))
    .limit(40);

  let connCount = 0;
  for (let i = 0; i < Math.min(existingNews.length, 30); i++) {
    const news = existingNews[i];
    // Connect to a few resolved theses based on keyword matching
    for (let j = 0; j < Math.min(createdThesisIds.length, 5); j++) {
      const thesisId = createdThesisIds[j];
      const thesis = historicalTheses[j];
      const text = (news.title + " " + (news.summary ?? "")).toLowerCase();
      const relevant = thesis.tags.some((t) => text.includes(t.toLowerCase()));
      if (!relevant) continue;

      const direction = thesis.status === "resolved_correct" ? "bullish" : "bearish";
      await db.insert(connections).values({
        workspaceId,
        fromType: "news_event",
        fromId: news.id,
        toType: "thesis",
        toId: thesisId,
        relation: "SUPPORTS",
        direction,
        confidence: 0.5 + Math.random() * 0.4,
        weight: 0.8 + Math.random() * 0.8,
        sourceNewsId: news.id,
        reasoning: `${news.source}: ${news.title?.slice(0, 80)}`,
      });
      connCount++;
    }
  }
  console.log(`  Created ${connCount} news-thesis connections for signal quality\n`);

  // ── Summary ───────────────────────────────────────────────────
  const resolvedThesisCount = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(theses)
      .where(and(eq(theses.workspaceId, workspaceId), sql`${theses.status} LIKE 'resolved_%'`))
  )[0].c;

  const resolvedRecCount = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(recommendations)
      .where(and(eq(recommendations.workspaceId, workspaceId), sql`${recommendations.status} != 'active'`))
  )[0].c;

  const totalConns = (
    await db
      .select({ c: sql<number>`count(*)::int` })
      .from(connections)
      .where(eq(connections.workspaceId, workspaceId))
  )[0].c;

  console.log("=== Track Record Summary ===");
  console.log(`  Resolved Theses:          ${resolvedThesisCount}`);
  console.log(`  Resolved Recommendations: ${resolvedRecCount}`);
  console.log(`  Total Connections:        ${totalConns}`);
  console.log(`\nDone! Refresh /performance to see track record.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
