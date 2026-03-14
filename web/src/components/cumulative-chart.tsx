"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface CumulativePoint {
  date: string;
  cumReturn: number;
  asset: string;
}

export function CumulativeChart({ data }: { data: CumulativePoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-pm-muted">
        No return data yet
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as CumulativePoint;
              return (
                <div className="rounded border border-pm-border bg-white px-3 py-2 text-xs shadow-lg">
                  <p className="font-medium text-pm-text-primary">{d.date}</p>
                  <p className="text-pm-muted">
                    Cumulative: {(d.cumReturn * 100).toFixed(2)}%
                  </p>
                  <p className="text-pm-muted">Last: {d.asset}</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="cumReturn"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
