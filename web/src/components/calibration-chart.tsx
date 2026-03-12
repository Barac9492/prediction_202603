"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CalibrationStats {
  total: number;
  correct: number;
  accuracy: number;
  byConfidence: Record<
    string,
    { correct: number; total: number; accuracy: number }
  >;
}

export function CalibrationChart({ stats }: { stats: CalibrationStats }) {
  if (stats.total === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No resolved predictions yet. Resolve some predictions to see calibration
        data.
      </p>
    );
  }

  const data = Object.entries(stats.byConfidence).map(([range, v]) => ({
    range: `${range}%`,
    accuracy: v.accuracy,
    count: v.total,
  }));

  return (
    <div>
      <div className="mb-4 flex gap-6 text-sm">
        <div>
          <span className="text-zinc-500">Total resolved: </span>
          <span className="text-white">{stats.total}</span>
        </div>
        <div>
          <span className="text-zinc-500">Correct: </span>
          <span className="text-white">{stats.correct}</span>
        </div>
        <div>
          <span className="text-zinc-500">Accuracy: </span>
          <span className="text-white">{stats.accuracy}%</span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="range" stroke="#888" fontSize={12} />
            <YAxis
              stroke="#888"
              fontSize={12}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #333",
                borderRadius: "6px",
              }}
              labelStyle={{ color: "#fff" }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                `${value}%`,
                name === "accuracy" ? "Accuracy" : name,
              ]}
            />
            <ReferenceLine y={50} stroke="#555" strokeDasharray="3 3" />
            <Bar dataKey="accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
