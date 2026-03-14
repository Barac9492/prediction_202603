"use client";

import { useEffect, useState, useCallback } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

interface Snapshot {
    id: number;
    thesisId: number;
    probability: number;
    bullishWeight: number;
    bearishWeight: number;
    neutralWeight: number;
    signalCount: number;
    momentum: number | null;
    computedAt: string;
}

interface Thesis {
    id: number;
    title: string;
    description: string | null;
    direction: string | null;
    tags: string[] | null;
    isActive: boolean;
}

interface ThesisWithProbability extends Thesis {
    latestSnapshot: Snapshot | null;
    history: Snapshot[];
}

function getProbabilityColor(prob: number): string {
    if (prob >= 0.65) return "#22c55e";
    if (prob >= 0.35) return "#eab308";
    return "#ef4444";
}

function getProbabilityLabel(prob: number, direction: string | null): string {
    if (direction === "bearish") {
          if (prob >= 0.75) return "Strong Bear";
          if (prob >= 0.55) return "Bearish";
          if (prob >= 0.45) return "Neutral";
          if (prob >= 0.25) return "Weak Bear";
          return "Unlikely";
    }
    if (prob >= 0.75) return "Strong Bull";
    if (prob >= 0.55) return "Bullish";
    if (prob >= 0.45) return "Neutral";
    if (prob >= 0.25) return "Weak";
    return "Unlikely";
}

