export interface Signal {
  description: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number; // 1-5
  reasoning: string;
  sourceTitle: string;
}

export interface ExtractionResult {
  signals: Signal[];
  sourceSummary: string;
  relevanceScore: number;
}

export interface SourceData {
  content: string;
  title: string;
  url: string;
  collectedAt: string;
}

export interface Contradiction {
  signalA: Signal;
  signalB: Signal;
  description: string;
}

export interface Prediction {
  direction: "bullish" | "bearish" | "neutral";
  confidence: number; // 0-100
  topReasons: string[];
  contradictions: Contradiction[];
  signalCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  weightedScore: number;
}

export interface AnalysisProgress {
  step: string;
  detail?: string;
}

export type Outcome = "bullish" | "bearish" | "neutral";
