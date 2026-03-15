"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function EntityTimelineChart({
  data,
}: {
  data: Array<{ date: string; value: number; attribute: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EA" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#77808D" }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "#77808D" }} tickLine={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #E6E8EA",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#1452F0"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