function MomentumBadge({ momentum }: { momentum: number | null }) {
    if (momentum === null || momentum === 0) {
          return <span className="text-gray-400 text-sm">no change</span>span>;
    }
    const isUp = momentum > 0;
    const pct = Math.abs(Math.round(momentum * 100));
    return (
          <span className={`text-sm font-medium ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "up" : "down"} {pct}%
          </span>span>
        );
}

function ProbabilityGauge({ probability, direction }: { probability: number; direction: string | null }) {
    const pct = Math.round(probability * 100);
    const color = getProbabilityColor(probability);
    return (
          <div className="flex flex-col items-center justify-center py-2">
                <div className="text-5xl font-bold tabular-nums" style={{ color }}>
                  {pct}%
                </div>div>
                <div className="text-sm mt-1 font-medium" style={{ color }}>
                  {getProbabilityLabel(probability, direction)}
                </div>div>
          </div>div>
        );
}

function ThesisCard({ thesis }: { thesis: ThesisWithProbability }) {
    const snap = thesis.latestSnapshot;
    const history = thesis.history;
    const prob = snap?.probability ?? 0.5;
    const color = getProbabilityColor(prob);
  
    const chartData = history.map((s, idx) => ({
          date: new Date(s.computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          dateKey: `${new Date(s.computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}-${idx}`,
          probability: Math.round(s.probability * 100),
    }));
  
    return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 text-base leading-snug">{thesis.title}</h3>h3>
                          {thesis.description && (
                        <p className="text-gray-500 text-sm mt-1 line-clamp-2">{thesis.description}</p>p>
                                  )}
                        </div>div>
                  {snap ? (
                      <div className="shrink-0"><ProbabilityGauge probability={prob} direction={thesis.direction} /></div>div>
                    ) : (
                      <div className="shrink-0 text-gray-400 text-sm py-2">No data yet</div>div>
                        )}
                </div>div>
          
                <div className="flex flex-wrap gap-2 items-center">
                  {thesis.direction && (
                      <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                                    background: thesis.direction === "bullish" ? "#dcfce7" : thesis.direction === "bearish" ? "#fee2e2" : "#f3f4f6",
                                                    color: thesis.direction === "bullish" ? "#16a34a" : thesis.direction === "bearish" ? "#dc2626" : "#6b7280",
                                    }}
                                  >
                        {thesis.direction.charAt(0).toUpperCase() + thesis.direction.slice(1)}
                      </span>span>
                        )}
                  {(thesis.tags ?? []).map((tag) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{tag}</span>span>
                    ))}
                  {snap && (
                      <span className="text-xs text-gray-400 ml-auto">{snap.signalCount} signal{snap.signalCount !== 1 ? "s" : ""}</span>span>
                        )}
                </div>div>
          
            {snap && (
                    <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">Momentum:</span>span>
                              <MomentumBadge momentum={snap.momentum} />
                    </div>div>
                )}
          
            {chartData.length > 1 ? (
                    <div className="h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                                        <defs>
                                                                        <linearGradient id={"grad" + thesis.id} x1="0" y1="0" x2="0" y2="1">
                                                                                          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                                                                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                                                                        </linearGradient>linearGradient>
                                                        </defs>defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                        <XAxis
                                                                          dataKey="date"
                                                                          tick={{ fontSize: 10 }}
                                                                          interval="preserveStartEnd"
                                                                          tickFormatter={(value, index) => {
                                                                                              if (index === 0 || index === chartData.length - 1) return value;
                                                                                              if (chartData.length <= 5) return value;
                                                                                              return index % Math.ceil(chartData.length / 4) === 0 ? value : "";
                                                                          }}
                                                                        />
                                                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                                        <Tooltip
                                                                          formatter={(value) => [String(value) + "%", "Probability"]}
                                                                          contentStyle={{ fontSize: 12 }}
                                                                        />
                                                        <Area
                                                                          type="monotone"
                                                                          dataKey="probability"
                                                                          stroke={color}
                                                                          strokeWidth={2}
                                                                          fill={"url(#grad" + thesis.id + ")"}
                                                                        />
                                          </AreaChart>AreaChart>
                              </ResponsiveContainer>ResponsiveContainer>
                    </div>div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                      {chartData.length === 1 ? "Run compute again to see trend" : "No probability data yet"}
                    </div>div>
                )}
          </div>div>
        );
}

export default function PredictionsPage() {
    const [theses, setTheses] = useState<ThesisWithProbability[]>([]);
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [lastComputed, setLastComputed] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
  
    const fetchData = useCallback(async () => {
          setLoading(true);
          setError(null);
          try {
                  const res = await fetch("/api/theses");
                  if (!res.ok) throw new Error("Failed to fetch theses");
                  const all: Thesis[] = await res.json();
                  const active = all.filter((t) => t.isActive);
            
                  const withHistory = await Promise.all(
                            active.map(async (t) => {
                                        try {
                                                      const hr = await fetch("/api/theses/" + t.id + "/probability");
                                                      const history: Snapshot[] = hr.ok ? await hr.json() : [];
                                                      return { ...t, latestSnapshot: history.length > 0 ? history[history.length - 1] : null, history };
                                        } catch {
                                                      return { ...t, latestSnapshot: null, history: [] };
                                        }
                            })
                          );
            
                  withHistory.sort((a, b) => (b.latestSnapshot?.probability ?? 0) - (a.latestSnapshot?.probability ?? 0));
                  setTheses(withHistory);
          } catch (e) {
                  setError(String(e));
          } finally {
                  setLoading(false);
          }
    }, []);
  
    useEffect(() => { fetchData(); }, [fetchData]);
  
    const handleCompute = async () => {
          setComputing(true);
          setError(null);
          try {
                  const res = await fetch("/api/theses/compute-probabilities", { method: "POST" });
                  if (!res.ok) throw new Error("Compute failed");
                  const data = await res.json();
                  setLastComputed(new Date().toLocaleTimeString() + " (" + data.computed + " theses)");
                  await fetchData();
          } catch (e) {
                  setError(String(e));
          } finally {
                  setComputing(false);
          }
    };
  
    return (
          <main className="max-w-5xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-8">
                        <div>
                                  <h1 className="text-2xl font-bold text-gray-900">Probability Tracker</h1>h1>
                                  <p className="text-gray-500 text-sm mt-1">News-signal weighted probability for each active thesis</p>p>
                        </div>div>
                        <div className="flex flex-col items-end gap-1">
                                  <button
                                                onClick={handleCompute}
                                                disabled={computing}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                              >
                                    {computing ? "Computing..." : "Compute Probabilities"}
                                  </button>button>
                          {lastComputed && <span className="text-xs text-gray-400">Last run: {lastComputed}</span>span>}
                        </div>div>
                </div>div>
          
            {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>div>
                )}
          
            {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((i) => <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />)}
                    </div>div>
                  ) : theses.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                              <p className="text-lg">No active theses found.</p>p>
                              <p className="text-sm mt-2">Create and activate theses from the <a href="/thesis" className="text-blue-500 underline">Thesis page</a>a>.</p>p>
                    </div>div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {theses.map((t) => <ThesisCard key={t.id} thesis={t} />)}
                    </div>div>
                )}
          </main>main>
        );
}</span>
