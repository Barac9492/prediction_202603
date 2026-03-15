"use client";

import { useState, useEffect } from "react";

interface Suggestion {
  thesisId: number;
  title: string;
  direction: string;
  daysOverdue: number;
  shouldResolve: boolean;
  suggestedOutcome: string;
  confidence: number;
  reasoning: string;
  keyEvidence: string;
}

export function OverdueThesesBanner() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/theses/check-deadlines")
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data.suggestions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleResolve(thesisId: number, wasCorrect: boolean) {
    setResolving(thesisId);
    try {
      await fetch("/api/theses/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: thesisId, wasCorrect }),
      });
      setSuggestions((prev) => prev.filter((s) => s.thesisId !== thesisId));
    } catch { /* ignore */ }
    setResolving(null);
  }

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-orange-800">
          Overdue Theses ({suggestions.length})
        </h2>
        <span className="text-xs text-orange-600">
          Past deadline — review recommended
        </span>
      </div>
      {suggestions.map((s) => (
        <div
          key={s.thesisId}
          className="rounded border border-orange-200 bg-white px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <a
                  href={`/thesis/${s.thesisId}`}
                  className="text-sm font-medium text-pm-text-primary hover:text-pm-blue truncate"
                >
                  {s.title}
                </a>
                <span className="shrink-0 text-xs text-red-600 font-medium">
                  {s.daysOverdue}d overdue
                </span>
              </div>
              <p className="text-xs text-pm-muted">{s.reasoning}</p>
              {s.keyEvidence && (
                <p className="text-xs text-orange-700 mt-0.5">
                  Key: {s.keyEvidence}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    s.suggestedOutcome === "correct"
                      ? "bg-green-100 text-green-700"
                      : s.suggestedOutcome === "incorrect"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Suggested: {s.suggestedOutcome}
                </span>
                <span className="text-xs text-pm-muted">
                  ({Math.round(s.confidence * 100)}% confidence)
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => handleResolve(s.thesisId, true)}
                disabled={resolving === s.thesisId}
                className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors disabled:opacity-50"
              >
                Correct
              </button>
              <button
                onClick={() => handleResolve(s.thesisId, false)}
                disabled={resolving === s.thesisId}
                className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors disabled:opacity-50"
              >
                Incorrect
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
