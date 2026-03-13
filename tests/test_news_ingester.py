"""Tests for the news_ingester module — RSS parsing and AI relevance filtering."""

from signal_tracker.news_ingester import (
    NewsItem,
    is_ai_relevant,
    _strip_html,
    _parse_date,
)


class TestIsAiRelevant:
    def test_relevant_title(self):
        item = NewsItem(title="OpenAI launches new GPT model", url="http://test.com", source="test")
        assert is_ai_relevant(item) is True

    def test_irrelevant_title(self):
        item = NewsItem(title="New recipe for chocolate cake", url="http://test.com", source="test")
        assert is_ai_relevant(item) is False

    def test_relevant_summary(self):
        item = NewsItem(title="Tech news", url="http://test.com", source="test", summary="NVIDIA GPU shortage")
        assert is_ai_relevant(item) is True

    def test_case_insensitive(self):
        item = NewsItem(title="ARTIFICIAL INTELLIGENCE trends", url="http://test.com", source="test")
        assert is_ai_relevant(item) is True


class TestStripHtml:
    def test_removes_tags(self):
        assert _strip_html("<p>Hello <b>world</b></p>") == "Hello world"

    def test_empty_string(self):
        assert _strip_html("") == ""

    def test_no_tags(self):
        assert _strip_html("plain text") == "plain text"

    def test_collapses_whitespace(self):
        assert _strip_html("<p>a</p>  <p>b</p>") == "a b"


class TestParseDate:
    def test_rss_format(self):
        result = _parse_date("Mon, 01 Jan 2024 12:00:00 +0000")
        assert result is not None
        assert result.year == 2024

    def test_iso_format(self):
        result = _parse_date("2024-01-15T10:30:00Z")
        assert result is not None
        assert result.day == 15

    def test_invalid_format(self):
        result = _parse_date("not a date")
        assert result is None

    def test_none_input(self):
        result = _parse_date(None)
        assert result is None


class TestNewsItemId:
    def test_stable_id(self):
        item = NewsItem(title="Test", url="http://example.com/article", source="test")
        id1 = item.id
        id2 = item.id
        assert id1 == id2
        assert len(id1) == 16

    def test_different_urls_different_ids(self):
        item1 = NewsItem(title="A", url="http://example.com/1", source="test")
        item2 = NewsItem(title="A", url="http://example.com/2", source="test")
        assert item1.id != item2.id
