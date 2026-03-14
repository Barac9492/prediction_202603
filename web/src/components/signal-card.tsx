import type { Signal } from "@/lib/core/types";

const directionColor = {
  bullish: "text-green-600",
  bearish: "text-red-600",
  neutral: "text-yellow-600",
};

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="rounded-md border border-pm-border bg-white p-3">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`text-xs font-bold uppercase ${directionColor[signal.direction]}`}
        >
          {signal.direction}
        </span>
        <span className="text-xs text-pm-text-secondary">
          strength {signal.strength}/5
        </span>
        {signal.sourceTitle && (
          <span className="text-xs text-pm-text-meta">— {signal.sourceTitle}</span>
        )}
      </div>
      <p className="text-sm text-pm-text-primary">{signal.description}</p>
      <p className="mt-1 text-xs text-pm-text-secondary">{signal.reasoning}</p>
    </div>
  );
}
