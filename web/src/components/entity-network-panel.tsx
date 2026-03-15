"use client";

import { useState } from "react";
import Link from "next/link";

interface Entity {
  id: number;
  name: string;
  type: string;
  category: string | null;
  description: string | null;
}

interface NetworkData {
  entity: Entity;
  connections: Array<{
    id: number;
    fromType: string;
    fromId: number;
    toType: string;
    toId: number;
    relation: string;
    reasoning: string | null;
    confidence: number;
  }>;
  neighbors: Entity[];
  relatedTheses: Array<{ id: number; title: string; direction: string }>;
  relatedNews: Array<{ id: number; title: string; url: string | null }>;
}

export function EntityNetworkPanel({
  entity,
  connCount,
  categoryColor,
}: {
  entity: Entity;
  connCount: number;
  categoryColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [network, setNetwork] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadNetwork() {
    if (network) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch(`/api/entities/${entity.id}/network`);
      const data = await res.json();
      setNetwork(data);
    } catch {
      setNetwork(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={loadNetwork}
        className={`text-xs px-2.5 py-1 rounded-full border border-transparent hover:border-gray-300 transition-colors cursor-pointer ${categoryColor}`}
      >
        {entity.name}
        {connCount > 0 && (
          <span className="ml-1 opacity-60">({connCount})</span>
        )}
      </button>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setExpanded(false)}>
          <div
            className="bg-white rounded-lg border border-pm-border shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-pm-text-primary">{entity.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor}`}>
                  {entity.category || entity.type}
                </span>
              </div>
              <button onClick={() => setExpanded(false)} className="text-pm-muted hover:text-pm-text-primary text-lg">
                &times;
              </button>
            </div>

            {loading && <p className="text-sm text-pm-muted">Loading network...</p>}

            {network && (
              <div className="space-y-4">
                {/* Neighbor entities */}
                {network.neighbors.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-pm-muted uppercase tracking-wide mb-1">
                      Connected Entities ({network.neighbors.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {network.neighbors.map((n) => (
                        <span key={n.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {n.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related theses */}
                {network.relatedTheses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-pm-muted uppercase tracking-wide mb-1">
                      Related Theses ({network.relatedTheses.length})
                    </h4>
                    <div className="space-y-1">
                      {network.relatedTheses.map((t) => (
                        <div key={t.id} className="text-sm flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${
                            t.direction === "bullish"
                              ? "text-green-700 border-green-300 bg-green-50"
                              : t.direction === "bearish"
                              ? "text-red-700 border-red-300 bg-red-50"
                              : "text-yellow-700 border-yellow-300 bg-yellow-50"
                          }`}>
                            {t.direction.toUpperCase()}
                          </span>
                          <span className="text-pm-text-primary">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related news */}
                {network.relatedNews.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-pm-muted uppercase tracking-wide mb-1">
                      Related News ({network.relatedNews.length})
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {network.relatedNews.slice(0, 10).map((n) => (
                        <div key={n.id} className="text-sm text-pm-text-primary">
                          {n.url ? (
                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                              {n.title}
                            </a>
                          ) : (
                            n.title
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deep dive link */}
                <div className="pt-2 border-t border-pm-border">
                  <Link
                    href={`/entities/${entity.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    View full page &rarr;
                  </Link>
                </div>

                {/* Connection details */}
                {network.connections.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-pm-muted uppercase tracking-wide mb-1">
                      All Connections ({network.connections.length})
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {network.connections.slice(0, 15).map((c) => (
                        <div key={c.id} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="text-gray-400">{c.fromType}:{c.fromId}</span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">{c.relation}</span>
                          <span className="text-gray-400">{c.toType}:{c.toId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
