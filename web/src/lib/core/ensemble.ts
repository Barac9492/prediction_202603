import { Signal, Contradiction, Prediction } from "./types";

function signedStrength(signal: Signal): number {
  if (signal.direction === "bullish") return signal.strength;
  if (signal.direction === "bearish") return -signal.strength;
  return 0;
}

function detectContradictions(signals: Signal[]): Contradiction[] {
  const contradictions: Contradiction[] = [];
  const bullish = signals.filter((s) => s.direction === "bullish");
  const bearish = signals.filter((s) => s.direction === "bearish");

  for (const b of bullish) {
    for (const br of bearish) {
      if (b.sourceTitle !== br.sourceTitle) {
        contradictions.push({
          signalA: b,
          signalB: br,
          description: `BULLISH (${b.sourceTitle}): ${b.description} vs BEARISH (${br.sourceTitle}): ${br.description}`,
        });
      }
    }
  }
  return contradictions;
}

export function ensemble(signals: Signal[]): Prediction {
  if (!signals.length) {
    return {
      direction: "neutral",
      confidence: 0,
      topReasons: ["No signals extracted"],
      contradictions: [],
      signalCount: 0,
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      weightedScore: 0,
    };
  }

  const weightedScore = signals.reduce((sum, s) => sum + signedStrength(s), 0);
  const maxPossible = signals.reduce((sum, s) => sum + s.strength, 0);

  const direction: Prediction["direction"] =
    weightedScore > 0 ? "bullish" : weightedScore < 0 ? "bearish" : "neutral";

  const confidence =
    maxPossible > 0
      ? Math.min(Math.round((Math.abs(weightedScore) / maxPossible) * 1000) / 10, 100)
      : 0;

  const sorted = [...signals].sort((a, b) => b.strength - a.strength);
  const topInDirection = sorted.filter((s) => s.direction === direction);
  const topReasons = (topInDirection.length ? topInDirection : sorted)
    .slice(0, 3)
    .map((s) => s.description);

  return {
    direction,
    confidence,
    topReasons,
    contradictions: detectContradictions(signals),
    signalCount: signals.length,
    bullishCount: signals.filter((s) => s.direction === "bullish").length,
    bearishCount: signals.filter((s) => s.direction === "bearish").length,
    neutralCount: signals.filter((s) => s.direction === "neutral").length,
    weightedScore,
  };
}
