"""
News ingestion pipeline for AI-related news.
Fetches from RSS feeds, HN, and other sources, then stores in the DB.
Run: python -m signal_tracker.news_ingester
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import xml.etree.ElementTree as ET

import httpx

logger = logging.getLogger(__name__)

# ── RSS Feed sources ───────────────────────────────────────────────────────

AI_RSS_FEEDS = [
    # General AI / Tech
    {"url": "https://techcrunch.com/category/artificial-intelligence/feed/", "source": "TechCrunch AI"},
    {"url": "https://venturebeat.com/category/ai/feed/", "source": "VentureBeat AI"},
    {"url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", "source": "The Verge AI"},
    {"url": "https://arstechnica.com/ai/feed/", "source": "Ars Technica AI"},
    {"url": "https://www.wired.com/feed/tag/ai/latest/rss", "source": "WIRED AI"},
    # Research
    {"url": "https://blog.research.google/atom.xml", "source": "Google Research"},
    {"url": "https://openai.com/blog/rss/", "source": "OpenAI Blog"},
    {"url": "https://www.anthropic.com/rss.xml", "source": "Anthropic Blog"},
    {"url": "https://ai.meta.com/blog/rss/", "source": "Meta AI"},
    {"url": "https://machinelearning.apple.com/rss.xml", "source": "Apple ML"},
    # Research aggregators
    {"url": "https://arxiv.org/rss/cs.AI", "source": "arXiv cs.AI"},
    {"url": "https://arxiv.org/rss/cs.LG", "source": "arXiv cs.LG"},
    # Finance / VC
    {"url": "https://a16z.com/feed/", "source": "a16z"},
    {"url": "https://www.sequoiacap.com/feed/", "source": "Sequoia"},
    {"url": "https://www.bloomberg.com/feeds/technology.rss", "source": "Bloomberg Tech"},
    # Semiconductor / Compute
    {"url": "https://www.anandtech.com/rss/", "source": "AnandTech"},
    {"url": "https://www.tomshardware.com/feeds/all", "source": "Tom's Hardware"},
    # Hacker News best-of (unofficial)
    {"url": "https://hnrss.org/frontpage?q=AI+OR+LLM+OR+GPT+OR+model&count=20", "source": "HN AI"},
    {"url": "https://hnrss.org/frontpage?q=NVIDIA+OR+OpenAI+OR+Anthropic+OR+investment&count=10", "source": "HN Invest"},
]


@dataclass
class NewsItem:
    title: str
    url: str
    source: str
    content: str = ""
    summary: str = ""
    published_at: Optional[datetime] = None

    @property
    def id(self) -> str:
        """Stable ID based on URL."""
        return hashlib.sha256(self.url.encode()).hexdigest()[:16]


def fetch_rss(feed_url: str, source: str, timeout: int = 10) -> list[NewsItem]:
    """Fetch and parse an RSS/Atom feed."""
    try:
        resp = httpx.get(feed_url, timeout=timeout, follow_redirects=True, headers={
            "User-Agent": "SignalTracker/1.0 (news aggregator)"
        })
        resp.raise_for_status()
    except Exception as e:
        logger.warning("Failed to fetch %s: %s", feed_url, e)
        return []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        logger.warning("Failed to parse XML from %s: %s", feed_url, e)
        return []

    items = []
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    # Detect RSS vs Atom
    is_atom = root.tag == "{http://www.w3.org/2005/Atom}feed"

    if is_atom:
        entries = root.findall("atom:entry", ns)
        for entry in entries:
            title_el = entry.find("atom:title", ns)
            link_el = entry.find("atom:link", ns)
            summary_el = entry.find("atom:summary", ns)
            content_el = entry.find("{http://www.w3.org/2005/Atom}content", ns)
            published_el = entry.find("atom:published", ns) or entry.find("atom:updated", ns)

            title = title_el.text if title_el is not None else ""
            url = link_el.get("href", "") if link_el is not None else ""
            summary = _strip_html(summary_el.text or "") if summary_el is not None else ""
            content = _strip_html(content_el.text or "") if content_el is not None else summary
            published = _parse_date(published_el.text) if published_el is not None else None

            if title and url:
                items.append(NewsItem(
                    title=title, url=url, source=source,
                    content=content[:3000], summary=summary[:500],
                    published_at=published,
                ))
    else:
        # RSS 2.0
        channel = root.find("channel") or root
        for item in channel.findall("item"):
            title_el = item.find("title")
            link_el = item.find("link")
            desc_el = item.find("description")
            content_el = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
            pubdate_el = item.find("pubDate")

            title = title_el.text if title_el is not None else ""
            url = link_el.text if link_el is not None else ""
            summary = _strip_html(desc_el.text or "") if desc_el is not None else ""
            content = _strip_html(content_el.text or "") if content_el is not None else summary
            published = _parse_date(pubdate_el.text) if pubdate_el is not None else None

            if title and url:
                items.append(NewsItem(
                    title=title, url=url, source=source,
                    content=content[:3000], summary=summary[:500],
                    published_at=published,
                ))

    return items


def _strip_html(text: str) -> str:
    """Remove HTML tags from text."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Try to parse various date formats."""
    if not date_str:
        return None
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def is_ai_relevant(item: NewsItem) -> bool:
    """Quick heuristic filter before LLM processing."""
    ai_keywords = [
        "ai", "artificial intelligence", "machine learning", "llm", "gpt",
        "claude", "gemini", "openai", "anthropic", "deepmind", "nvidia",
        "gpu", "inference", "model", "transformer", "foundation model",
        "agi", "generative", "chatgpt", "copilot", "agent", "rag",
        "fine-tun", "training", "compute", "data center", "accelerat",
        "semiconductor", "chip", "mlops", "vector", "embedding",
        # Companies and products
        "mistral", "meta ai", "llama", "stable diffusion", "midjourney",
        "hugging face", "cohere", "databricks", "snowflake ai",
        "microsoft ai", "google ai",
        # Market and regulatory
        "ai regulation", "ai safety", "ai governance", "ai act",
        "executive order", "compute cluster", "tpu", "h100", "b200",
        "blackwell", "ai chip",
        # Investment signals
        "funding round", "series a", "series b", "ipo", "acquisition",
        "valuation", "revenue", "arpu", "market cap",
    ]
    text = (item.title + " " + item.summary).lower()
    return any(kw in text for kw in ai_keywords)


