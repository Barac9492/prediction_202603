import type { Signal } from "@/lib/core/types";

const directionColor = {
  bullish: "text-green-400",
  bearish: "text-red-400",
  neutral: "text-yellow-400",
};

export function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`text-xs font-bold uppercase ${directionColor[signal.direction]}`}
        >
          {signal.direction}
        </span>
        <span className="text-xs text-zinc-500">
          strength {signal.strength}/5
        </span>
        {signal.sourceTitle && (
          <span className="text-xs text-zinc-600">— {signal.sourceTitle}</span>
        )}
      </div>
      <p className="text-sm text-zinc-300">{signal.description}</p>
      <p className="mt-1 text-xs text-zinc-500">{signal.reasoning}</p>
    </div>
  );
}
