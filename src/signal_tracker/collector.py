"""Data collection module — extract content from URLs or accept raw text."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime

import httpx
from bs4 import BeautifulSoup


@dataclass
class Source:
    content: str
    title: str = ""
    url: str = ""
    collected_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def snippet(self, max_chars: int = 200) -> str:
        return self.content[:max_chars] + ("..." if len(self.content) > max_chars else "")


def from_text(text: str, title: str = "") -> Source:
    """Create a source from raw text input."""
    return Source(content=text.strip(), title=title or "Manual Input")


def from_url(url: str) -> Source:
    """Fetch and extract article content from a URL."""
    # Try newspaper3k first, fall back to BeautifulSoup
    try:
        return _extract_newspaper(url)
    except Exception:
        return _extract_bs4(url)


def _extract_newspaper(url: str) -> Source:
    from newspaper import Article

    article = Article(url)
    article.download()
    article.parse()
    if not article.text or len(article.text) < 50:
        raise ValueError("Newspaper extracted too little text")
    return Source(content=article.text, title=article.title or "", url=url)


def _extract_bs4(url: str) -> Source:
    resp = httpx.get(url, follow_redirects=True, timeout=15, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
    })
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove script/style
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    # Extract main content from article or body
    article = soup.find("article") or soup.find("main") or soup.body
    if article is None:
        raise ValueError("Could not extract content from URL")

    text = article.get_text(separator="\n", strip=True)
    # Collapse excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)

    if len(text) < 50:
        raise ValueError("Extracted text too short")

    return Source(content=text, title=title, url=url)
