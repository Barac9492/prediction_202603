"use client";

import { useState } from "react";

interface Factor {
  signal: string;
  direction: string;
  impact: number;
  reasoning: string;
}

export function ProbabilityExplainer({ thesisId }: { thesisId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function explain() {
    if (summary) {
      setOpen(!open);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/theses/${thesisId}/explain-move`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setSummary(data.summary);
      setFactors(data.factors ?? []);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load explanation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-pm-border bg-white">
      <button
        onClick={explain}
        disabled={loading}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-pm-bg-search transition-colors"
      >
        <span className="text-sm font-medium text-pm-text-primary">
          Why did this move?
        </span>
        {loading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pm-blue border-t-transparent" />
        ) : (
          <span className="text-xs text-pm-muted">{open ? "Hide" : "Explain"}</span>
        )}
      </button>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {open && summary && (
        <div className="border-t border-pm-border px-4 py-3 space-y-3">
          <p className="text-sm text-pm-text-primary leading-relaxed">{summary}</p>

          {factors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-pm-text-secondary">
                Contributing Factors
              </p>
              {factors.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md bg-pm-bg-search px-3 py-2"
                >
                  <span
                    className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      f.impact > 0
                        ? "bg-green-100 text-green-700"
                        : f.impact < 0
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {f.impact > 0 ? "+" : ""}{f.impact.toFixed(1)}pp
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-pm-text-primary">
                      {f.signal}
                    </p>
                    <p className="text-xs text-pm-muted">{f.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
