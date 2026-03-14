"use client";

import Link from "next/link";
import { useState } from "react";

type Thesis = {
  thesisId: number;
  title: string;
  direction: string;
  domain: string;
  tags: string[];
  probability: number;
  momentum: number | null;
  signalCount: number;
  computedAt: Date | null;
};

type NewsEvent = {
  id: number;
  title: string;
  url: string | null;
  source: string | null;
  sentiment: string | null;
  aiRelevance: number | null;
  publishedAt: Date | null;
  ingestedAt: Date;
  processed: boolean;
  extractedEntities: string[] | null;
  extractedThesisIds: number[] | null;
};

type SignalCluster = {
  id: number;
  title: string;
  description: string;
  pattern: string;
  confidence: number;
  status: string;
  connectionIds: number[] | null;
  entityIds: number[] | null;
  thesisIds: number[] | null;
  detectedAt: Date;
};

type UncoveredEntity = {
  entity: {
    id: number;
    name: string;
    category: string | null;
    type: string;
    [key: string]: unknown;
  };
  signalCount: number;
};

function directionColor(direction: string) {
  if (direction === "bullish") return "text-pm-green";
  if (direction === "bearish") return "text-pm-red";
  return "text-pm-muted";
}

function directionBg(direction: string) {
  if (direction === "bullish") return "bg-pm-green/10 text-pm-green";
  if (direction === "bearish") return "bg-pm-red/10 text-pm-red";
  return "bg-pm-bg-search text-pm-muted";
}

function MomentumBadge({ momentum }: { momentum: number | null }) {
  if (momentum === null || momentum === 0) return null;
  const up = momentum > 0;
  return (
    <span
      className={`text-xs font-medium ${up ? "text-pm-green" : "text-pm-red"}`}
    >
      {up ? "\u25B2" : "\u25BC"} {Math.abs(Math.round(momentum * 100))}%
    </span>
  );
}

const SENTIMENT_COLORS: Record<string, string> = {
  bullish: "text-green-700 bg-green-50 border-green-200",
  bearish: "text-red-700 bg-red-50 border-red-200",
  neutral: "text-yellow-700 bg-yellow-50 border-yellow-200",
};

const PATTERN_STYLES: Record<string, string> = {
  convergence: "bg-green-50 text-green-800 border-green-200",
  divergence: "bg-red-50 text-red-800 border-red-200",
  acceleration: "bg-blue-50 text-blue-800 border-blue-200",
  reversal: "bg-orange-50 text-orange-800 border-orange-200",
};

