"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export function Sparkline({
  data,
  direction,
}: {
  data: Array<{ probability: number; computedAt: Date }>;
  direction: string;
}) {
  if (data.length < 2) return null;

  const color =
    direction === "bullish"
      ? "#30A159"
      : direction === "bearish"
        ? "#E23939"
        : "#77808D";

  return (
    <div style={{ width: 80, height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="probability"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
