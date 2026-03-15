"use client";

import { useState } from "react";

export function BriefingNarrative() {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setNarrative(data.narrative);
      setGeneratedAt(data.generatedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-pm-border bg-gradient-to-br from-blue-50/50 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pm-text-secondary">
          AI Analyst Briefing
        </h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-pm-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating..." : narrative ? "Regenerate" : "Generate Briefing"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 mb-2">{error}</p>
      )}
      {narrative ? (
        <div>
          <div className="prose prose-sm max-w-none text-pm-text-primary whitespace-pre-wrap leading-relaxed">
            {narrative}
          </div>
          {generatedAt && (
            <p className="mt-3 text-xs text-pm-text-meta">
              Generated {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      ) : !loading ? (
        <p className="text-sm text-pm-muted">
          Click &quot;Generate Briefing&quot; to get an AI-synthesized morning summary.
        </p>
      ) : (
        <div className="flex items-center gap-2 py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-pm-blue border-t-transparent" />
          <span className="text-sm text-pm-muted">Analyzing signals and generating briefing...</span>
        </div>
      )}
    </div>
  );
}
