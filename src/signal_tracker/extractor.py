"""Signal extraction module — uses Claude API to extract structured signals from sources."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass

import anthropic

from signal_tracker.collector import Source

EXTRACTION_PROMPT = """\
You are an expert investment analyst. Analyze the following source material and extract investment signals relevant to the given topic.

<topic>{topic}</topic>

<source_material>
{content}
</source_material>

Extract ALL relevant signals from this source. For each signal:
1. A concise description (1-2 sentences)
2. Direction: "bullish", "bearish", or "neutral"
3. Strength: 1-5 (1=weak hint, 5=very strong evidence)
4. A brief reasoning (why this is a signal)

Respond in JSON format:
{{
  "signals": [
    {{
      "description": "...",
      "direction": "bullish|bearish|neutral",
      "strength": 1-5,
      "reasoning": "..."
    }}
  ],
  "source_summary": "One paragraph summary of the source material",
  "relevance_score": 1-5
}}

Be precise. Only extract signals actually supported by the source. Do not hallucinate signals.
Respond ONLY with valid JSON, no markdown fencing.
"""


@dataclass
class Signal:
    description: str
    direction: str  # bullish, bearish, neutral
    strength: int   # 1-5
    reasoning: str
    source_title: str = ""

    @property
    def signed_strength(self) -> float:
        """Numeric value: positive=bullish, negative=bearish, 0=neutral."""
        if self.direction == "bullish":
            return self.strength
        elif self.direction == "bearish":
            return -self.strength
        return 0.0


@dataclass
class ExtractionResult:
    signals: list[Signal]
    source_summary: str
    relevance_score: int


def extract_signals(source: Source, topic: str) -> ExtractionResult:
    """Extract signals from a single source using Claude API."""
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    # Truncate content if too long (keep under ~12k tokens)
    content = source.content[:15000]

    response = client.messages.create(
        model="claude-sonnet-4-6-20250415",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": EXTRACTION_PROMPT.format(topic=topic, content=content),
        }],
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    data = json.loads(raw)

    signals = [
        Signal(
            description=s["description"],
            direction=s["direction"],
            strength=s["strength"],
            reasoning=s["reasoning"],
            source_title=source.title,
        )
        for s in data["signals"]
    ]

    return ExtractionResult(
        signals=signals,
        source_summary=data.get("source_summary", ""),
        relevance_score=data.get("relevance_score", 3),
    )
