"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkline } from "@/components/sparkline";

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

const PATTERN_BORDER: Record<string, string> = {
  convergence: "border-green-600",
  divergence: "border-red-600",
  acceleration: "border-pm-blue",
  reversal: "border-orange-500",
};

const PATTERN_DOT: Record<string, string> = {
  convergence: "bg-green-600",
  divergence: "bg-red-600",
  acceleration: "bg-pm-blue",
  reversal: "bg-orange-500",
};

const SENTIMENT_DOT: Record<string, string> = {
  bullish: "bg-pm-green",
  bearish: "bg-pm-red",
  neutral: "bg-pm-muted",
};

function relativeTime(date: Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ─── 1. Status Bar ─── */
function StatusBar({
  theses,
  clusters,
}: {
  theses: Thesis[];
  clusters: SignalCluster[];
}) {
  const bullish = theses.filter((t) => t.direction === "bullish").length;
  const bearish = theses.filter((t) => t.direction === "bearish").length;
  const neutral = theses.length - bullish - bearish;
  const total = theses.length || 1;
  const bullPct = (bullish / total) * 100;
  const bearPct = (bearish / total) * 100;
  const neutPct = (neutral / total) * 100;

  const momValues = theses
    .map((t) => t.momentum)
    .filter((m): m is number => m !== null);
  const netMomentum =
    momValues.length > 0
      ? momValues.reduce((a, b) => a + b, 0) / momValues.length
      : 0;
  const netMomPct = Math.round(Math.abs(netMomentum * 100));

  const uniquePatterns = [...new Set(clusters.map((c) => c.pattern))];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* Active Theses */}
      <div className="rounded-xl border border-pm-border px-4 py-3">
        <div className="text-xs font-medium text-pm-text-meta">Active Theses</div>
        <div className="mt-1 text-2xl font-bold text-pm-text-primary">
          {theses.length}
        </div>
      </div>

      {/* Bull / Bear Split */}
      <div className="rounded-xl border border-pm-border px-4 py-3">
        <div className="text-xs font-medium text-pm-text-meta">Bull / Bear</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-pm-green">{bullish}</span>
          <span className="text-pm-text-meta">/</span>
          <span className="text-lg font-bold text-pm-red">{bearish}</span>
        </div>
        <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-pm-bg-search">
          <div className="bg-pm-green" style={{ width: `${bullPct}%` }} />
          <div className="bg-pm-red" style={{ width: `${bearPct}%` }} />
          <div className="bg-pm-muted" style={{ width: `${neutPct}%` }} />
        </div>
      </div>

      {/* Active Clusters */}
      <div className="rounded-xl border border-pm-border px-4 py-3">
        <div className="text-xs font-medium text-pm-text-meta" title="Groups of related signals that form a pattern">Signal Patterns</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-bold text-pm-text-primary">
            {clusters.length}
          </span>
          <div className="flex gap-1">
            {uniquePatterns.map((p) => (
              <span
                key={p}
                className={`inline-block h-2.5 w-2.5 rounded-full ${PATTERN_DOT[p] || "bg-pm-muted"}`}
                title={p}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Net Momentum */}
      <div className="rounded-xl border border-pm-border px-4 py-3">
        <div className="text-xs font-medium text-pm-text-meta" title="Average directional trend across all theses">Market Trend</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={`text-2xl font-bold ${
              netMomentum > 0
                ? "text-pm-green"
                : netMomentum < 0
                  ? "text-pm-red"
                  : "text-pm-muted"
            }`}
          >
            {netMomentum > 0 ? "▲" : netMomentum < 0 ? "▼" : "—"}
          </span>
          <span
            className={`text-lg font-bold ${
              netMomentum > 0
                ? "text-pm-green"
                : netMomentum < 0
                  ? "text-pm-red"
                  : "text-pm-muted"
            }`}
          >
            {netMomPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── 2. Intelligence Briefing ─── */
function IntelligenceBriefing({
  news,
  clusters,
}: {
  news: NewsEvent[];
  clusters: SignalCluster[];
}) {
  if (news.length === 0 && clusters.length === 0) return null;

  // Sentiment distribution for news bar
  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  news.forEach((n) => {
    const s = n.sentiment as keyof typeof sentimentCounts;
    if (s && s in sentimentCounts) sentimentCounts[s]++;
    else sentimentCounts.neutral++;
  });
  const newsTotal = news.length || 1;

  return (
    <section className="mb-6 rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-4 text-sm font-bold text-pm-text-primary">
        Latest Signals
      </h2>

      {/* 2a: Signal Clusters as visual cards */}
      {clusters.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.slice(0, 6).map((cluster) => {
            const confPct = Math.round(cluster.confidence * 100);
            return (
              <div
                key={cluster.id}
                className={`rounded-lg border border-pm-border border-l-4 p-3 ${
                  PATTERN_BORDER[cluster.pattern] || "border-l-pm-muted"
                }`}
              >
                <p className="truncate text-sm font-semibold text-pm-text-primary">
                  {cluster.title}
                </p>
                {/* Confidence bar */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-pm-bg-search">
                  <div
                    className="h-full rounded-full bg-pm-blue"
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-pm-text-meta">
                  {cluster.thesisIds && (
                    <span>{cluster.thesisIds.length} theses</span>
                  )}
                  {cluster.entityIds && (
                    <span>{cluster.entityIds.length} entities</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2b: News */}
      {news.length > 0 && (
        <div>
          {/* Sentiment summary bar */}
          <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-pm-bg-search">
            <div
              className="bg-pm-green"
              style={{ width: `${(sentimentCounts.bullish / newsTotal) * 100}%` }}
            />
            <div
              className="bg-pm-red"
              style={{ width: `${(sentimentCounts.bearish / newsTotal) * 100}%` }}
            />
            <div
              className="bg-pm-muted"
              style={{ width: `${(sentimentCounts.neutral / newsTotal) * 100}%` }}
            />
          </div>

          {/* Condensed list */}
          <div className="space-y-1">
            {news.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-2 py-1"
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    SENTIMENT_DOT[event.sentiment || "neutral"] || "bg-pm-muted"
                  }`}
                />
                <p className="min-w-0 flex-1 truncate text-sm text-pm-text-primary">
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
                {event.source && (
                  <span className="shrink-0 text-xs text-pm-text-meta">
                    {event.source}
                  </span>
                )}
                <span className="shrink-0 text-xs text-pm-text-meta">
                  {relativeTime(event.publishedAt || event.ingestedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── 3. Thesis Card (enhanced) ─── */
function ThesisCard({
  thesis,
  maxSignalCount,
  sparkline,
}: {
  thesis: Thesis;
  maxSignalCount: number;
  sparkline?: Array<{ probability: number; computedAt: Date }>;
}) {
  const pct = Math.round(thesis.probability * 100);
  const gaugeColor =
    thesis.direction === "bullish"
      ? "#30A159"
      : thesis.direction === "bearish"
        ? "#E23939"
        : "#77808D";

  // Semicircle gauge: conic-gradient for 180deg arc
  const fillDeg = (pct / 100) * 180;
  const gaugeStyle = {
    width: 80,
    height: 40,
    borderRadius: "80px 80px 0 0",
    background: `conic-gradient(from 180deg, ${gaugeColor} ${fillDeg}deg, #F4F5F6 ${fillDeg}deg 180deg, transparent 180deg 360deg)`,
  };

  // Momentum bar
  const mom = thesis.momentum ?? 0;
  const momMag = Math.min(Math.abs(mom) * 100, 50); // cap at 50%

  // Signal density bar
  const signalPct = maxSignalCount > 0 ? (thesis.signalCount / maxSignalCount) * 100 : 0;

  return (
    <Link href={`/thesis/${thesis.thesisId}`}>
      <div className="group relative cursor-pointer overflow-hidden rounded-[15px] border border-pm-border p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-start justify-between">
          <span className="rounded-full bg-pm-bg-search px-2.5 py-0.5 text-xs font-medium text-pm-text-secondary">
            {thesis.domain}
          </span>
        </div>

        <h3 className="mb-4 line-clamp-2 text-sm font-semibold text-pm-text-primary group-hover:text-pm-blue">
          {thesis.title}
        </h3>

        {/* Semicircle gauge */}
        <div className="mb-1 flex flex-col items-center">
          <div className="relative" style={gaugeStyle}>
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-bold"
              style={{ color: gaugeColor }}
            >
              {pct}%
            </div>
          </div>
          {/* Momentum directional bar */}
          <div className="mt-2 flex h-[3px] w-full items-center">
            <div className="relative h-full w-full rounded-full bg-pm-bg-search">
              {mom !== 0 && (
                <div
                  className={`absolute top-0 h-full rounded-full ${mom > 0 ? "bg-pm-green" : "bg-pm-red"}`}
                  style={{
                    width: `${momMag}%`,
                    ...(mom > 0
                      ? { left: "50%" }
                      : { right: "50%" }),
                  }}
                />
              )}
              <div className="absolute left-1/2 top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-pm-text-meta" />
            </div>
          </div>
        </div>

        {/* Sparkline */}
        {sparkline && sparkline.length >= 2 && (
          <div className="mt-2 flex justify-center">
            <Sparkline data={sparkline} direction={thesis.direction} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-pm-text-meta">
          <div className="flex items-center gap-2">
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

        {/* Signal density bar at bottom */}
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-pm-bg-search">
          <div
            className="h-full rounded-full bg-pm-blue/40"
            style={{ width: `${signalPct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

/* ─── 4. Trending Sidebar (enhanced) ─── */
function TrendingSidebar({ trending }: { trending: Thesis[] }) {
  if (trending.length === 0) return null;

  return (
    <div className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-4 text-sm font-bold text-pm-text-primary">Trending</h2>
      <div className="space-y-3">
        {trending.map((t, i) => {
          const pct = Math.round(t.probability * 100);
          return (
            <Link
              key={t.thesisId}
              href={`/thesis/${t.thesisId}`}
              className="group flex items-start gap-3"
            >
              <span className="mt-0.5 text-sm font-bold text-pm-text-meta">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-pm-text-primary group-hover:text-pm-blue">
                  {t.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-xs font-bold ${directionColor(t.direction)}`}>
                    {pct}%
                  </span>
                  {/* Probability bar */}
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-pm-bg-search">
                    <div
                      className="h-full rounded-full bg-pm-blue"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 5. Gaps & Opportunities (bar chart) ─── */
function GapsSection({ uncovered }: { uncovered: UncoveredEntity[] }) {
  if (uncovered.length === 0) return null;

  const sorted = [...uncovered].sort((a, b) => b.signalCount - a.signalCount);
  const maxSignals = sorted[0]?.signalCount || 1;
  const shown = sorted.slice(0, 8);
  const overflow = uncovered.length - shown.length;

  return (
    <section className="rounded-[15px] border border-pm-border p-5">
      <h2 className="mb-3 text-sm font-bold text-pm-text-primary">
        Gaps &amp; Opportunities
      </h2>
      <div className="space-y-2">
        {shown.map((item) => (
          <div key={item.entity.id} className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-sm font-medium text-pm-text-primary">
              {item.entity.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-pm-bg-search">
              <div
                className="h-full rounded-full bg-pm-blue"
                style={{ width: `${(item.signalCount / maxSignals) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-pm-text-meta">
              {item.signalCount}
            </span>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <Link
          href="/graph"
          className="mt-3 inline-block text-xs text-pm-blue hover:underline"
        >
          +{overflow} more
        </Link>
      )}
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
  sparklineData,
}: {
  theses: Thesis[];
  trending: Thesis[];
  domains: string[];
  recentNews: NewsEvent[];
  activeClusters: SignalCluster[];
  uncoveredEntities: UncoveredEntity[];
  sparklineData?: Record<number, Array<{ probability: number; computedAt: Date }>>;
}) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  // Onboarding empty state when no theses exist
  if (theses.length === 0) {
    const steps = [
      {
        title: "Create your first thesis",
        description: "Define an investment hypothesis to start tracking signals.",
        href: "/thesis",
      },
      {
        title: "Fetch news signals",
        description: "Import news and data to build your knowledge graph.",
        href: "/ops",
      },
      {
        title: "Generate recommendations",
        description: "Get actionable picks based on your theses and signals.",
        href: "/recommendations",
      },
    ];
    return (
      <div className="rounded-[15px] border border-pm-border p-8">
        <h2 className="text-lg font-bold text-pm-text-primary">Getting Started</h2>
        <p className="mt-2 text-sm text-pm-muted">
          Set up your signal tracker in three steps.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Link
              key={step.href}
              href={step.href}
              className="group rounded-xl border border-pm-border p-5 transition-shadow hover:shadow-md"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-pm-blue text-sm font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-pm-text-primary group-hover:text-pm-blue">
                {step.title}
              </h3>
              <p className="mt-1 text-xs text-pm-muted">{step.description}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const filtered = activeDomain
    ? theses.filter((t) => t.domain === activeDomain)
    : theses;

  const maxSignalCount = Math.max(...theses.map((t) => t.signalCount), 1);

  return (
    <div>
      {/* 1. Status Bar */}
      <StatusBar theses={theses} clusters={activeClusters} />

      {/* 2. Intelligence Briefing */}
      <IntelligenceBriefing news={recentNews} clusters={activeClusters} />

      {/* 3. Your Theses */}
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
            <div className="py-12 text-center">
              <p className="text-pm-text-primary font-medium">
                No active theses{activeDomain ? ` in ${activeDomain}` : ""}
              </p>
              <p className="mt-2 text-sm text-pm-muted">
                Theses are your investment hypotheses.{" "}
                <Link href="/thesis" className="text-pm-blue hover:underline">
                  Create your first thesis
                </Link>{" "}
                to start tracking signals and generating recommendations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <ThesisCard
                  key={t.thesisId}
                  thesis={t}
                  maxSignalCount={maxSignalCount}
                  sparkline={sparklineData?.[t.thesisId]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hidden w-72 shrink-0 space-y-4 lg:block">
          <TrendingSidebar trending={trending} />
          <GapsSection uncovered={uncoveredEntities} />
        </div>
      </div>
    </div>
  );
}
