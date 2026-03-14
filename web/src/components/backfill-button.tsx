"use client";

import { useState } from "react";

export function BackfillButton() {
  const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success?: boolean;
            entitiesUpserted?: number;
                eventsScanned?: number;
                    error?: string;
                      } | null>(null);

                        async function handleBackfill() {
                            setLoading(true);
                                setResult(null);
                                    try {
                                          const res = await fetch("/api/graph/backfill", { method: "POST" });
                                                const data = await res.json();
                                                      setResult(data);
                                                          } catch (err) {
                                                                setResult({ error: "Network error" });
                                                                    } finally {
                                                                          setLoading(false);
                                                                              }
                                                                                }

                                                                                  return (
                                                                                      <div className="flex items-center gap-3">
                                                                                            <button
                                                                                                    onClick={handleBackfill}
                                                                                                            disabled={loading}
                                                                                                                    className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-wait transition-colors"
                                                                                                                          >
                                                                                                                                  {loading ? "Backfilling..." : "Backfill Entities"}
                                                                                                                                        </button>
                                                                                                                                              {result && (
                                                                                                                                                      <span className="text-xs text-zinc-400">
                                                                                                                                                                {result.success
                                                                                                                                                                            ? `Done: ${result.entitiesUpserted} entities from ${result.eventsScanned} events`
                                                                                                                                                                                        : result.error || "Failed"}
                                                                                                                                                                                                </span>
                                                                                                                                                                                                      )}
                                                                                                                                                                                                          </div>
                                                                                                                                                                                                            );
                                                                                                                                                                                                            }
