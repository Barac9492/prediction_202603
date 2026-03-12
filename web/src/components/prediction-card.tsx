import type { Prediction } from "@/lib/core/types";

const directionColor = {
  bullish: "text-green-400",
  bearish: "text-red-400",
  neutral: "text-yellow-400",
};

const directionBg = {
  bullish: "bg-green-500/10 border-green-500/30",
  bearish: "bg-red-500/10 border-red-500/30",
  neutral: "bg-yellow-500/10 border-yellow-500/30",
};

export function PredictionCard({ prediction }: { prediction: Prediction }) {
  return (
    <div
      className={`rounded-lg border p-5 ${directionBg[prediction.direction]}`}
    >
      <div className="mb-3 flex items-baseline gap-3">
        <span
          className={`text-2xl font-bold uppercase ${directionColor[prediction.direction]}`}
        >
          {prediction.direction}
        </span>
        <span className="text-lg text-zinc-300">
          {prediction.confidence}% confidence
        </span>
      </div>

      <div className="mb-3 text-sm text-zinc-400">
        Score: {prediction.weightedScore.toFixed(1)} | Signals:{" "}
        {prediction.signalCount} ({prediction.bullishCount}↑{" "}
        {prediction.bearishCount}↓ {prediction.neutralCount}→)
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Top reasons
        </p>
        {prediction.topReasons.map((r, i) => (
          <p key={i} className="text-sm text-zinc-300">
            • {r}
          </p>
        ))}
      </div>

      {prediction.contradictions.length > 0 && (
        <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-yellow-500">
            Contradictions
          </p>
          {prediction.contradictions.map((c, i) => (
            <p key={i} className="text-sm text-yellow-300/80">
              {c.description}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
