import { getCalibrationStats } from "@/lib/db/queries";
import { CalibrationChart } from "@/components/calibration-chart";

export default async function DashboardPage() {
  const stats = await getCalibrationStats();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="mb-4 text-lg font-semibold">Calibration</h2>
        <CalibrationChart stats={stats} />
      </div>

      {Object.keys(stats.byConfidence).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Accuracy by Confidence Bucket
          </h2>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-2">Confidence</th>
                  <th className="px-4 py-2">Correct</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byConfidence).map(([range, v]) => (
                  <tr
                    key={range}
                    className="border-b border-zinc-800/50"
                  >
                    <td className="px-4 py-2 text-zinc-300">{range}%</td>
                    <td className="px-4 py-2 text-zinc-400">{v.correct}</td>
                    <td className="px-4 py-2 text-zinc-400">{v.total}</td>
                    <td className="px-4 py-2 text-zinc-300">
                      {v.total > 0 ? `${v.accuracy}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
