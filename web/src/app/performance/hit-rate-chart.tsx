"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface QuintileData {
  label: string;
  hitRate: number;
  avgReturn: number | null;
  count: number;
}

export function HitRateChart({ data }: { data: QuintileData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-pm-muted">
        Not enough data for quintile analysis
      </div>
    );
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            label={{
              value: "Conviction Range",
              position: "bottom",
              fill: "#6b7280",
              fontSize: 12,
            }}
          />
          <YAxis
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            domain={[0, 1]}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as QuintileData;
              return (
                <div className="rounded border border-pm-border bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-medium text-pm-text-primary">
                    Conviction: {d.label}
                  </p>
                  <p className="text-pm-muted">
                    Hit Rate: {(d.hitRate * 100).toFixed(1)}%
                  </p>
                  {d.avgReturn !== null && (
                    <p className="text-pm-muted">
                      Avg Return: {(d.avgReturn * 100).toFixed(2)}%
                    </p>
                  )}
                  <p className="text-pm-muted">n = {d.count}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="hitRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
