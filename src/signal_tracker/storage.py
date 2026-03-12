"""Storage module — SQLite persistence for predictions, signals, and outcomes."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent.parent / "signal_tracker.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    direction TEXT NOT NULL,
    confidence REAL NOT NULL,
    weighted_score REAL NOT NULL,
    top_reasons TEXT NOT NULL,
    signal_count INTEGER NOT NULL,
    bullish_count INTEGER NOT NULL,
    bearish_count INTEGER NOT NULL,
    neutral_count INTEGER NOT NULL,
    contradictions TEXT,
    created_at TEXT NOT NULL,
    -- outcome tracking
    actual_outcome TEXT,
    outcome_notes TEXT,
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    direction TEXT NOT NULL,
    strength INTEGER NOT NULL,
    reasoning TEXT NOT NULL,
    source_title TEXT,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id)
);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER NOT NULL,
    title TEXT,
    url TEXT,
    summary TEXT,
    relevance_score INTEGER,
    collected_at TEXT,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id)
);
"""


def get_db(db_path: Path | None = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def save_prediction(
    db: sqlite3.Connection,
    topic: str,
    prediction,  # ensemble.Prediction
    signals,     # list[extractor.Signal]
    sources,     # list[(source_title, url, summary, relevance_score, collected_at)]
) -> int:
    """Save a prediction and all associated data. Returns prediction ID."""
    cursor = db.execute(
        """INSERT INTO predictions
           (topic, direction, confidence, weighted_score, top_reasons,
            signal_count, bullish_count, bearish_count, neutral_count,
            contradictions, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
    pred_id = cursor.lastrowid

    for s in signals:
        db.execute(
            """INSERT INTO signals
               (prediction_id, description, direction, strength, reasoning, source_title)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (pred_id, s.description, s.direction, s.strength, s.reasoning, s.source_title),
        )

    for title, url, summary, relevance, collected_at in sources:
        db.execute(
            """INSERT INTO sources
               (prediction_id, title, url, summary, relevance_score, collected_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (pred_id, title, url, summary, relevance, collected_at),
        )

    db.commit()
    return pred_id


def resolve_prediction(
    db: sqlite3.Connection,
    prediction_id: int,
    actual_outcome: str,
    notes: str = "",
) -> None:
    """Record the actual outcome for a prediction."""
    db.execute(
        """UPDATE predictions
           SET actual_outcome = ?, outcome_notes = ?, resolved_at = ?
           WHERE id = ?""",
        (actual_outcome, notes, datetime.now().isoformat(), prediction_id),
    )
    db.commit()


def list_predictions(
    db: sqlite3.Connection,
    limit: int = 20,
    resolved_only: bool = False,
) -> list[sqlite3.Row]:
    """List past predictions."""
    query = "SELECT * FROM predictions"
    if resolved_only:
        query += " WHERE actual_outcome IS NOT NULL"
    query += " ORDER BY created_at DESC LIMIT ?"
    return db.execute(query, (limit,)).fetchall()


def get_prediction_detail(db: sqlite3.Connection, prediction_id: int) -> Optional[dict]:
    """Get full prediction details including signals and sources."""
    pred = db.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
    if not pred:
        return None
    signals = db.execute("SELECT * FROM signals WHERE prediction_id = ?", (prediction_id,)).fetchall()
    sources = db.execute("SELECT * FROM sources WHERE prediction_id = ?", (prediction_id,)).fetchall()
    return {"prediction": dict(pred), "signals": [dict(s) for s in signals], "sources": [dict(s) for s in sources]}


def get_calibration_stats(db: sqlite3.Connection) -> dict:
    """Calculate accuracy stats from resolved predictions."""
    resolved = db.execute(
        "SELECT direction, confidence, actual_outcome FROM predictions WHERE actual_outcome IS NOT NULL"
    ).fetchall()

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
