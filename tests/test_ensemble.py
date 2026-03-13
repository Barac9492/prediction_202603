"""Tests for the ensemble module — signal aggregation and prediction logic."""

from signal_tracker.ensemble import ensemble, detect_contradictions, Prediction
from signal_tracker.extractor import Signal


def _signal(direction: str, strength: int, source: str = "test") -> Signal:
    return Signal(
        description=f"Test {direction} signal",
        direction=direction,
        strength=strength,
        reasoning="Test reasoning",
        source_title=source,
    )


class TestEnsemble:
    def test_empty_signals_returns_neutral(self):
        result = ensemble([])
        assert result.direction == "neutral"
        assert result.confidence == 0.0
        assert result.signal_count == 0

    def test_single_bullish_signal(self):
        result = ensemble([_signal("bullish", 4)])
        assert result.direction == "bullish"
        assert result.confidence > 0
        assert result.bullish_count == 1
        assert result.bearish_count == 0

    def test_single_bearish_signal(self):
        result = ensemble([_signal("bearish", 3)])
        assert result.direction == "bearish"
        assert result.weighted_score < 0

    def test_mixed_signals_bullish_wins(self):
        signals = [
            _signal("bullish", 5),
            _signal("bullish", 4),
            _signal("bearish", 2),
        ]
        result = ensemble(signals)
        assert result.direction == "bullish"
        assert result.signal_count == 3
        assert result.bullish_count == 2
        assert result.bearish_count == 1

    def test_mixed_signals_bearish_wins(self):
        signals = [
            _signal("bearish", 5),
            _signal("bearish", 4),
            _signal("bullish", 1),
        ]
        result = ensemble(signals)
        assert result.direction == "bearish"

    def test_balanced_signals_neutral(self):
        signals = [
            _signal("bullish", 3),
            _signal("bearish", 3),
        ]
        result = ensemble(signals)
        assert result.direction == "neutral"
        assert result.weighted_score == 0.0

    def test_confidence_bounded(self):
        result = ensemble([_signal("bullish", 5)])
        assert 0 <= result.confidence <= 100

    def test_top_reasons_max_three(self):
        signals = [_signal("bullish", i) for i in range(1, 6)]
        result = ensemble(signals)
        assert len(result.top_reasons) <= 3


class TestContradictions:
    def test_no_contradictions_same_direction(self):
        signals = [
            _signal("bullish", 3, "src_a"),
            _signal("bullish", 4, "src_b"),
        ]
        result = detect_contradictions(signals)
        assert len(result) == 0

    def test_contradiction_detected_different_sources(self):
        signals = [
            _signal("bullish", 3, "src_a"),
            _signal("bearish", 4, "src_b"),
        ]
        result = detect_contradictions(signals)
        assert len(result) == 1
        assert "BULLISH" in result[0].description
        assert "BEARISH" in result[0].description

    def test_no_contradiction_same_source(self):
        signals = [
            _signal("bullish", 3, "same_src"),
            _signal("bearish", 4, "same_src"),
        ]
        result = detect_contradictions(signals)
        assert len(result) == 0


class TestSignalProperties:
    def test_bullish_signed_strength_positive(self):
        s = _signal("bullish", 4)
        assert s.signed_strength == 4.0

    def test_bearish_signed_strength_negative(self):
        s = _signal("bearish", 3)
        assert s.signed_strength == -3.0

    def test_neutral_signed_strength_zero(self):
        s = _signal("neutral", 5)
        assert s.signed_strength == 0.0
