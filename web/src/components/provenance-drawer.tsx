"use client";

import { useState } from "react";

interface ProvenanceData {
  recommendation: {
    id: number;
    action: string;
    asset: string;
    ticker: string | null;
    conviction: number;
    rationale: string;
  };
  thesis: {
    id: number;
    title: string;
    direction: string;
    domain: string;
  } | null;
  connections: {
    id: number;
    relation: string;
    direction: string | null;
    confidence: number;
    reasoning: string | null;
    sourceNewsId: number | null;
  }[];
  sourceNews: {
    id: number;
    title: string;
    url: string | null;
    source: string | null;
    publishedAt: string | null;
    sentiment: string | null;
  }[];
  relatedEntities: {
    id: number;
    name: string;
    type: string;
    category: string | null;
  }[];
}

export function ProvenanceDrawer({ recId }: { recId: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProvenanceData | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations/${recId}/provenance`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to load provenance:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleOpen}
        className="text-xs text-pm-blue hover:underline"
      >
        {open ? "Hide provenance" : "Show provenance"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-pm-border bg-gray-50 p-3 text-xs">
          {loading && (
            <p className="text-pm-muted">Loading provenance chain...</p>
          )}

          {data && (
            <div className="space-y-3">
              {/* Thesis */}
              {data.thesis && (
                <div>
                  <p className="font-semibold text-pm-text-primary">
                    Thesis: {data.thesis.title}
                  </p>
                  <p className="text-pm-muted">
                    Direction: {data.thesis.direction} | Domain:{" "}
                    {data.thesis.domain}
                  </p>
                </div>
              )}

              {/* Signal count */}
              <p className="text-pm-text-secondary">
                {data.connections.length} signal
                {data.connections.length !== 1 ? "s" : ""} connected
              </p>

              {/* Top news sources */}
              {data.sourceNews.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-pm-text-primary">
                    Source News ({data.sourceNews.length})
                  </p>
                  <ul className="space-y-1">
                    {data.sourceNews.slice(0, 5).map((n) => (
                      <li key={n.id} className="text-pm-text-secondary">
                        {n.url ? (
                          <a
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pm-blue hover:underline"
                          >
                            {n.title}
                          </a>
                        ) : (
                          n.title
                        )}
                        {n.source && (
                          <span className="ml-1 text-pm-muted">
                            ({n.source})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related entities */}
              {data.relatedEntities.length > 0 && (
                <div>
                  <p className="mb-1 font-medium text-pm-text-primary">
                    Related Entities
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {data.relatedEntities.map((e) => (
                      <span
                        key={e.id}
                        className="rounded-full border border-pm-border bg-white px-2 py-0.5 text-pm-text-secondary"
                      >
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