function ThesisCard({ thesis }: { thesis: Thesis }) {
  const pct = Math.round(thesis.probability * 100);

  return (
    <Link href={`/thesis/${thesis.thesisId}`}>
      <div className="group cursor-pointer rounded-[15px] border border-pm-border p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-start justify-between">
          <span className="rounded-full bg-pm-bg-search px-2.5 py-0.5 text-xs font-medium text-pm-text-secondary">
            {thesis.domain}
          </span>
        </div>

        <h3 className="mb-4 line-clamp-2 text-sm font-semibold text-pm-text-primary group-hover:text-pm-blue">
          {thesis.title}
        </h3>

        <div className="mb-3 text-center">
          <div className={`text-4xl font-bold ${directionColor(thesis.direction)}`}>
            {pct}%
          </div>
          <div className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${directionBg(thesis.direction)}`}>
            {thesis.direction}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-pm-border pt-3 text-xs text-pm-text-meta">
          <div className="flex items-center gap-2">
            <MomentumBadge momentum={thesis.momentum} />
            {thesis.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-pm-bg-search px-2 py-0.5 text-pm-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
          <span>{thesis.signalCount} signals</span>
        </div>
      </div>
    </Link>
  );
}

function TrendingSidebar({ trending }: { trending: Thesis[] }) {
  if (trending.length === 0) return null;

  return (
    <div className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-4 text-sm font-bold text-pm-text-primary">Trending</h2>
      <div className="space-y-4">
        {trending.map((t, i) => {
          const pct = Math.round(t.probability * 100);
          return (
            <Link
              key={t.thesisId}
              href={`/thesis/${t.thesisId}`}
              className="flex items-start gap-3 group"
            >
              <span className="mt-0.5 text-sm font-bold text-pm-text-meta">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-pm-text-primary group-hover:text-pm-blue">
                  {t.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`text-sm font-bold ${directionColor(t.direction)}`}>
                    {pct}%
                  </span>
                  <MomentumBadge momentum={t.momentum} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section A: Recent Signals ─── */
function RecentSignals({
  news,
  clusters,
}: {
  news: NewsEvent[];
  clusters: SignalCluster[];
}) {
  if (news.length === 0 && clusters.length === 0) return null;

  return (
    <section className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-4 text-sm font-bold text-pm-text-primary">
        Since You Were Last Here
      </h2>

      {/* Active clusters */}
      {clusters.length > 0 && (
        <div className="mb-4 space-y-2">
          {clusters.slice(0, 3).map((cluster) => (
            <div
              key={cluster.id}
              className="flex items-center gap-3 rounded-lg border border-pm-border bg-pm-bg-search p-3"
            >
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold border ${
                  PATTERN_STYLES[cluster.pattern] || PATTERN_STYLES.convergence
                }`}
              >
                {cluster.pattern.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pm-text-primary">
                  {cluster.title}
                </p>
                <p className="truncate text-xs text-pm-text-secondary">
                  {cluster.description}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-pm-text-primary">
                {Math.round(cluster.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent news events */}
      {news.length > 0 && (
        <div className="space-y-1.5">
          {news.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 py-1.5"
            >
              {event.sentiment && (
                <span
                  className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    SENTIMENT_COLORS[event.sentiment] || SENTIMENT_COLORS.neutral
                  }`}
                >
                  {event.sentiment}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-pm-text-primary leading-snug">
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-pm-blue transition-colors"
                    >
                      {event.title}
                    </a>
                  ) : (
                    event.title
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-pm-text-meta">
                  {event.source && <span>{event.source}</span>}
                  {(event.extractedThesisIds?.length ?? 0) > 0 && (
                    <span className="text-pm-blue">
                      {event.extractedThesisIds!.length} thesis
                      {event.extractedThesisIds!.length > 1 ? " links" : " link"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Section C: Gaps & Opportunities ─── */
function GapsSection({ uncovered }: { uncovered: UncoveredEntity[] }) {
  if (uncovered.length === 0) return null;

  return (
    <section className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-3 text-sm font-bold text-pm-text-primary">
        Gaps &amp; Opportunities
      </h2>
      <p className="mb-3 text-xs text-pm-text-secondary">
        Entities with signals but no thesis coverage
      </p>
      <div className="flex flex-wrap gap-2">
        {uncovered.slice(0, 12).map((item) => (
          <span
            key={item.entity.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-pm-border bg-pm-bg-search px-3 py-1"
          >
            <span className="text-sm font-medium text-pm-text-primary">
              {item.entity.name}
            </span>
            <span className="text-xs text-pm-text-meta">
              {item.signalCount} signals
            </span>
          </span>
        ))}
        {uncovered.length > 12 && (
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-full border border-pm-border px-3 py-1 text-xs text-pm-blue hover:bg-pm-bg-search"
          >
            +{uncovered.length - 12} more
          </Link>
        )}
      </div>
    </section>
  );
}

export function HomeGrid({
  theses,
  trending,
  domains,
  recentNews,
  activeClusters,
  uncoveredEntities,
}: {
  theses: Thesis[];
  trending: Thesis[];
  domains: string[];
  recentNews: NewsEvent[];
  activeClusters: SignalCluster[];
  uncoveredEntities: UncoveredEntity[];
}) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const filtered = activeDomain
    ? theses.filter((t) => t.domain === activeDomain)
    : theses;

  return (
    <div>
      {/* Section A: Intelligence Briefing */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <RecentSignals news={recentNews} clusters={activeClusters} />
        <GapsSection uncovered={uncoveredEntities} />
      </div>

      {/* Section B: Your Theses */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-pm-text-primary">Your Theses</h2>
      </div>

      {/* Category pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveDomain(null)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeDomain === null
              ? "bg-pm-text-primary text-white"
              : "bg-pm-bg-search text-pm-text-secondary hover:text-pm-text-primary"
          }`}
        >
          All
        </button>
        {domains.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDomain(activeDomain === d ? null : d)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeDomain === d
                ? "bg-pm-text-primary text-white"
                : "bg-pm-bg-search text-pm-text-secondary hover:text-pm-text-primary"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Grid + sidebar */}
      <div className="flex gap-6">
        {/* Card grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-pm-text-secondary">
              No active theses{activeDomain ? ` in ${activeDomain}` : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <ThesisCard key={t.thesisId} thesis={t} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden w-72 shrink-0 lg:block">
          <TrendingSidebar trending={trending} />

          {/* Stats card */}
          <div className="mt-4 rounded-[15px] border border-pm-border p-5">
            <h2 className="mb-3 text-sm font-bold text-pm-text-primary">
              Overview
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-pm-text-secondary">Active theses</span>
                <span className="font-medium text-pm-text-primary">
                  {theses.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-pm-text-secondary">Bullish</span>
                <span className="font-medium text-pm-green">
                  {theses.filter((t) => t.direction === "bullish").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-pm-text-secondary">Bearish</span>
                <span className="font-medium text-pm-red">
                  {theses.filter((t) => t.direction === "bearish").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-pm-text-secondary">Neutral</span>
                <span className="font-medium text-pm-muted">
                  {theses.filter((t) => t.direction === "neutral").length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
