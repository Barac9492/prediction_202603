"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const FeedPage = dynamic(() => import("@/app/feed/page"), { ssr: false });
const AnalyzePage = dynamic(() => import("@/app/analyze/page"), { ssr: false });
const BacktestPage = dynamic(() => import("@/app/backtest/page"), {
  ssr: false,
});

const tabs = [
  { id: "feed", label: "Feed" },
  { id: "analyze", label: "Analyze" },
  { id: "backtest", label: "Backtest" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("feed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pm-text-primary">Operations</h1>
        <p className="mt-1 text-sm text-pm-muted">
          Pipeline management, analysis, and parameter tuning
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-pm-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-lg px-5 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-pm-blue text-pm-blue"
                : "text-pm-muted hover:text-pm-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "feed" && <FeedPage />}
        {activeTab === "analyze" && <AnalyzePage />}
        {activeTab === "backtest" && <BacktestPage />}
      </div>
    </div>
  );
}
