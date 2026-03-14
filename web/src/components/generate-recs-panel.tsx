"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function GenerateRecsPanel({
  candidateCount,
  expiredCount,
}: {
  candidateCount: number;
  expiredCount: number;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/recommendations/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Generated ${data.generated} recommendation(s)`);
        router.refresh();
      } else {
        setResult(data.error || "Generation failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleEvaluate() {
    setEvaluating(true);
    setResult(null);
    try {
      const res = await fetch("/api/recommendations/evaluate", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Evaluated ${data.evaluated} recommendation(s)`);
        router.refresh();
      } else {
        setResult(data.error || "Evaluation failed");
      }
    } catch {
      setResult("Network error");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-3 text-sm font-bold text-pm-text-primary">
        Generate Recommendations
      </h2>

      {candidateCount === 0 ? (
        <p className="text-sm text-pm-muted">
          No theses with strong signals.{" "}
          <Link href="/thesis" className="text-pm-blue hover:underline">
            Add theses
          </Link>{" "}
          first.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-pm-text-secondary">
            <span className="font-semibold text-pm-text-primary">
              {candidateCount}
            </span>{" "}
            candidate theses with strong signals
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full bg-pm-text-primary px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Now"}
          </button>
          {expiredCount > 0 && (
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="rounded-full border border-pm-border px-4 py-1.5 text-sm font-medium text-pm-text-primary transition-colors hover:bg-pm-bg-search disabled:opacity-50"
            >
              {evaluating
                ? "Evaluating..."
                : `Evaluate ${expiredCount} Expired`}
            </button>
          )}
        </div>
      )}

      {result && (
        <p className="mt-2 text-xs text-pm-text-meta">{result}</p>
      )}
    </div>
  );
}
