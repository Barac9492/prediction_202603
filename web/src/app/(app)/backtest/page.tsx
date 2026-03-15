"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ThesisResult {
  thesisId: number;
  title: string;
  brierScore: number;
  finalProbability: number;
  outcome: number;
  snapshotCount?: number;
  probabilities?: Array<{ timestamp: string; probability: number }>;
}

interface PastRun {
  id: number;
  name: string;
  status: string;
  accuracy: number | null;
  totalSignals: number | null;
  correctSignals: number | null;
  parameters: Record<string, unknown> | null;
  results: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

interface SweepRow {
  rank: number;
  params: {
    decayRate: number;
    modelWeight: number;
    marketWeight: number;
    crossThesisCap: number;
    neutralFactor: number;
  };
  aggregateBrier: number;
  thesisCount: number;
  perThesis: ThesisResult[];
}

export default function BacktestPage() {
  // Single backtest params
  const [decayRate, setDecayRate] = useState(0.03);
  const [modelWeight, setModelWeight] = useState(0.7);
  const [crossThesisCap, setCrossThesisCap] = useState(0.1);
  const [neutralFactor, setNeutralFactor] = useState(0.25);

  // Results
  const [singleResult, setSingleResult] = useState<{
    aggregateBrier: number;
    thesisResults: ThesisResult[];
    calibrationBuckets: Array<{
      bucket: string;
      avgPredicted: number;
      avgActual: number;
      count: number;
    }>;
  } | null>(null);

  const [sweepResults, setSweepResults] = useState<SweepRow[] | null>(null);
  const [selectedThesis, setSelectedThesis] = useState<ThesisResult | null>(null);

  const [pastRuns, setPastRuns] = useState<PastRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);

  useEffect(() => {
    fetch("/api/backtest")
      .then((res) => res.json())
      .then((data) => setPastRuns(data.runs ?? []))
      .catch(() => {});
  }, []);

