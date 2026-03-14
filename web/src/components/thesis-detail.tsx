"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HistoryPoint {
  probability: number;
  momentum: number | null;
  signalCount: number;
  computedAt: string;
}

export function ThesisDetail({
  history,
  direction,
}: {
  history: HistoryPoint[];
  direction: string;
}) {
  const color =
    direction === "bullish"
      ? "#30A159"
      : direction === "bearish"
        ? "#E23939"
        : "#77808D";

  const chartData = history.map((h) => ({
    date: new Date(h.computedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    probability: +(h.probability * 100).toFixed(1),
    momentum: h.momentum != null ? +(h.momentum * 100).toFixed(1) : null,
  }));

  return (
    <div className="rounded-lg border border-pm-border bg-white p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-pm-text-secondary">
        Probability Over Time
      </h2>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#77808D" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#77808D" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={45}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, "Probability"]}
              contentStyle={{
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #E5E7EB",
              }}
            />
            <Area
              type="monotone"
              dataKey="probability"
              stroke={color}
              strokeWidth={2}
              fill="url(#probGradient)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
