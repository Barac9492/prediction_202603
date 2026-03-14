export const dynamic = "force-dynamic";
import Link from "next/link";
import { listPredictions, listStalePredictions } from "@/lib/db/queries";

const directionColor: Record<string, string> = {
  bullish: "text-green-400",
  bearish: "text-red-400",
  neutral: "text-yellow-400",
};

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const f = (filter as "all" | "pending" | "resolved") || "all";
  const [preds, stale] = await Promise.all([
    listPredictions(f),
    listStalePredictions(7, 5),
  ]);

  return (
    <div className="space-y-6">
      {/* Resolution nudge banner */}
      {stale.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-400">
                {stale.length} prediction{stale.length > 1 ? "s" : ""} awaiting resolution
              </h3>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Recording outcomes improves calibration accuracy and strengthens the knowledge graph.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stale.map((p) => (
              <Link
                key={p.id}
                href={`/predictions/${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-800/50 bg-amber-900/30 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-900/50 transition-colors"
              >
                <span className={`font-medium uppercase ${directionColor[p.direction] || ""}`}>
                  {p.direction}
                </span>
                <span className="text-amber-400/60">|</span>
                <span className="truncate max-w-[200px]">{p.topic}</span>
                <span className="text-amber-600 text-[10px]">
                  {p.createdAt
                    ? `${Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)}d ago`
                    : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prediction Log</h1>
        <div className="flex gap-1">
          {(["all", "pending", "resolved"] as const).map((v) => (
            <Link
              key={v}
              href={`/log?filter=${v}`}
              className={`rounded-md px-3 py-1 text-sm capitalize ${
                f === v
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>

      {preds.length === 0 ? (
        <p className="text-sm text-zinc-500">No predictions yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Topic</th>
                <th className="px-4 py-2">Direction</th>
                <th className="px-4 py-2">Confidence</th>
                <th className="px-4 py-2">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {preds.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-900/30"
                >
                  <td className="px-4 py-2 text-zinc-500">{p.id}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {p.createdAt
                      ? new Date(p.createdAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/predictions/${p.id}`}
                      className="text-zinc-300 hover:text-white hover:underline"
                    >
                      {p.topic}
                    </Link>
                  </td>
                  <td
                    className={`px-4 py-2 font-medium uppercase ${directionColor[p.direction] || "text-zinc-400"}`}
                  >
                    {p.direction}
                  </td>
                  <td className="px-4 py-2 text-zinc-300">
                    {p.confidence}%
                  </td>
                  <td className="px-4 py-2">
                    {p.actualOutcome ? (
                      <span
                        className={`text-xs font-medium uppercase ${
                          p.direction === p.actualOutcome
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {p.actualOutcome}
                        {p.direction === p.actualOutcome ? " ✓" : " ✗"}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
