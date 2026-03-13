"""Tests for the collector module — source data extraction."""

from signal_tracker.collector import from_text, Source


class TestFromText:
    def test_creates_source_from_text(self):
        result = from_text("Some article content")
        assert isinstance(result, Source)
        assert result.content == "Some article content"
        assert result.title == "Manual Input"

    def test_custom_title(self):
        result = from_text("Content", title="My Source")
        assert result.title == "My Source"

    def test_strips_whitespace(self):
        result = from_text("  padded content  ")
        assert result.content == "padded content"

    def test_snippet_short_content(self):
        result = from_text("Short")
        assert result.snippet() == "Short"

    def test_snippet_long_content(self):
        long_text = "A" * 300
        result = from_text(long_text)
        snippet = result.snippet(200)
        assert len(snippet) == 203  # 200 + "..."
        assert snippet.endswith("...")

    def test_collected_at_set(self):
        result = from_text("test")
        assert result.collected_at  # non-empty string
