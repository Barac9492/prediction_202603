"use client";
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
  createdAt: string;
}

const DIRECTION_COLORS: Record<string, string> = {
  bullish: "text-green-400 border-green-800 bg-green-950/30",
  bearish: "text-red-400 border-red-800 bg-red-950/30",
  neutral: "text-yellow-400 border-yellow-800 bg-yellow-950/30",
};

export default function ThesisPage() {
  const [theses, setTheses] = useState<Thesis[]>([]);
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

  useEffect(() => {
    fetch("/api/theses")
      .then((r) => r.json())
      .then((data) => {
        setTheses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      const thesis = await res.json();
      setTheses([thesis, ...theses]);
      setForm({ title: "", description: "", direction: "bullish", domain: "AI", tags: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function toggleActive(thesis: Thesis) {
    const res = await fetch("/api/theses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: thesis.id, isActive: !thesis.isActive }),
    });
    if (res.ok) {
      setTheses(theses.map((t) => (t.id === thesis.id ? { ...t, isActive: !t.isActive } : t)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Investment Theses</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Track hypotheses. News events are automatically connected to active theses.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Thesis"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-5 space-y-4"
        >
          <h2 className="font-semibold text-sm text-zinc-300">New Investment Thesis</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Title</label>
              <input
                required
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                placeholder="e.g. NVIDIA dominates AI inference compute"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <textarea
                required
                rows={3}
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                placeholder="Describe the thesis and what would confirm/deny it..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Direction</label>
              <select
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none"
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
              >
                <option value="bullish">Bullish</option>
                <option value="bearish">Bearish</option>
                <option value="neutral">Neutral / Watch</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Domain</label>
              <select
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none"
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              >
                <option value="AI">AI</option>
                <option value="Infra">Infrastructure</option>
                <option value="SaaS">SaaS</option>
                <option value="Semiconductor">Semiconductor</option>
                <option value="VC">VC/Funding</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Tags (comma-separated)</label>
              <input
                className="w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                placeholder="nvidia, inference, chips"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Create Thesis"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading theses...</div>
      ) : theses.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-500">
          <p className="text-lg mb-2">No theses yet</p>
          <p className="text-sm">Create your first investment thesis to start tracking signals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {theses.map((thesis) => (
            <div
              key={thesis.id}
              className={`rounded-lg border p-4 transition-opacity ${
                thesis.isActive ? "opacity-100" : "opacity-50"
              } border-zinc-800 bg-zinc-900/50`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        DIRECTION_COLORS[thesis.direction] || DIRECTION_COLORS.neutral
                      }`}
                    >
                      {thesis.direction.toUpperCase()}
                    </span>
                    <span className="text-xs text-zinc-500">{thesis.domain}</span>
                    {!thesis.isActive && (
                      <span className="text-xs text-zinc-600 border border-zinc-700 px-2 py-0.5 rounded">
                        ARCHIVED
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm mb-1">{thesis.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{thesis.description}</p>
                  {thesis.tags && thesis.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {thesis.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-zinc-600">#{thesis.id}</span>
                  <button
                    onClick={() => toggleActive(thesis)}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    {thesis.isActive ? "Archive" : "Restore"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
