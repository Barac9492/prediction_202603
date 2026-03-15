"use client";

import { useState, useCallback } from "react";
import { SourceInput } from "@/components/source-input";
import { PredictionCard } from "@/components/prediction-card";
import { SignalCard } from "@/components/signal-card";
import type { Prediction, Signal } from "@/lib/core/types";

interface AnalysisResult {
  id: number;
  prediction: Prediction;
  signals: Signal[];
  sources: { title: string; url: string; summary: string; relevanceScore: number }[];
}

export default function AnalyzePage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (data: { topic: string; urls: string[]; text: string }) => {
      setLoading(true);
      setProgress([]);
      setResult(null);
      setError(null);

      try {
        const resp = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6));

            if (data.step === "error") {
              setError(data.detail);
              setLoading(false);
              return;
            }

            if (data.step === "done") {
              setResult(data.result);
              setLoading(false);
              return;
            }

            if (data.detail) {
              setProgress((prev) => [...prev, data.detail]);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Analyze</h1>

      <SourceInput onSubmit={handleSubmit} disabled={loading} />

      {progress.length > 0 && (
        <div className="space-y-1 rounded-md border border-pm-border bg-white p-4">
          {progress.map((p, i) => (
            <p key={i} className="text-sm text-pm-muted">
              {i === progress.length - 1 && loading ? "⏳ " : "✓ "}
              {p}
            </p>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Prediction #{result.id}</h2>
            <a
              href={`/predictions/${result.id}`}
              className="text-sm text-blue-400 hover:underline"
            >
              View details →
            </a>
          </div>

          <PredictionCard prediction={result.prediction} />

          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
              Signals ({result.signals.length})
            </h3>
            <div className="space-y-2">
              {result.signals.map((s, i) => (
                <SignalCard key={i} signal={s} />
              ))}
            </div>
          </div>

          {result.sources.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
                Sources ({result.sources.length})
              </h3>
              <div className="space-y-2">
                {result.sources.map((src, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-pm-border bg-white p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-pm-text-primary">
                        {src.title}
                      </span>
                      <span className="text-xs text-pm-text-meta">
                        relevance {src.relevanceScore}/5
                      </span>
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        {src.url}
                      </a>
                    )}
                    {src.summary && (
                      <p className="mt-1 text-xs text-pm-text-secondary">
                        {src.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