def ingest_all_feeds(db_url: Optional[str] = None) -> dict:
    """
    Main ingestion function. Fetches all RSS feeds and stores new items.

    When db_url is provided, writes directly to Neon via psycopg2.
    Otherwise returns items for the caller to process.
    """
    all_items = []
    seen_urls: set[str] = set()

    logger.info("Fetching %d RSS feeds...", len(AI_RSS_FEEDS))
    for feed in AI_RSS_FEEDS:
        logger.info("  Fetching %s...", feed["source"])
        items = fetch_rss(feed["url"], feed["source"])
        for item in items:
            if item.url not in seen_urls and is_ai_relevant(item):
                seen_urls.add(item.url)
                all_items.append(item)
        time.sleep(0.5)  # polite delay

    logger.info("Found %d AI-relevant items after dedup.", len(all_items))

    if db_url:
        return _write_to_db(all_items, db_url)

    return {"items": [vars(i) for i in all_items], "count": len(all_items)}


def _write_to_db(items: list[NewsItem], db_url: str) -> dict:
    """Write items to Neon PostgreSQL using psycopg2."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        return {"error": "psycopg2 not available"}

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    inserted = 0
    skipped = 0

    for item in items:
        try:
            cur.execute(
                """
                INSERT INTO news_events (title, url, source, content, summary, published_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (url) DO NOTHING
                RETURNING id
                """,
                (
                    item.title,
                    item.url,
                    item.source,
                    item.content,
                    item.summary,
                    item.published_at,
                )
            )
            row = cur.fetchone()
            if row:
                inserted += 1
            else:
                skipped += 1
        except Exception as e:
            logger.warning("Failed to insert %s: %s", item.url, e)
            conn.rollback()
            continue

    conn.commit()
    cur.close()
    conn.close()

    logger.info("Inserted %d new items, skipped %d duplicates.", inserted, skipped)
    return {"inserted": inserted, "skipped": skipped}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set")
        exit(1)
    result = ingest_all_feeds(db_url)
    print(json.dumps(result, indent=2, default=str))
