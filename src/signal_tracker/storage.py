"""Storage module — PostgreSQL persistence for predictions, signals, and outcomes.

Uses psycopg2 to connect to the same Neon PostgreSQL database as the web frontend,
ensuring a unified data store across CLI and web.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def get_db(db_url: str | None = None):
    """Get a PostgreSQL connection. Falls back to DATABASE_URL env var."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        raise ImportError("psycopg2 not installed. Run: pip install psycopg2-binary")

    url = db_url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. Set it in .env or pass db_url argument."
        )

    conn = psycopg2.connect(url)
    conn.autocommit = False
    # Use RealDictCursor so rows behave like dicts
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    _ensure_schema(conn)
    return conn


def _ensure_schema(conn) -> None:
    """Create tables if they don't exist (idempotent)."""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            topic TEXT NOT NULL,
            direction TEXT NOT NULL,
            confidence REAL NOT NULL,
            weighted_score REAL NOT NULL,
            top_reasons JSONB NOT NULL,
            signal_count INTEGER NOT NULL,
            bullish_count INTEGER NOT NULL,
            bearish_count INTEGER NOT NULL,
            neutral_count INTEGER NOT NULL,
            contradictions JSONB,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            actual_outcome TEXT,
            outcome_notes TEXT,
            resolved_at TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS signals (
            id SERIAL PRIMARY KEY,
            prediction_id INTEGER NOT NULL REFERENCES predictions(id),
            description TEXT NOT NULL,
            direction TEXT NOT NULL,
            strength INTEGER NOT NULL,
            reasoning TEXT NOT NULL,
            source_title TEXT
        );

        CREATE TABLE IF NOT EXISTS sources (
            id SERIAL PRIMARY KEY,
            prediction_id INTEGER NOT NULL REFERENCES predictions(id),
            title TEXT,
            url TEXT,
            summary TEXT,
            relevance_score INTEGER,
            collected_at TIMESTAMP
        );
    """)
    conn.commit()


def save_prediction(
    db,
    topic: str,
    prediction,  # ensemble.Prediction
    signals,     # list[extractor.Signal]
    sources,     # list[(source_title, url, summary, relevance_score, collected_at)]
) -> int:
    """Save a prediction and all associated data. Returns prediction ID."""
    cur = db.cursor()
    cur.execute(
        """INSERT INTO predictions
           (topic, direction, confidence, weighted_score, top_reasons,
            signal_count, bullish_count, bearish_count, neutral_count,
            contradictions, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           RETURNING id""",
        (
            topic,
            prediction.direction,
            prediction.confidence,
            prediction.weighted_score,
            json.dumps(prediction.top_reasons),
            prediction.signal_count,
            prediction.bullish_count,
            prediction.bearish_count,
            prediction.neutral_count,
            json.dumps([c.description for c in prediction.contradictions]),
            datetime.now().isoformat(),
        ),
    )
    pred_id = cur.fetchone()["id"]

    for s in signals:
        cur.execute(
            """INSERT INTO signals
               (prediction_id, description, direction, strength, reasoning, source_title)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (pred_id, s.description, s.direction, s.strength, s.reasoning, s.source_title),
        )

    for title, url, summary, relevance, collected_at in sources:
        cur.execute(
            """INSERT INTO sources
               (prediction_id, title, url, summary, relevance_score, collected_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (pred_id, title, url, summary, relevance, collected_at),
        )

    db.commit()
    return pred_id


def resolve_prediction(
    db,
    prediction_id: int,
    actual_outcome: str,
    notes: str = "",
) -> None:
    """Record the actual outcome for a prediction."""
    cur = db.cursor()
    cur.execute(
        """UPDATE predictions
           SET actual_outcome = %s, outcome_notes = %s, resolved_at = %s
           WHERE id = %s""",
        (actual_outcome, notes, datetime.now().isoformat(), prediction_id),
    )
    db.commit()


def list_predictions(
    db,
    limit: int = 20,
    resolved_only: bool = False,
) -> list[dict]:
    """List past predictions."""
    cur = db.cursor()
    query = "SELECT * FROM predictions"
    if resolved_only:
        query += " WHERE actual_outcome IS NOT NULL"
    query += " ORDER BY created_at DESC LIMIT %s"
    cur.execute(query, (limit,))
    return [dict(row) for row in cur.fetchall()]


def get_prediction_detail(db, prediction_id: int) -> Optional[dict]:
    """Get full prediction details including signals and sources."""
    cur = db.cursor()
    cur.execute("SELECT * FROM predictions WHERE id = %s", (prediction_id,))
    pred = cur.fetchone()
    if not pred:
        return None
    cur.execute("SELECT * FROM signals WHERE prediction_id = %s", (prediction_id,))
    sigs = [dict(row) for row in cur.fetchall()]
    cur.execute("SELECT * FROM sources WHERE prediction_id = %s", (prediction_id,))
    srcs = [dict(row) for row in cur.fetchall()]
    return {"prediction": dict(pred), "signals": sigs, "sources": srcs}


def get_calibration_stats(db) -> dict:
    """Calculate accuracy stats from resolved predictions."""
    cur = db.cursor()
    cur.execute(
        "SELECT direction, confidence, actual_outcome FROM predictions WHERE actual_outcome IS NOT NULL"
    )
    resolved = cur.fetchall()

    if not resolved:
        return {"total": 0, "correct": 0, "accuracy": 0.0, "by_confidence": {}}

    correct = sum(1 for r in resolved if r["direction"] == r["actual_outcome"])
    total = len(resolved)

    # Bucket by confidence ranges
    buckets = {"0-25": [0, 0], "25-50": [0, 0], "50-75": [0, 0], "75-100": [0, 0]}
    for r in resolved:
        conf = r["confidence"]
        if conf < 25:
            key = "0-25"
        elif conf < 50:
            key = "25-50"
        elif conf < 75:
            key = "50-75"
        else:
            key = "75-100"
        buckets[key][1] += 1
        if r["direction"] == r["actual_outcome"]:
            buckets[key][0] += 1

    by_confidence = {
        k: {"correct": v[0], "total": v[1], "accuracy": v[0] / v[1] * 100 if v[1] > 0 else 0}
        for k, v in buckets.items()
    }

    return {
        "total": total,
        "correct": correct,
        "accuracy": round(correct / total * 100, 1),
        "by_confidence": by_confidence,
    }
