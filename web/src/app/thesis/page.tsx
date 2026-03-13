'use client';
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";

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
  bullish: "text-green-400 border-green-800 bg-green-950/30",
  bearish: "text-red-400 border-red-800 bg-red-950/30",
  neutral: "text-yellow-400 border-yellow-800 bg-yellow-950/30",
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
  });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState("");
  const [thesisExtras, setThesisExtras] = useState<Record<number, ThesisExtra>>({});
  const [resolving, setResolving] = useState<number | null>(null);

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
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        isActive: true,
        status: "active",
      }),
    });
    if (res.ok) {
      setForm({ title: "", description: "", direction: "bullish", domain: "AI", tags: "" });
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

  async function handleResolve(id: number, wasCorrect: boolean) {
    setResolving(id);
    await fetch("/api/theses/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, wasCorrect }),
    });
    setResolving(null);
    fetchTheses();
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investment Theses</h1>
          <p className="text-zinc-400 text-sm mt-1">Track and manage your AI investment hypotheses</p>
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
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Thesis
          </button>
        </div>
      </div>

      {suggestMsg && (
        <div className="text-sm px-4 py-2 rounded-lg bg-violet-950 text-violet-300 border border-violet-800">
          {suggestMsg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">New Thesis</h2>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
          <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
          <div className="flex gap-3">
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
              <option value="neutral">Neutral</option>
            </select>
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="Domain" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm w-32" />
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma-separated)" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors disabled:opacity-50">{saving ? "Saving..." : "Save Thesis"}</button>
          </div>
        </form>
      )}

      {pendingTheses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-violet-400 uppercase tracking-wider">
            AI Suggestions - {pendingTheses.length} pending review
          </h2>
          {pendingTheses.map((t) => (
            <div key={t.id} className="rounded-lg border border-violet-800 bg-violet-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={"text-xs px-2 py-0.5 rounded border " + (DIRECTION_COLORS[t.direction] ?? DIRECTION_COLORS.neutral)}>
                      {t.direction}
                    </span>
                    <span className="text-xs text-zinc-500">{t.domain}</span>
                    {t.tags?.map((tag) => (
                      <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                  <h3 className="font-medium text-sm">{t.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{t.description}</p>
                  {t.aiRationale && (
                    <p className="text-xs text-violet-400 mt-1.5 italic">AI: {t.aiRationale}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => handleApprove(t.id)}
                    className="px-3 py-1 text-xs bg-green-800 hover:bg-green-700 text-white rounded transition-colors">
                    Approve
                  </button>
                  <button onClick={() => handleDecline(t.id)}
                    className="px-3 py-1 text-xs bg-zinc-700 hover:bg-red-900 text-white rounded transition-colors">
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Active Theses ({theses.length})
        </h2>
        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : theses.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-500">
            <p className="text-lg mb-2">No theses yet</p>
            <p className="text-sm">Click Suggest from News or add one manually.</p>
          </div>
        ) : (
          theses.map((t) => {
            const extras = thesisExtras[t.id];
            return (
              <div key={t.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={"text-xs px-2 py-0.5 rounded border " + (DIRECTION_COLORS[t.direction] ?? DIRECTION_COLORS.neutral)}>
                        {t.direction}
                      </span>
                      <span className="text-xs text-zinc-500">{t.domain}</span>
                      {t.tags?.map((tag) => (
                        <span key={tag} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{tag}</span>
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
                    <p className="text-xs text-zinc-400 mt-1">{t.description}</p>
                    <p className="text-xs text-zinc-500 mt-1.5">Created {new Date(t.createdAt).toLocaleDateString()}</p>

                    {extras?.interactions && extras.interactions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 font-medium mb-1">Related Theses</p>
                        {extras.interactions.map((inter) => {
                          const linkedId = inter.fromId === t.id ? inter.toId : inter.fromId;
                          const linkedThesis = theses.find((th) => th.id === linkedId);
                          return (
                            <div key={inter.id} className="text-xs text-zinc-400 flex items-center gap-1.5 mb-0.5">
                              <span className={inter.relation === "REINFORCES" ? "text-green-500" : "text-red-500"}>
                                {inter.relation}
                              </span>
                              <span>{linkedThesis?.title ?? `Thesis #${linkedId}`}</span>
                              <span className="text-zinc-600">({(inter.confidence * 100).toFixed(0)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {extras?.marketSignals && extras.marketSignals.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 font-medium mb-1">Market Signals</p>
                        {extras.marketSignals.map((ms) => (
                          <div key={ms.id} className="text-xs text-amber-400 mb-0.5">
                            {ms.reasoning} — {(ms.confidence * 100).toFixed(0)}%
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0 mt-1">
                    <button
                      onClick={() => handleResolve(t.id, true)}
                      disabled={resolving === t.id}
                      className="text-xs px-2 py-1 bg-green-900/50 hover:bg-green-800 text-green-400 rounded transition-colors disabled:opacity-50"
                    >
                      {resolving === t.id ? "..." : "Correct"}
                    </button>
                    <button
                      onClick={() => handleResolve(t.id, false)}
                      disabled={resolving === t.id}
                      className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-400 rounded transition-colors disabled:opacity-50"
                    >
                      {resolving === t.id ? "..." : "Incorrect"}
                    </button>
                    <button onClick={() => handleArchive(t.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Archive</button>
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
