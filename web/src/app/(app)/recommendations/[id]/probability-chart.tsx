"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function RecProbabilityChart({
  data,
}: {
  data: Array<{ date: string; probability: number }>;
}) {
  if (data.length < 2) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-pm-text-meta">
        Probability Over Time
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Probability"]}
            />
            <Area
              type="monotone"
              dataKey="probability"
              stroke="#16a34a"
              fill="#16a34a"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
