'use client';
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { OverdueThesesBanner } from "@/components/overdue-theses-banner";

interface Thesis {
  id: number;
  title: string;
  description: string;
  direction: string;
  domain: string;
  tags: string[];
  isActive: boolean;
  status: string;
  aiRationale?: string;
  createdAt: string;
}

interface ThesisInteraction {
  id: number;
  fromId: number;
  toId: number;
  relation: string;
  confidence: number;
  reasoning: string;
}

interface MarketSignal {
  id: number;
  confidence: number;
  reasoning: string;
  fromId: number;
}

interface ThesisExtra {
  interactions: ThesisInteraction[];
  marketSignals: MarketSignal[];
  modelProbability: number | null;
  marketProbability: number | null;
}

const DIRECTION_COLORS: Record<string, string> = {
  bullish: "text-green-700 border-green-200 bg-green-50",
  bearish: "text-red-700 border-red-200 bg-red-50",
  neutral: "text-yellow-700 border-yellow-200 bg-yellow-50",
};

export default function ThesisPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [pendingTheses, setPendingTheses] = useState<Thesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    direction: "bullish",
    domain: "AI",
    tags: "",
    deadline: "",
    resolutionCriteria: "",
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState("");
  const [thesisExtras, setThesisExtras] = useState<Record<number, ThesisExtra>>({});
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolvingWith, setResolvingWith] = useState<{ id: number; wasCorrect: boolean } | null>(null);
  const [resolveSource, setResolveSource] = useState("");

  const fetchThesisExtras = async (activeTheses: Thesis[]) => {
    const extras: Record<number, ThesisExtra> = {};
    await Promise.all(
      activeTheses.map(async (t) => {
        try {
          const res = await fetch(`/api/theses/${t.id}/extras`);
          if (res.ok) {
            extras[t.id] = await res.json();
          }
        } catch { /* ignore */ }
      })
    );
    setThesisExtras(extras);
  };

  const fetchTheses = () => {
    setLoading(true);
    fetch("/api/theses")
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        const active = all.filter((t: Thesis) => t.status === "active" || (!t.status && t.isActive));
        setTheses(active);
        setPendingTheses(all.filter((t: Thesis) => t.status === "pending_review"));
        setLoading(false);
        fetchThesisExtras(active);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTheses();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/theses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        direction: form.direction,
        domain: form.domain,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        isActive: true,
        status: "active",
        ...(form.deadline && { deadline: form.deadline }),
        ...(form.resolutionCriteria && { resolutionCriteria: form.resolutionCriteria }),
      }),
    });
    if (res.ok) {
      setForm({ title: "", description: "", direction: "bullish", domain: "AI", tags: "", deadline: "", resolutionCriteria: "" });
      setShowForm(false);
      fetchTheses();
    }
    setSaving(false);
  }

  async function handleArchive(id: number) {
    await fetch("/api/theses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: false, status: "archived" }),
    });
    fetchTheses();
  }

  async function handleApprove(id: number) {
    await fetch("/api/theses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: true, status: "active" }),
    });
    fetchTheses();
  }

  async function handleDecline(id: number) {
    await fetch("/api/theses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: false, status: "archived" }),
    });
    fetchTheses();
  }

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestMsg("");
    const res = await fetch("/api/theses/suggest", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSuggestMsg(`checked ${data.suggested} thesis suggestions added to review queue.`);
      fetchTheses();
    } else {
      setSuggestMsg(`error ${data.error || "Failed to suggest theses."}`);
    }
    setSuggesting(false);
  }

  function startResolve(id: number, wasCorrect: boolean) {
    setResolvingWith({ id, wasCorrect });
    setResolveSource("");
  }

  async function confirmResolve() {
    if (!resolvingWith) return;
    setResolving(resolvingWith.id);
    await fetch("/api/theses/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: resolvingWith.id,
        wasCorrect: resolvingWith.wasCorrect,
        ...(resolveSource && { resolutionSource: resolveSource }),
      }),
    });
    setResolving(null);
    setResolvingWith(null);
    setResolveSource("");
    fetchTheses();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investment Theses</h1>
          <p className="text-pm-muted text-sm mt-1">Track and manage your AI investment hypotheses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {suggesting ? "Analyzing..." : "Suggest from News"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-pm-text-primary hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Thesis
          </button>
        </div>
      </div>

      <OverdueThesesBanner />

      {suggestMsg && (
        <div className="text-sm px-4 py-2 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">
          {suggestMsg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-pm-border bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider">New Thesis</h2>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full bg-white border border-pm-border rounded px-3 py-2 text-sm" />
          <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className="w-full bg-white border border-pm-border rounded px-3 py-2 text-sm" />
          <div className="flex gap-3">
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="bg-white border border-pm-border rounded px-3 py-2 text-sm">
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="Domain" className="bg-white border border-pm-border rounded px-3 py-2 text-sm w-32" />
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma-separated)" className="flex-1 bg-white border border-pm-border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="bg-white border border-pm-border rounded px-3 py-2 text-sm" placeholder="Deadline" />
            <input value={form.resolutionCriteria} onChange={(e) => setForm({ ...form, resolutionCriteria: e.target.value })} placeholder="How will you verify this?" className="flex-1 bg-white border border-pm-border rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-pm-muted hover:text-pm-text-primary">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save Thesis"}</button>
          </div>
        </form>
      )}

      {pendingTheses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-violet-600 uppercase tracking-wider">
            AI Suggestions - {pendingTheses.length} pending review
          </h2>
          {pendingTheses.map((t) => (
            <div key={t.id} className="rounded-lg border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={"text-xs px-2 py-0.5 rounded border " + (DIRECTION_COLORS[t.direction] ?? DIRECTION_COLORS.neutral)}>
                      {t.direction}
                    </span>
                    <span className="text-xs text-pm-text-secondary">{t.domain}</span>
                    {t.tags?.map((tag) => (
                      <span key={tag} className="text-xs bg-white text-pm-muted px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                  <h3 className="font-medium text-sm">{t.title}</h3>
                  <p className="text-xs text-pm-muted mt-1">{t.description}</p>
                  {t.aiRationale && (
                    <p className="text-xs text-violet-600 mt-1.5 italic">AI: {t.aiRationale}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => handleApprove(t.id)}
                    className="px-3 py-1 text-xs bg-green-800 hover:bg-green-700 text-white rounded transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleDecline(t.id)}
                    className="px-3 py-1 text-xs bg-pm-text-primary hover:bg-red-100 text-white rounded transition-colors">
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-pm-muted uppercase tracking-wider">
          Active Theses ({theses.length})
        </h2>
        {loading ? (
          <div className="text-pm-text-secondary text-sm">Loading...</div>
        ) : theses.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-white p-8 text-center text-pm-text-secondary">
            <p className="text-lg mb-2">No theses yet</p>
            <p className="text-sm">Click Suggest from News or add one manually.</p>
          </div>
        ) : (
          theses.map((t) => {
            const extras = thesisExtras[t.id];
            return (
              <div key={t.id} className="rounded-lg border border-pm-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={"text-xs px-2 py-0.5 rounded border " + (DIRECTION_COLORS[t.direction] ?? DIRECTION_COLORS.neutral)}>
                        {t.direction}
                      </span>
                      <span className="text-xs text-pm-text-secondary">{t.domain}</span>
                      {t.tags?.map((tag) => (
                        <span key={tag} className="text-xs bg-white text-pm-muted px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                      {extras?.modelProbability != null && (
                        <span className="text-xs text-blue-400">
                          Model: {(extras.modelProbability * 100).toFixed(0)}%
                        </span>
                      )}
                      {extras?.marketProbability != null && (
                        <span className="text-xs text-amber-400">
                          Market: {(extras.marketProbability * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm">{t.title}</h3>
                    <p className="text-xs text-pm-muted mt-1">{t.description}</p>
                    <p className="text-xs text-pm-text-secondary mt-1.5">Created {new Date(t.createdAt).toLocaleDateString()}</p>

                    {extras?.interactions && extras.interactions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-pm-border">
                        <p className="text-xs text-pm-text-secondary font-medium mb-1">Related Theses</p>
                        {extras.interactions.map((inter) => {
                          const linkedId = inter.fromId === t.id ? inter.toId : inter.fromId;
                          const linkedThesis = theses.find((th) => th.id === linkedId);
                          return (
                            <div key={inter.id} className="text-xs text-pm-muted flex items-center gap-1.5 mb-0.5">
                              <span className={inter.relation === "REINFORCES" ? "text-green-500" : "text-red-500"}>
                                {inter.relation}
                              </span>
                              <span>{linkedThesis?.title ?? `Thesis #${linkedId}`}</span>
                              <span className="text-pm-text-meta">({(inter.confidence * 100).toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {extras?.marketSignals && extras.marketSignals.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-pm-border">
                        <p className="text-xs text-pm-text-secondary font-medium mb-1">Market Signals</p>
                        {extras.marketSignals.map((ms) => (
                          <div key={ms.id} className="text-xs text-amber-400 mb-0.5">
                            {ms.reasoning} — {(ms.confidence * 100).toFixed(0)}%
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 mt-1">
                    {resolvingWith?.id === t.id ? (
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-pm-muted">
                          {resolvingWith.wasCorrect ? "Marking correct" : "Marking incorrect"}
                        </p>
                        <input
                          value={resolveSource}
                          onChange={(e) => setResolveSource(e.target.value)}
                          placeholder="Source URL/note (optional)"
                          className="text-xs bg-white border border-pm-border rounded px-2 py-1 w-48"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={confirmResolve}
                            disabled={resolving === t.id}
                            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                          >
                            {resolving === t.id ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setResolvingWith(null)}
                            className="text-xs px-2 py-1 text-pm-muted hover:text-pm-text-primary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => startResolve(t.id, true)}
                          className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors"
                        >
                          Correct
                        </button>
                        <button
                          onClick={() => startResolve(t.id, false)}
                          className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded transition-colors"
                        >
                          Incorrect
                        </button>
                        <button onClick={() => handleArchive(t.id)}
                          className="text-xs text-pm-text-meta hover:text-red-600 transition-colors">Archive</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
