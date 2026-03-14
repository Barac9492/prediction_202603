"""
LLM-based graph extraction: processes raw news items and extracts
structured entity/thesis connections for the knowledge graph.

This is the Python-side equivalent of /api/feed/ingest/route.ts but
runs as a CLI batch job with access to the full DB.

Usage:
    python -m signal_tracker.graph_extractor --limit 20
    python -m signal_tracker.graph_extractor --backfill  # process all unprocessed
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from dataclasses import dataclass
from typing import Optional

import anthropic
import click

from signal_tracker.extractor import _strip_code_fences

logger = logging.getLogger(__name__)

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-6-20250415")

GRAPH_EXTRACTION_PROMPT = """\
You are an expert investment analyst specializing in AI and technology sectors.

Analyze this news article and extract structured intelligence for an investment knowledge graph.

<article_title>{title}</article_title>
<article_content>{content}</article_content>

<active_theses>
{theses}
</active_theses>

Extract the following:

1. **AI Relevance** (1-5): How relevant is this to AI investment?
2. **Sentiment**: "bullish", "bearish", or "neutral" for AI/tech investment
3. **Entities**: Specific companies, models, technologies, people mentioned. Use exact canonical names.
4. **Thesis Connections**: For each active thesis above, evaluate this article.
5. **Key Insight**: 1-2 sentence investment implication.

Respond ONLY with valid JSON:
{{
  "ai_relevance": 1-5,
  "sentiment": "bullish|bearish|neutral",
  "entities": ["OpenAI", "NVIDIA", "GPT-4"],
  "thesis_connections": [
    {{
      "thesis_id": 1,
      "relation": "SUPPORTS|CONTRADICTS|UNRELATED",
      "direction": "bullish|bearish|neutral",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation"
    }}
  ],
  "key_insight": "Single sentence investment takeaway"
}}
"""


@dataclass
class ExtractionResult:
    ai_relevance: int
    sentiment: str
    entities: list[str]
    thesis_connections: list[dict]
    key_insight: str


def extract_graph_intelligence(
    title: str,
    content: str,
    theses: list[dict],
    client: anthropic.Anthropic,
) -> ExtractionResult:
    """Call Claude to extract structured graph intelligence from a news item."""
    theses_text = "\n".join(
        f"ID {t['id']}: [{t['direction'].upper()}] {t['title']} - {t['description']}"
        for t in theses
    ) or "No active theses configured yet."

    prompt = GRAPH_EXTRACTION_PROMPT.format(
        title=title,
        content=content[:4000],
        theses=theses_text,
    )

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    raw = _strip_code_fences(raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse Claude response as JSON: {e}\nRaw: {raw[:500]}")
    return ExtractionResult(
        ai_relevance=int(data.get("ai_relevance", 1)),
        sentiment=data.get("sentiment", "neutral"),
        entities=data.get("entities", []),
        thesis_connections=data.get("thesis_connections", []),
        key_insight=data.get("key_insight", ""),
    )


def process_batch(db_url: str, limit: int = 20, dry_run: bool = False) -> dict:
    """Process a batch of unprocessed news events from the DB."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        logger.error("psycopg2 not installed: pip install psycopg2-binary")
        return {"error": "psycopg2 not available"}

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.error("ANTHROPIC_API_KEY not set")
        return {"error": "ANTHROPIC_API_KEY not set"}

    client = anthropic.Anthropic(api_key=api_key)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Fetch unprocessed events
    cur.execute(
        """
        SELECT id, title, url, source, content, summary
        FROM news_events
        WHERE processed = false
        ORDER BY ingested_at ASC
        LIMIT %s
        """,
        (limit,)
    )
    events = cur.fetchall()

    if not events:
        logger.info("No unprocessed events found.")
        conn.close()
        return {"processed": 0}

    # Fetch active theses
    cur.execute(
        "SELECT id, title, description, direction FROM theses WHERE is_active = true"
    )
    theses = [dict(row) for row in cur.fetchall()]
    logger.info("Processing %d events against %d active theses...", len(events), len(theses))

    processed = 0
    errors = 0
    total_connections = 0

    for event in events:
        event_id = event["id"]
        title = event["title"]
        content = event["content"] or event["summary"] or title
        logger.info("  [%s] %s...", event_id, title[:60])

        try:
            result = extract_graph_intelligence(title, content, theses, client)
            logger.info("    AI Relevance: %d/5 | Sentiment: %s", result.ai_relevance, result.sentiment)
            logger.info("    Entities: %s", ", ".join(result.entities[:5]))

            if not dry_run:
                # Update news event
                cur.execute(
                    """
                    UPDATE news_events
                    SET processed = true,
                        ai_relevance = %s,
                        sentiment = %s,
                        extracted_entities = %s,
                        extracted_thesis_ids = %s
                    WHERE id = %s
                    """,
                    (
                        result.ai_relevance,
                        result.sentiment,
                        json.dumps(result.entities),
                        json.dumps([
                            tc["thesis_id"] for tc in result.thesis_connections
                            if tc.get("relation") != "UNRELATED"
                        ]),
                        event_id,
                    )
                )

                # Upsert entities
                for entity_name in result.entities:
                    cur.execute(
                        """
                        INSERT INTO entities (name, type)
                        VALUES (%s, 'unknown')
                        ON CONFLICT (name) DO NOTHING
                        """,
                        (entity_name,)
                    )

                # Create graph connections
                for tc in result.thesis_connections:
                    if tc.get("relation") == "UNRELATED":
                        continue
                    cur.execute(
                        """
                        INSERT INTO connections
                        (from_type, from_id, to_type, to_id, relation,
                         direction, confidence, reasoning, source_news_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            "news_event",
                            event_id,
                            "thesis",
                            tc["thesis_id"],
                            tc["relation"],
                            tc.get("direction", "neutral"),
                            tc.get("confidence", 0.5),
                            tc.get("reasoning", ""),
                            event_id,
                        )
                    )
                    total_connections += 1
                    logger.info(
                        "    -> %s Thesis #%s (confidence: %.2f)",
                        tc["relation"], tc["thesis_id"], tc.get("confidence", 0.5),
                    )

                conn.commit()
                processed += 1

        except Exception as e:
            logger.error("    [ERROR] %s", e)
            conn.rollback()
            errors += 1
            # Mark as processed to avoid infinite loop
            if not dry_run:
                cur.execute(
                    "UPDATE news_events SET processed = true WHERE id = %s",
                    (event_id,)
                )
                conn.commit()

        time.sleep(0.5)  # Rate limiting

    cur.close()
    conn.close()

    summary = {
        "processed": processed,
        "errors": errors,
        "connections_created": total_connections,
        "dry_run": dry_run,
    }
    logger.info("Done: %s", json.dumps(summary, indent=2))
    return summary


@click.command()
@click.option("--limit", "-n", default=20, help="Number of events to process")
@click.option("--dry-run", is_flag=True, help="Extract but don't write to DB")
def main(limit: int, dry_run: bool):
    """Process unprocessed news events through Claude to extract graph connections."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    if dry_run:
        logger.info("[DRY RUN] Will not write to database")

    result = process_batch(db_url, limit=limit, dry_run=dry_run)
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
