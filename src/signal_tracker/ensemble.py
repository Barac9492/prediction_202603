"""Ensemble module — aggregate signals into a prediction."""

from __future__ import annotations

from dataclasses import dataclass

from signal_tracker.extractor import Signal


@dataclass
class Contradiction:
    signal_a: Signal
    signal_b: Signal
    description: str


@dataclass
class Prediction:
    direction: str          # bullish, bearish, neutral
    confidence: float       # 0-100%
    top_reasons: list[str]  # top 3 supporting reasons
    contradictions: list[Contradiction]
    signal_count: int
    bullish_count: int
    bearish_count: int
    neutral_count: int
    weighted_score: float   # raw weighted score


def detect_contradictions(signals: list[Signal]) -> list[Contradiction]:
    """Find pairs of signals that contradict each other (one bullish, one bearish on similar topic)."""
    contradictions = []
    bullish = [s for s in signals if s.direction == "bullish"]
    bearish = [s for s in signals if s.direction == "bearish"]

    for b in bullish:
        for br in bearish:
            # Different sources = real contradiction worth noting
            if b.source_title != br.source_title:
                contradictions.append(Contradiction(
                    signal_a=b,
                    signal_b=br,
                    description=f"BULLISH ({b.source_title}): {b.description} vs BEARISH ({br.source_title}): {br.description}",
                ))
    return contradictions


def ensemble(signals: list[Signal]) -> Prediction:
    """Aggregate signals into a single prediction using weighted scoring."""
    if not signals:
        return Prediction(
            direction="neutral",
            confidence=0.0,
            top_reasons=["No signals extracted"],
            contradictions=[],
            signal_count=0,
            bullish_count=0,
            bearish_count=0,
            neutral_count=0,
            weighted_score=0.0,
        )

    # Weighted score: sum of signed strengths
    weighted_score = sum(s.signed_strength for s in signals)
    max_possible = sum(s.strength for s in signals)

    # Direction from weighted score
    if weighted_score > 0:
        direction = "bullish"
    elif weighted_score < 0:
        direction = "bearish"
    else:
        direction = "neutral"

    # Confidence: how decisive the signal is (0-100%)
    if max_possible > 0:
        confidence = min(abs(weighted_score) / max_possible * 100, 100.0)
    else:
        confidence = 0.0

    # Top reasons: strongest signals in the winning direction
    sorted_signals = sorted(signals, key=lambda s: s.strength, reverse=True)
    top_in_direction = [s for s in sorted_signals if s.direction == direction]
    if not top_in_direction:
        top_in_direction = sorted_signals
    top_reasons = [s.description for s in top_in_direction[:3]]

    contradictions = detect_contradictions(signals)

    return Prediction(
        direction=direction,
        confidence=round(confidence, 1),
        top_reasons=top_reasons,
        contradictions=contradictions,
        signal_count=len(signals),
        bullish_count=sum(1 for s in signals if s.direction == "bullish"),
        bearish_count=sum(1 for s in signals if s.direction == "bearish"),
        neutral_count=sum(1 for s in signals if s.direction == "neutral"),
        weighted_score=weighted_score,
    )
