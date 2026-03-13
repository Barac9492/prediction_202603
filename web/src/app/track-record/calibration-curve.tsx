"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface CalibrationPoint {
  label: string;
  predicted: number;
  actual: number;
  count: number;
}

export function CalibrationCurve({ data }: { data: CalibrationPoint[] }) {
  const withData = data.filter((d) => d.count > 0);
  const diagonal = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ];

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 30, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            type="number"
            dataKey="predicted"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Predicted Probability", position: "bottom", fill: "#71717a", fontSize: 12 }}
            stroke="#3f3f46"
            tick={{ fill: "#71717a", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="actual"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Actual Hit Rate", angle: -90, position: "insideLeft", fill: "#71717a", fontSize: 12 }}
            stroke="#3f3f46"
            tick={{ fill: "#71717a", fontSize: 11 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as CalibrationPoint;
              return (
                <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs">
                  <p className="text-white font-medium">{d.label}</p>
                  <p className="text-zinc-400">
                    Predicted: {(d.predicted * 100).toFixed(0)}%
                  </p>
                  <p className="text-zinc-400">
                    Actual: {(d.actual * 100).toFixed(0)}%
                  </p>
                  <p className="text-zinc-400">n = {d.count}</p>
                </div>
              );
            }}
          />
          {/* Perfect calibration diagonal */}
          <Scatter
            data={diagonal}
            dataKey="y"
            fill="none"
            line={{ stroke: "#3f3f46", strokeDasharray: "5 5", strokeWidth: 1 }}
            legendType="none"
            isAnimationActive={false}
          />
          {/* Actual data points */}
          <Scatter
            data={withData}
            dataKey="actual"
            fill="#3b82f6"
            line={{ stroke: "#3b82f6", strokeWidth: 2 }}
            r={6}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
