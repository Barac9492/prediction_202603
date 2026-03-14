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
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="predicted"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Predicted Probability", position: "bottom", fill: "#6b7280", fontSize: 12 }}
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="actual"
            domain={[0, 1]}
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Actual Hit Rate", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 12 }}
            stroke="#d1d5db"
            tick={{ fill: "#6b7280", fontSize: 11 }}
          />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload as CalibrationPoint;
              return (
                <div className="bg-white shadow-lg border border-pm-border rounded px-3 py-2 text-xs">
                  <p className="text-pm-text-primary font-medium">{d.label}</p>
                  <p className="text-pm-muted">
                    Predicted: {(d.predicted * 100).toFixed(0)}%
                  </p>
                  <p className="text-pm-muted">
                    Actual: {(d.actual * 100).toFixed(0)}%
                  </p>
                  <p className="text-pm-muted">n = {d.count}</p>
                </div>
              );
            }}
          />
          {/* Perfect calibration diagonal */}
          <Scatter
            data={diagonal}
            dataKey="y"
            fill="none"
            line={{ stroke: "#d1d5db", strokeDasharray: "5 5", strokeWidth: 1 }}
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
