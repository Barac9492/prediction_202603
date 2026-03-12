export const EXTRACTION_PROMPT = `You are an expert investment analyst. Analyze the following source material and extract investment signals relevant to the given topic.

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
{
  "signals": [
    {
      "description": "...",
      "direction": "bullish|bearish|neutral",
      "strength": 1-5,
      "reasoning": "..."
    }
  ],
  "source_summary": "One paragraph summary of the source material",
  "relevance_score": 1-5
}

Be precise. Only extract signals actually supported by the source. Do not hallucinate signals.
Respond ONLY with valid JSON, no markdown fencing.`;
