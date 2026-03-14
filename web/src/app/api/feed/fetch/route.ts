import { NextResponse } from "next/server";
import { insertNewsEvent } from "@/lib/db/graph-queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AI_RSS_FEEDS = [
  // General AI / Tech
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch AI" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat AI" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge AI" },
  { url: "https://arstechnica.com/ai/feed/", source: "Ars Technica AI" },
  { url: "https://www.wired.com/feed/tag/ai/latest/rss", source: "WIRED AI" },
  // Research
  { url: "https://blog.research.google/atom.xml", source: "Google Research" },
  { url: "https://openai.com/blog/rss/", source: "OpenAI Blog" },
  { url: "https://www.anthropic.com/rss.xml", source: "Anthropic Blog" },
  { url: "https://ai.meta.com/blog/rss/", source: "Meta AI" },
  { url: "https://machinelearning.apple.com/rss.xml", source: "Apple ML" },
  // Research aggregators
  { url: "https://arxiv.org/rss/cs.AI", source: "arXiv cs.AI" },
  { url: "https://arxiv.org/rss/cs.LG", source: "arXiv cs.LG" },
  // Finance / VC
  { url: "https://a16z.com/feed/", source: "a16z" },
  { url: "https://www.sequoiacap.com/feed/", source: "Sequoia" },
  { url: "https://www.bloomberg.com/feeds/technology.rss", source: "Bloomberg Tech" },
  // Semiconductor / Compute
  { url: "https://www.anandtech.com/rss/", source: "AnandTech" },
  { url: "https://www.tomshardware.com/feeds/all", source: "Tom's Hardware" },
  // Hacker News best-of (unofficial)
  { url: "https://hnrss.org/frontpage?q=AI+OR+LLM+OR+GPT+OR+model&count=20", source: "HN AI" },
  { url: "https://hnrss.org/frontpage?q=NVIDIA+OR+OpenAI+OR+Anthropic+OR+investment&count=10", source: "HN Invest" },
];

const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "gpt", "claude",
  "gemini", "openai", "anthropic", "deepmind", "nvidia", "gpu", "inference",
  "model", "transformer", "foundation model", "agi", "generative", "chatgpt",
  "copilot", "agent", "rag", "fine-tun", "training", "compute", "data center",
  "accelerat", "semiconductor", "chip", "mlops", "vector", "embedding",
  // Expanded: companies and products
  "mistral", "meta ai", "llama", "stable diffusion", "midjourney", "hugging face",
  "cohere", "databricks", "snowflake ai", "microsoft ai", "google ai",
  // Expanded: market and regulatory
  "ai regulation", "ai safety", "ai governance", "ai act", "executive order",
  "compute cluster", "tpu", "h100", "b200", "blackwell", "ai chip",
  // Expanded: investment signals
  "funding round", "series a", "series b", "ipo", "acquisition", "valuation",
  "revenue", "arpu", "market cap",
];

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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

    // Atom feed
    if (xml.includes("<feed")) {
      const entries = xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
      for (const entry of entries) {
        const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? "";
        const link = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? "";
        const summary = stripHtml(entry.match(/<summary[\s\S]*?>([\s\S]*?)<\/summary>/)?.[1] ?? "");
        const published = entry.match(/<(?:published|updated)>([^<]+)<\/(?:published|updated)>/)?.[1] ?? null;
        if (title && link) {
          items.push({ title: stripHtml(title), url: link, source, content: summary.slice(0, 3000), summary: summary.slice(0, 500), publishedAt: parseDate(published) });
        }
      }
    } else {
      // RSS 2.0
      const rawItems = xml.match(/<item[\s\S]*?<\/item>/g) || [];
      for (const item of rawItems) {
        const title = item.match(/<title>(?:<\!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "";
        const link = item.match(/<link>([^<]+)<\/link>/)?.[1] ?? item.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1] ?? "";
        const desc = stripHtml(item.match(/<description>(?:<\!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? "");
        const pubDate = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? null;
        if (title && link) {
          items.push({ title: stripHtml(title), url: link.trim(), source, content: desc.slice(0, 3000), summary: desc.slice(0, 500), publishedAt: parseDate(pubDate) });
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** POST /api/feed/fetch - Fetch RSS feeds and store new AI-relevant news events */
export async function POST() {
  const seenUrls = new Set<string>();
  let inserted = 0;
  let skipped = 0;
  let total = 0;

  for (const feed of AI_RSS_FEEDS) {
    const items = await fetchFeed(feed.url, feed.source);
    for (const item of items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      if (!isAiRelevant(item.title, item.summary)) continue;
      total++;
      try {
        const result = await insertNewsEvent({
          title: item.title,
          url: item.url,
          source: item.source,
          content: item.content,
          summary: item.summary,
          publishedAt: item.publishedAt ?? new Date(),
        });
        if (result) inserted++;
        else skipped++;
      } catch {
        skipped++;
      }
    }
  }

  return NextResponse.json({ total, inserted, skipped });
}

/** GET /api/feed/fetch - Check feeds without storing */
export async function GET() {
  return NextResponse.json({ message: "POST to this endpoint to fetch and store RSS feeds" });
}
