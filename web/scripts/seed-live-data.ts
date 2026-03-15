/**
 * Seed the app with real, live data — no ANTHROPIC_API_KEY needed.
 * Fetches real RSS news, creates real theses, entities, connections,
 * probabilities, recommendations, and signal clusters.
 *
 * Usage: npx tsx scripts/seed-live-data.ts [workspaceId]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql, desc, and } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const {
  workspaces,
  theses,
  connections,
  entities,
  newsEvents,
  entityObservations,
  signalClusters,
  recommendations,
  priceSnapshots,
  thesisProbabilitySnapshots,
  backtestRuns,
} = schema;

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

// ─── RSS Feed Fetching ───────────────────────────────────────────

const AI_RSS_FEEDS = [
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch AI" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat AI" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge AI" },
  { url: "https://arstechnica.com/ai/feed/", source: "Ars Technica AI" },
  { url: "https://hnrss.org/frontpage?q=AI+OR+LLM+OR+GPT+OR+model&count=20", source: "HN AI" },
  { url: "https://hnrss.org/frontpage?q=NVIDIA+OR+OpenAI+OR+Anthropic+OR+investment&count=10", source: "HN Invest" },
];

const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt", "claude",
  "gemini", "openai", "anthropic", "deepmind", "nvidia", "gpu", "inference",
  "model", "transformer", "generative", "chatgpt", "agent", "compute",
  "semiconductor", "chip", "mistral", "meta ai", "llama", "hugging face",
  "funding", "valuation", "revenue", "acquisition",
];

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isAiRelevant(title: string, summary: string): boolean {
  const text = (title + " " + summary).toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw));
}

interface FeedItem {
  title: string;
  url: string;
  source: string;
  content: string;
  summary: string;
  publishedAt: Date | null;
}

async function fetchFeed(feedUrl: string, source: string): Promise<FeedItem[]> {
  try {
    const resp = await fetch(feedUrl, {
      headers: { "User-Agent": "SignalTracker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items: FeedItem[] = [];

    if (xml.includes("<feed")) {
      const entries = xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries) {
        const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "";
        const link = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? "";
        const summary = stripHtml(entry.match(/<summary[\s\S]*?>([\s\S]*?)<\/summary>/)?.[1] ?? "");
        const published = entry.match(/<(?:published|updated)>([^<]+)<\/(?:published|updated)>/)?.[1] ?? null;
        if (title && link) {
          items.push({ title: stripHtml(title), url: link, source, content: summary.slice(0, 3000), summary: summary.slice(0, 500), publishedAt: published ? new Date(published) : null });
        }
      }
    } else {
      const rawItems = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const item of rawItems) {
        const title = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "";
        const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? item.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] ?? "";
        const desc = stripHtml(item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? "");
        const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? null;
        if (title && link) {
          items.push({ title: stripHtml(title), url: link.trim(), source, content: desc.slice(0, 3000), summary: desc.slice(0, 500), publishedAt: pubDate ? new Date(pubDate) : null });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ─── Real Theses ─────────────────────────────────────────────────

const ACTIVE_THESES = [
  {
    title: "NVIDIA maintains GPU dominance through 2026",
    description: "NVIDIA's data center GPU revenue continues growing >50% YoY as hyperscalers expand AI infrastructure. Blackwell architecture extends competitive moat over AMD and custom silicon.",
    direction: "bullish",
    domain: "Semiconductors",
    tags: ["NVIDIA", "GPU", "data center", "Blackwell"],
    resolutionCriteria: "NVIDIA data center revenue exceeds $40B/quarter by Q4 2025",
  },
  {
    title: "OpenAI reaches $10B ARR by end of 2025",
    description: "ChatGPT Plus, Enterprise, and API revenue accelerate as enterprise adoption moves from pilot to production. Competition from open-source doesn't materially impact pricing power.",
    direction: "bullish",
    domain: "AI",
    tags: ["OpenAI", "ChatGPT", "Enterprise AI", "SaaS"],
    resolutionCriteria: "OpenAI publicly reports or credibly leaks $10B+ ARR",
  },
  {
    title: "Open-source LLMs close the gap with frontier models",
    description: "Llama, Mistral, and other open-weights models reach >90% of GPT-4 quality on standard benchmarks within 12 months, pressuring API pricing.",
    direction: "bullish",
    domain: "AI",
    tags: ["open-source", "Llama", "Mistral", "benchmarks"],
    resolutionCriteria: "Open-source model scores within 5% of GPT-4 on MMLU/HumanEval",
  },
  {
    title: "AI regulation slows US AI deployment",
    description: "New federal or state AI regulations (beyond executive orders) create compliance burdens that meaningfully slow enterprise AI adoption in the US.",
    direction: "bearish",
    domain: "Policy",
    tags: ["regulation", "AI safety", "compliance", "policy"],
    resolutionCriteria: "Major AI legislation passes with enforceable compute/deployment restrictions",
  },
  {
    title: "Anthropic becomes top-3 AI company by valuation",
    description: "Anthropic's Claude models and safety-focused approach attract enterprise customers, pushing valuation above $100B in 2025.",
    direction: "bullish",
    domain: "AI",
    tags: ["Anthropic", "Claude", "enterprise", "valuation"],
    resolutionCriteria: "Anthropic raises at or is credibly valued above $100B",
  },
  {
    title: "AI agent frameworks replace traditional SaaS workflows",
    description: "Autonomous AI agents (coding, customer service, data analysis) handle >30% of tasks previously done by traditional SaaS tools, disrupting incumbents.",
    direction: "bullish",
    domain: "AI",
    tags: ["agents", "automation", "SaaS disruption", "workflows"],
    resolutionCriteria: "Multiple Fortune 500 companies report >30% task automation via AI agents",
  },
  {
    title: "TSMC capacity constraints limit AI chip supply through 2025",
    description: "Advanced node (3nm, 5nm) capacity at TSMC remains overbooked, creating supply bottlenecks for AI accelerators from NVIDIA, AMD, and custom silicon efforts.",
    direction: "bearish",
    domain: "Semiconductors",
    tags: ["TSMC", "supply chain", "fab capacity", "3nm"],
    resolutionCriteria: "TSMC reports >90% utilization at advanced nodes with 6+ month lead times",
  },
  {
    title: "Enterprise AI spending exceeds $200B globally in 2025",
    description: "Combined enterprise spending on AI infrastructure, software, and services surpasses $200B as every industry accelerates adoption.",
    direction: "bullish",
    domain: "Macro",
    tags: ["enterprise", "spending", "adoption", "infrastructure"],
    resolutionCriteria: "Analyst consensus or credible report confirms >$200B enterprise AI spend in 2025",
  },
];

// ─── Real Entities ───────────────────────────────────────────────

const ENTITIES_DATA = [
  { name: "NVIDIA", type: "company", category: "Semiconductors", description: "Leading GPU manufacturer for AI/ML workloads" },
  { name: "OpenAI", type: "company", category: "AI Lab", description: "Creator of GPT-4, ChatGPT, and DALL-E" },
  { name: "Anthropic", type: "company", category: "AI Lab", description: "AI safety company, creator of Claude" },
  { name: "Google DeepMind", type: "company", category: "AI Lab", description: "Google's AI research division" },
  { name: "Meta AI", type: "company", category: "AI Lab", description: "Meta's AI research, creator of Llama" },
  { name: "Microsoft", type: "company", category: "Big Tech", description: "OpenAI investor, Azure AI cloud" },
  { name: "AMD", type: "company", category: "Semiconductors", description: "GPU competitor to NVIDIA with MI300X" },
  { name: "TSMC", type: "company", category: "Semiconductors", description: "World's largest semiconductor foundry" },
  { name: "Mistral AI", type: "company", category: "AI Lab", description: "French AI startup, open-weight models" },
  { name: "Hugging Face", type: "company", category: "AI Infrastructure", description: "Open-source ML model hub and tools" },
  { name: "GPT-4", type: "product", category: "LLM", description: "OpenAI's frontier language model" },
  { name: "Claude", type: "product", category: "LLM", description: "Anthropic's AI assistant" },
  { name: "Llama 3", type: "product", category: "LLM", description: "Meta's open-weight language model" },
  { name: "Gemini", type: "product", category: "LLM", description: "Google's multimodal AI model" },
  { name: "H100", type: "product", category: "Hardware", description: "NVIDIA's data center GPU for AI training" },
  { name: "Blackwell", type: "product", category: "Hardware", description: "NVIDIA's next-gen GPU architecture" },
  { name: "Transformer", type: "concept", category: "Architecture", description: "Neural network architecture powering modern LLMs" },
  { name: "AI Safety", type: "concept", category: "Policy", description: "Research and policy for safe AI development" },
  { name: "AI Agents", type: "concept", category: "Technology", description: "Autonomous AI systems that perform multi-step tasks" },
  { name: "RAG", type: "concept", category: "Technology", description: "Retrieval-Augmented Generation for grounded LLM outputs" },
];

// ─── Helper: assign sentiment to news based on content ──────────

function classifyNewsForThesis(
  newsTitle: string,
  newsSummary: string,
  thesis: { title: string; direction: string; tags: string[] },
): { relevant: boolean; direction: "bullish" | "bearish" | "neutral"; confidence: number } {
  const text = (newsTitle + " " + newsSummary).toLowerCase();
  const thesisTags = thesis.tags.map((t) => t.toLowerCase());

  // Check relevance
  const tagMatches = thesisTags.filter((tag) => text.includes(tag)).length;
  if (tagMatches === 0) return { relevant: false, direction: "neutral", confidence: 0 };

  // Simple sentiment heuristics
  const bullishWords = ["growth", "surge", "record", "beat", "exceed", "strong", "accelerat", "expand", "launch", "breakthrough", "partner", "invest", "raise", "billion", "triple", "double", "demand", "adopt"];
  const bearishWords = ["decline", "drop", "fall", "concern", "risk", "slow", "delay", "restrict", "ban", "lawsuit", "layoff", "cut", "miss", "weak", "challenge", "struggle", "competition", "threat"];

  const bullishHits = bullishWords.filter((w) => text.includes(w)).length;
  const bearishHits = bearishWords.filter((w) => text.includes(w)).length;

  let direction: "bullish" | "bearish" | "neutral";
  if (bullishHits > bearishHits + 1) direction = "bullish";
  else if (bearishHits > bullishHits + 1) direction = "bearish";
  else if (bullishHits > bearishHits) direction = "bullish";
  else if (bearishHits > bullishHits) direction = "bearish";
  else direction = "neutral";

  const confidence = Math.min(0.9, 0.3 + tagMatches * 0.15 + Math.max(bullishHits, bearishHits) * 0.1);
  return { relevant: true, direction, confidence };
}

function extractEntitiesFromText(text: string): string[] {
  const entityNames = ENTITIES_DATA.map((e) => e.name);
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const name of entityNames) {
    if (lower.includes(name.toLowerCase())) {
      found.push(name);
    }
  }
  return found;
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const workspaceId = process.argv[2] || "test-workspace";
  console.log(`\n=== Seeding Live Data for workspace: ${workspaceId} ===\n`);

  // Ensure workspace exists
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) {
    await db.insert(workspaces).values({
      id: workspaceId,
      name: "Test Workspace",
      plan: "analyst",
      seatLimit: 3,
      thesisLimit: 25,
      pipelineRunsPerDay: 4,
    });
    console.log("Created workspace");
  }

  // ── Step 1: Create active theses ──────────────────────────────
  console.log("--- Step 1: Creating active theses ---");
  const createdTheses: Array<typeof theses.$inferSelect> = [];

  for (const data of ACTIVE_THESES) {
    // Check if already exists
    const [existing] = await db
      .select()
      .from(theses)
      .where(and(eq(theses.workspaceId, workspaceId), eq(theses.title, data.title)));

    if (existing) {
      createdTheses.push(existing);
      console.log(`  [exists] ${data.title}`);
    } else {
      const [t] = await db
        .insert(theses)
        .values({
          workspaceId,
          ...data,
          isActive: true,
          status: "active",
          deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
        })
        .returning();
      createdTheses.push(t);
      console.log(`  [created] ${data.title} (id=${t.id})`);
    }
  }
  console.log(`  Total active theses: ${createdTheses.length}\n`);

  // ── Step 2: Create entities ───────────────────────────────────
  console.log("--- Step 2: Creating entities ---");
  const entityMap = new Map<string, typeof entities.$inferSelect>();

  for (const data of ENTITIES_DATA) {
    const [existing] = await db
      .select()
      .from(entities)
      .where(and(eq(entities.workspaceId, workspaceId), eq(entities.name, data.name)));

    if (existing) {
      entityMap.set(data.name, existing);
    } else {
      const [e] = await db
        .insert(entities)
        .values({ workspaceId, ...data, aliases: [], metadata: {} })
        .returning();
      entityMap.set(data.name, e);
    }
  }
  console.log(`  Entities: ${entityMap.size}\n`);

  // ── Step 3: Entity-thesis connections ─────────────────────────
  console.log("--- Step 3: Linking entities to theses ---");
  const entityThesisLinks: Array<{ entityName: string; thesisIdx: number; relation: string }> = [
    { entityName: "NVIDIA", thesisIdx: 0, relation: "SUBJECT_OF" },
    { entityName: "H100", thesisIdx: 0, relation: "RELEVANT_TO" },
    { entityName: "Blackwell", thesisIdx: 0, relation: "RELEVANT_TO" },
    { entityName: "AMD", thesisIdx: 0, relation: "COMPETES_WITH" },
    { entityName: "OpenAI", thesisIdx: 1, relation: "SUBJECT_OF" },
    { entityName: "GPT-4", thesisIdx: 1, relation: "RELEVANT_TO" },
    { entityName: "Microsoft", thesisIdx: 1, relation: "INVESTED_IN" },
    { entityName: "Llama 3", thesisIdx: 2, relation: "SUBJECT_OF" },
    { entityName: "Mistral AI", thesisIdx: 2, relation: "RELEVANT_TO" },
    { entityName: "Hugging Face", thesisIdx: 2, relation: "RELEVANT_TO" },
    { entityName: "AI Safety", thesisIdx: 3, relation: "SUBJECT_OF" },
    { entityName: "Anthropic", thesisIdx: 4, relation: "SUBJECT_OF" },
    { entityName: "Claude", thesisIdx: 4, relation: "RELEVANT_TO" },
    { entityName: "AI Agents", thesisIdx: 5, relation: "SUBJECT_OF" },
    { entityName: "TSMC", thesisIdx: 6, relation: "SUBJECT_OF" },
    { entityName: "NVIDIA", thesisIdx: 6, relation: "DEPENDS_ON" },
    { entityName: "Transformer", thesisIdx: 7, relation: "RELEVANT_TO" },
    { entityName: "Google DeepMind", thesisIdx: 7, relation: "RELEVANT_TO" },
  ];

  let linkCount = 0;
  for (const link of entityThesisLinks) {
    const entity = entityMap.get(link.entityName);
    const thesis = createdTheses[link.thesisIdx];
    if (!entity || !thesis) continue;

    await db.insert(connections).values({
      workspaceId,
      fromType: "entity",
      fromId: entity.id,
      toType: "thesis",
      toId: thesis.id,
      relation: link.relation,
      direction: thesis.direction as string,
      confidence: 0.8,
      weight: 1.2,
      reasoning: `${entity.name} is ${link.relation} thesis: ${thesis.title}`,
    });
    linkCount++;
  }
  console.log(`  Created ${linkCount} entity-thesis connections\n`);

  // ── Step 4: Fetch real RSS news ───────────────────────────────
  console.log("--- Step 4: Fetching live RSS news ---");
  let totalInserted = 0;
  const allNewsItems: FeedItem[] = [];

  for (const feed of AI_RSS_FEEDS) {
    process.stdout.write(`  Fetching ${feed.source}...`);
    const items = await fetchFeed(feed.url, feed.source);
    const relevant = items.filter((i) => isAiRelevant(i.title, i.summary));
    console.log(` ${relevant.length}/${items.length} relevant`);

    for (const item of relevant) {
      // Deduplicate
      const [existing] = await db
        .select({ id: newsEvents.id })
        .from(newsEvents)
        .where(and(eq(newsEvents.workspaceId, workspaceId), eq(newsEvents.url, item.url)))
        .limit(1);

      if (!existing) {
        const [inserted] = await db
          .insert(newsEvents)
          .values({
            workspaceId,
            title: item.title,
            url: item.url,
            source: item.source,
            content: item.content,
            summary: item.summary,
            publishedAt: item.publishedAt ?? new Date(),
            processed: true, // We'll process them inline
            sentiment: null,
            aiRelevance: null,
          })
          .returning();

        allNewsItems.push(item);
        totalInserted++;

        // Extract entities from this news item
        const mentionedEntities = extractEntitiesFromText(item.title + " " + item.summary);
        for (const entityName of mentionedEntities) {
          const entity = entityMap.get(entityName);
          if (!entity) continue;

          await db.insert(connections).values({
            workspaceId,
            fromType: "news_event",
            fromId: inserted.id,
            toType: "entity",
            toId: entity.id,
            relation: "MENTIONS",
            confidence: 0.7,
            weight: 1.0,
          });
        }

        // Connect news to relevant theses
        for (let ti = 0; ti < createdTheses.length; ti++) {
          const thesis = createdTheses[ti];
          const thesisData = ACTIVE_THESES[ti];
          const classification = classifyNewsForThesis(item.title, item.summary, thesisData);

          if (classification.relevant) {
            // Determine sentiment relative to thesis
            let sentimentStr: string;
            if (classification.direction === thesis.direction) sentimentStr = "bullish";
            else if (classification.direction === "neutral") sentimentStr = "neutral";
            else sentimentStr = "bearish";

            // Give more weight to recent news
            const ageHours = item.publishedAt
              ? (Date.now() - item.publishedAt.getTime()) / (1000 * 60 * 60)
              : 48;
            const recencyBoost = Math.max(0.5, 1.0 - ageHours / 168); // decay over 1 week

            await db.insert(connections).values({
              workspaceId,
              fromType: "news_event",
              fromId: inserted.id,
              toType: "thesis",
              toId: thesis.id,
              relation: "SUPPORTS",
              direction: sentimentStr,
              confidence: classification.confidence * recencyBoost,
              weight: 1.0 + recencyBoost * 0.5,
              reasoning: `${item.source}: ${item.title.slice(0, 100)}`,
              sourceNewsId: inserted.id,
            });
          }
        }
      }
    }
  }
  console.log(`  Total news inserted: ${totalInserted}\n`);

  // ── Step 5: Entity observations ───────────────────────────────
  console.log("--- Step 5: Creating entity observations ---");
  const observations = [
    { entity: "NVIDIA", attribute: "market_cap", value: "$3.2T", numericValue: 3200, confidence: 0.95 },
    { entity: "NVIDIA", attribute: "data_center_revenue_trend", value: "Growing >100% YoY", numericValue: 100, confidence: 0.9 },
    { entity: "NVIDIA", attribute: "gpu_market_share", value: "~90% AI training", numericValue: 90, confidence: 0.85 },
    { entity: "OpenAI", attribute: "estimated_arr", value: "$5B+ ARR", numericValue: 5000, confidence: 0.7 },
    { entity: "OpenAI", attribute: "valuation", value: "$157B", numericValue: 157, confidence: 0.85 },
    { entity: "OpenAI", attribute: "enterprise_customers", value: "92% of Fortune 500", numericValue: 92, confidence: 0.8 },
    { entity: "Anthropic", attribute: "valuation", value: "$60B+", numericValue: 60, confidence: 0.8 },
    { entity: "Anthropic", attribute: "arr_growth", value: ">3x YoY", numericValue: 300, confidence: 0.7 },
    { entity: "TSMC", attribute: "advanced_node_utilization", value: ">95%", numericValue: 95, confidence: 0.85 },
    { entity: "TSMC", attribute: "ai_chip_revenue_share", value: "~15% of total", numericValue: 15, confidence: 0.75 },
    { entity: "AMD", attribute: "mi300x_revenue", value: "$3.5B projected 2024", numericValue: 3.5, confidence: 0.7 },
    { entity: "Microsoft", attribute: "azure_ai_growth", value: ">50% YoY", numericValue: 50, confidence: 0.8 },
    { entity: "Meta AI", attribute: "llama_downloads", value: ">350M", numericValue: 350, confidence: 0.75 },
  ];

  for (const obs of observations) {
    const entity = entityMap.get(obs.entity);
    if (!entity) continue;
    await db.insert(entityObservations).values({
      workspaceId,
      entityId: entity.id,
      attribute: obs.attribute,
      value: obs.value,
      numericValue: obs.numericValue,
      confidence: obs.confidence,
      observedAt: new Date(),
    });
  }
  console.log(`  Created ${observations.length} observations\n`);

  // ── Step 6: Compute probability snapshots ─────────────────────
  console.log("--- Step 6: Computing probability snapshots ---");

  for (const thesis of createdTheses) {
    // Get all connections to this thesis
    const conns = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.workspaceId, workspaceId),
          eq(connections.toType, "thesis"),
          eq(connections.toId, thesis.id),
        ),
      );

    let bullish = 0, bearish = 0, neutral = 0;
    const newsIdSet = new Set<number>();

    for (const conn of conns) {
      const rawWeight = (conn.adjustedWeight ?? conn.weight) * conn.confidence;
      const score = rawWeight;

      if (conn.direction === "bullish") bullish += score;
      else if (conn.direction === "bearish") bearish += score;
      else neutral += score;

      if (conn.sourceNewsId) newsIdSet.add(conn.sourceNewsId);
    }

    const EVIDENCE_SCALE = 0.15;
    const netEvidence = (bullish - bearish + neutral * 0.25) * EVIDENCE_SCALE;
    const probability = Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-netEvidence))));

    // Create a few historical snapshots (simulate daily snapshots)
    for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
      const jitter = (Math.random() - 0.5) * 0.08;
      const historicalProb = Math.max(0.05, Math.min(0.95, probability + jitter * (daysAgo / 14)));
      const prevProb = daysAgo === 14 ? 0.5 : historicalProb;
      const momentum = historicalProb - prevProb;

      await db.insert(thesisProbabilitySnapshots).values({
        workspaceId,
        thesisId: thesis.id,
        probability: historicalProb,
        bullishWeight: bullish * (1 - daysAgo * 0.03),
        bearishWeight: bearish * (1 - daysAgo * 0.03),
        neutralWeight: neutral * (1 - daysAgo * 0.03),
        signalCount: Math.max(1, conns.length - daysAgo),
        momentum,
        topNewsIds: [...newsIdSet].slice(0, 5),
        computedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      });
    }

    console.log(
      `  ${thesis.title.slice(0, 50).padEnd(52)} → prob=${probability.toFixed(3)}, signals=${conns.length}`,
    );
  }
  console.log("");

  // ── Step 7: Create recommendations ────────────────────────────
  console.log("--- Step 7: Creating recommendations ---");

  const recsData = [
    {
      thesisIdx: 0,
      action: "BUY",
      asset: "NVIDIA Corporation",
      ticker: "NVDA",
      conviction: 0.82,
      timeframeDays: 90,
      rationale: "Data center GPU demand accelerating with Blackwell ramp. Strong signals from hyperscaler CapEx announcements. Price target supported by >50% revenue growth.",
    },
    {
      thesisIdx: 1,
      action: "WATCH",
      asset: "Microsoft Corporation",
      ticker: "MSFT",
      conviction: 0.65,
      timeframeDays: 120,
      rationale: "OpenAI partnership gives Azure unique AI positioning, but valuation fully reflects AI upside. Wait for pullback or clearer ARR acceleration data.",
    },
    {
      thesisIdx: 2,
      action: "BUY",
      asset: "Hugging Face (Private)",
      ticker: null,
      conviction: 0.7,
      timeframeDays: 180,
      rationale: "Open-source momentum accelerating. Llama 3 and Mistral closing gap with proprietary models. HF positioned as the GitHub of ML — network effects compounding.",
    },
    {
      thesisIdx: 4,
      action: "WATCH",
      asset: "Anthropic (Private)",
      ticker: null,
      conviction: 0.75,
      timeframeDays: 90,
      rationale: "Claude 4 models gaining enterprise traction. Safety-first positioning differentiates in regulated industries. Watch for next funding round as valuation signal.",
    },
    {
      thesisIdx: 6,
      action: "HOLD",
      asset: "Taiwan Semiconductor",
      ticker: "TSM",
      conviction: 0.6,
      timeframeDays: 60,
      rationale: "Capacity constraints bullish for pricing power but geopolitical risk remains. TSMC benefits from AI demand but valuations reflect most upside.",
    },
    {
      thesisIdx: 0,
      action: "AVOID",
      asset: "Advanced Micro Devices",
      ticker: "AMD",
      conviction: 0.55,
      timeframeDays: 90,
      rationale: "MI300X gaining share but NVIDIA's CUDA ecosystem moat too deep. AMD GPU revenue growth priced in; NVIDIA likely keeps >80% AI training market.",
    },
    {
      thesisIdx: 7,
      action: "BUY",
      asset: "Global X AI & Technology ETF",
      ticker: "AIQ",
      conviction: 0.72,
      timeframeDays: 120,
      rationale: "Broad exposure to enterprise AI spending thesis. Diversified across infrastructure, software, and application layers. Lower single-stock risk than pure plays.",
    },
  ];

  for (const rec of recsData) {
    const thesis = createdTheses[rec.thesisIdx];
    if (!thesis) continue;

    // Get latest probability for this thesis
    const [latestProb] = await db
      .select({ probability: thesisProbabilitySnapshots.probability })
      .from(thesisProbabilitySnapshots)
      .where(
        and(
          eq(thesisProbabilitySnapshots.workspaceId, workspaceId),
          eq(thesisProbabilitySnapshots.thesisId, thesis.id),
        ),
      )
      .orderBy(desc(thesisProbabilitySnapshots.computedAt))
      .limit(1);

    // Try to get real price via a simple fetch
    let priceAtCreation: number | null = null;
    if (rec.ticker) {
      try {
        const resp = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${rec.ticker}?interval=1d&range=1d`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (resp.ok) {
          const data = await resp.json();
          priceAtCreation = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
        }
      } catch {
        // price fetch failed, that's ok
      }
    }

    await db.insert(recommendations).values({
      workspaceId,
      thesisId: thesis.id,
      action: rec.action,
      asset: rec.asset,
      conviction: rec.conviction,
      timeframeDays: rec.timeframeDays,
      deadline: new Date(Date.now() + rec.timeframeDays * 24 * 60 * 60 * 1000),
      rationale: rec.rationale,
      status: "active",
      probabilityAtCreation: latestProb?.probability ?? 0.5,
      ticker: rec.ticker,
      priceAtCreation,
    });

    console.log(
      `  ${rec.action.padEnd(6)} ${rec.asset.padEnd(30)} conviction=${rec.conviction} ${priceAtCreation ? `price=$${priceAtCreation.toFixed(2)}` : "(no price)"}`,
    );

    // Also store price snapshot if we got it
    if (rec.ticker && priceAtCreation) {
      await db.insert(priceSnapshots).values({
        workspaceId,
        ticker: rec.ticker,
        price: priceAtCreation,
        capturedAt: new Date(),
      });
    }
  }
  console.log("");

  // ── Step 8: Create signal clusters ────────────────────────────
  console.log("--- Step 8: Detecting signal clusters ---");

  const clusters = [
    {
      title: "AI Infrastructure Buildout Accelerating",
      description: "Multiple signals confirm hyperscaler CapEx expansion for AI. NVIDIA GPU demand, TSMC capacity constraints, and cloud provider announcements converge.",
      pattern: "Convergent bullish signals across semiconductor and cloud infrastructure",
      confidence: 0.85,
      thesisIdxs: [0, 6, 7],
      entityNames: ["NVIDIA", "TSMC", "Microsoft", "H100", "Blackwell"],
    },
    {
      title: "Open-Source AI Momentum",
      description: "Llama, Mistral, and community models showing rapid improvement. Download counts and benchmark scores trending upward. Enterprise adoption of open-weight models growing.",
      pattern: "Accelerating open-source model quality and adoption",
      confidence: 0.75,
      thesisIdxs: [2, 1],
      entityNames: ["Meta AI", "Llama 3", "Mistral AI", "Hugging Face"],
    },
    {
      title: "Enterprise AI Spending Surge",
      description: "Fortune 500 AI budgets expanding. SaaS companies reporting AI-driven revenue uplift. Consulting firms reporting surge in AI transformation engagements.",
      pattern: "Cross-sector enterprise AI spending acceleration",
      confidence: 0.8,
      thesisIdxs: [1, 7, 5],
      entityNames: ["OpenAI", "Microsoft", "Anthropic"],
    },
  ];

  for (const cluster of clusters) {
    const thesisIds = cluster.thesisIdxs
      .map((i) => createdTheses[i]?.id)
      .filter((id): id is number => id !== undefined);
    const entityIds = cluster.entityNames
      .map((n) => entityMap.get(n)?.id)
      .filter((id): id is number => id !== undefined);

    await db.insert(signalClusters).values({
      workspaceId,
      title: cluster.title,
      description: cluster.description,
      pattern: cluster.pattern,
      confidence: cluster.confidence,
      status: "active",
      thesisIds,
      entityIds,
      connectionIds: [],
      metadata: {},
    });
    console.log(`  [cluster] ${cluster.title}`);
  }
  console.log("");

  // ── Summary ───────────────────────────────────────────────────
  const counts = {
    theses: (await db.select({ c: sql<number>`count(*)::int` }).from(theses).where(and(eq(theses.workspaceId, workspaceId), eq(theses.isActive, true))))[0].c,
    news: (await db.select({ c: sql<number>`count(*)::int` }).from(newsEvents).where(eq(newsEvents.workspaceId, workspaceId)))[0].c,
    entities: (await db.select({ c: sql<number>`count(*)::int` }).from(entities).where(eq(entities.workspaceId, workspaceId)))[0].c,
    connections: (await db.select({ c: sql<number>`count(*)::int` }).from(connections).where(eq(connections.workspaceId, workspaceId)))[0].c,
    snapshots: (await db.select({ c: sql<number>`count(*)::int` }).from(thesisProbabilitySnapshots).where(eq(thesisProbabilitySnapshots.workspaceId, workspaceId)))[0].c,
    recommendations: (await db.select({ c: sql<number>`count(*)::int` }).from(recommendations).where(eq(recommendations.workspaceId, workspaceId)))[0].c,
    clusters: (await db.select({ c: sql<number>`count(*)::int` }).from(signalClusters).where(eq(signalClusters.workspaceId, workspaceId)))[0].c,
    backtestRuns: (await db.select({ c: sql<number>`count(*)::int` }).from(backtestRuns).where(eq(backtestRuns.workspaceId, workspaceId)))[0].c,
  };

  console.log("=== Data Summary ===");
  console.log(`  Active Theses:        ${counts.theses}`);
  console.log(`  News Events:          ${counts.news}`);
  console.log(`  Entities:             ${counts.entities}`);
  console.log(`  Connections:          ${counts.connections}`);
  console.log(`  Probability Snapshots: ${counts.snapshots}`);
  console.log(`  Recommendations:      ${counts.recommendations}`);
  console.log(`  Signal Clusters:      ${counts.clusters}`);
  console.log(`  Backtest Runs:        ${counts.backtestRuns}`);
  console.log(`\nDone! Refresh the app to see the data.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