  async function runSingle() {
    setLoading(true);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decayRate,
          modelWeight,
          marketWeight: 1 - modelWeight,
          crossThesisCap,
          neutralFactor,
        }),
      });
      const data = await res.json();
      setSingleResult(data);
      setSelectedThesis(null);
    } finally {
      setLoading(false);
    }
  }

  async function runSweep() {
    setSweepLoading(true);
    try {
      const res = await fetch("/api/backtest/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSweepResults(data.results ?? []);
    } finally {
      setSweepLoading(false);
    }
  }

  function brierColor(score: number) {
    if (score < 0.15) return "text-green-600";
    if (score < 0.25) return "text-yellow-600";
    return "text-red-600";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">Backtest</h1>
        <p className="text-pm-muted text-sm mt-1">
          Replay probability computation on resolved theses to tune parameters
        </p>
      </div>

      {/* Parameter Controls */}
      <div className="rounded-xl border border-pm-border bg-white p-6">
        <h2 className="text-lg font-semibold text-pm-text-primary mb-4">Parameters</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm text-pm-muted mb-1">
              Decay Rate: {decayRate}
            </label>
            <input
              type="range"
              min={0.005}
              max={0.15}
              step={0.005}
              value={decayRate}
              onChange={(e) => setDecayRate(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-pm-muted mb-1">
              Model Weight: {modelWeight}
            </label>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={modelWeight}
              onChange={(e) => setModelWeight(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-pm-muted mb-1">
              Cross-Thesis Cap: {crossThesisCap}
            </label>
            <input
              type="range"
              min={0}
              max={0.2}
              step={0.01}
              value={crossThesisCap}
              onChange={(e) => setCrossThesisCap(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-pm-muted mb-1">
              Neutral Factor: {neutralFactor}
            </label>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.05}
              value={neutralFactor}
              onChange={(e) => setNeutralFactor(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={runSingle}
            disabled={loading}
            className="rounded-full bg-pm-text-primary text-white px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run Backtest"}
          </button>
          <button
            onClick={runSweep}
            disabled={sweepLoading}
            className="rounded-full border border-pm-border text-pm-text-primary px-5 py-2 text-sm font-medium hover:bg-pm-bg-search disabled:opacity-50"
          >
            {sweepLoading ? "Sweeping..." : "Run Sweep"}
          </button>
        </div>
      </div>

      {/* Single Backtest Results */}
      {singleResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-pm-border bg-white p-4">
              <p className="text-xs text-pm-muted uppercase tracking-wider">Brier Score</p>
              <p className={`text-2xl font-bold mt-1 ${brierColor(singleResult.aggregateBrier)}`}>
                {singleResult.aggregateBrier.toFixed(4)}
              </p>
              <p className="text-xs text-pm-muted mt-1">Lower is better</p>
            </div>
            <div className="rounded-xl border border-pm-border bg-white p-4">
              <p className="text-xs text-pm-muted uppercase tracking-wider">Theses Evaluated</p>
              <p className="text-2xl font-bold mt-1 text-pm-text-primary">
                {singleResult.thesisResults.length}
              </p>
            </div>
            <div className="rounded-xl border border-pm-border bg-white p-4">
              <p className="text-xs text-pm-muted uppercase tracking-wider">Accuracy (1 - Brier)</p>
              <p className="text-2xl font-bold mt-1 text-pm-text-primary">
                {((1 - singleResult.aggregateBrier) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Thesis Results Table */}
          <div className="rounded-xl border border-pm-border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border bg-pm-bg-search">
                  <th className="text-left px-4 py-3 text-pm-muted font-medium">Thesis</th>
                  <th className="text-right px-4 py-3 text-pm-muted font-medium">Final Prob</th>
                  <th className="text-right px-4 py-3 text-pm-muted font-medium">Outcome</th>
                  <th className="text-right px-4 py-3 text-pm-muted font-medium">Brier</th>
                </tr>
              </thead>
              <tbody>
                {singleResult.thesisResults.map((r) => (
                  <tr
                    key={r.thesisId}
                    className="border-b border-pm-border last:border-0 hover:bg-pm-bg-search cursor-pointer"
                    onClick={() => setSelectedThesis(r)}
                  >
                    <td className="px-4 py-3 text-pm-text-primary">{r.title}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(r.finalProbability * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.outcome === 1
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {r.outcome === 1 ? "Correct" : "Incorrect"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${brierColor(r.brierScore)}`}>
                      {r.brierScore.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Probability Replay Chart */}
          {selectedThesis?.probabilities && selectedThesis.probabilities.length > 0 && (
            <div className="rounded-xl border border-pm-border bg-white p-6">
              <h3 className="text-sm font-semibold text-pm-text-primary mb-4">
                Probability Replay: {selectedThesis.title}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={selectedThesis.probabilities.map((p) => ({
                    date: new Date(p.timestamp).toLocaleDateString(),
                    probability: Math.round(p.probability * 1000) / 10,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Probability"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="probability"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-pm-muted">
                <span>
                  Outcome:{" "}
                  <span className={selectedThesis.outcome === 1 ? "text-green-600" : "text-red-600"}>
                    {selectedThesis.outcome === 1 ? "Correct" : "Incorrect"}
                  </span>
                </span>
                <span>Final: {(selectedThesis.finalProbability * 100).toFixed(1)}%</span>
                <span>Brier: {selectedThesis.brierScore.toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past Runs */}
      {pastRuns.length > 0 && (
        <div className="rounded-xl border border-pm-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-pm-border bg-pm-bg-search">
            <h2 className="text-lg font-semibold text-pm-text-primary">
              Past Runs ({pastRuns.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pm-border">
                <th className="text-left px-4 py-2 text-pm-muted font-medium">Name</th>
                <th className="text-left px-4 py-2 text-pm-muted font-medium">Date</th>
                <th className="text-right px-4 py-2 text-pm-muted font-medium">Accuracy</th>
                <th className="text-right px-4 py-2 text-pm-muted font-medium">Signals</th>
                <th className="text-left px-4 py-2 text-pm-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pastRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-pm-border last:border-0 hover:bg-pm-bg-search cursor-pointer"
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  <td className="px-4 py-2 text-pm-text-primary">{run.name}</td>
                  <td className="px-4 py-2 text-pm-text-secondary text-xs">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-2 text-right font-mono ${
                    run.accuracy != null
                      ? run.accuracy > 0.75 ? "text-green-600" : run.accuracy > 0.5 ? "text-yellow-600" : "text-red-600"
                      : "text-pm-muted"
                  }`}>
                    {run.accuracy != null ? `${(run.accuracy * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-pm-muted">
                    {run.correctSignals ?? 0}/{run.totalSignals ?? 0}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      run.status === "completed" ? "bg-green-100 text-green-700"
                      : run.status === "failed" ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expandedRun != null && (() => {
            const run = pastRuns.find((r) => r.id === expandedRun);
            const results = run?.results as { thesisResults?: ThesisResult[] } | null;
            if (!results?.thesisResults?.length) return null;
            return (
              <div className="border-t border-pm-border bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-pm-text-primary mb-2">
                  Per-Thesis Results — {run?.name}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-pm-muted">
                      <th className="text-left py-1">Thesis</th>
                      <th className="text-right py-1">Final Prob</th>
                      <th className="text-right py-1">Outcome</th>
                      <th className="text-right py-1">Brier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.thesisResults.map((tr) => (
                      <tr key={tr.thesisId} className="border-t border-pm-border">
                        <td className="py-1 text-pm-text-primary">{tr.title}</td>
                        <td className="py-1 text-right font-mono">
                          {(tr.finalProbability * 100).toFixed(1)}%
                        </td>
                        <td className="py-1 text-right">
                          <span className={tr.outcome === 1 ? "text-green-600" : "text-red-600"}>
                            {tr.outcome === 1 ? "Correct" : "Incorrect"}
                          </span>
                        </td>
                        <td className={`py-1 text-right font-mono ${brierColor(tr.brierScore)}`}>
                          {tr.brierScore.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Sweep Results */}
      {sweepResults && (
        <div className="rounded-xl border border-pm-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-pm-border bg-pm-bg-search">
            <h2 className="text-lg font-semibold text-pm-text-primary">
              Sweep Results ({sweepResults.length} combinations)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pm-border">
                  <th className="text-left px-4 py-2 text-pm-muted font-medium">#</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Brier</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Decay</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Model Wt</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Cross Cap</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Neutral</th>
                  <th className="text-right px-4 py-2 text-pm-muted font-medium">Theses</th>
                </tr>
              </thead>
              <tbody>
                {sweepResults.slice(0, 25).map((row) => (
                  <tr
                    key={row.rank}
                    className={`border-b border-pm-border last:border-0 ${
                      row.rank === 1 ? "bg-green-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-pm-text-primary font-medium">
                      {row.rank === 1 ? "🏆 1" : row.rank}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${brierColor(row.aggregateBrier)}`}>
                      {row.aggregateBrier.toFixed(4)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{row.params.decayRate}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.params.modelWeight}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.params.crossThesisCap}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.params.neutralFactor}</td>
                    <td className="px-4 py-2 text-right">{row.thesisCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sweepResults.length > 25 && (
            <div className="px-4 py-2 text-xs text-pm-muted border-t border-pm-border">
              Showing top 25 of {sweepResults.length} combinations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
