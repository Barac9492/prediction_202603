"use client";

import { useState } from "react";
import { resolveAction } from "@/lib/actions/resolve";

interface Props {
  predictionId: number;
  currentOutcome: string | null;
}

export function ResolveDialog({ predictionId, currentOutcome }: Props) {
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  if (currentOutcome) {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
        <p className="text-sm text-zinc-400">
          Resolved:{" "}
          <span className="font-medium text-white">{currentOutcome}</span>
        </p>
      </div>
    );
  }

  async function handleResolve() {
    if (!outcome) return;
    setSaving(true);
    await resolveAction(predictionId, outcome, notes);
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
      >
        Resolve
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-zinc-700 bg-zinc-900 p-4">
      <p className="text-sm font-medium text-zinc-300">
        What was the actual outcome?
      </p>
      <div className="flex gap-2">
        {(["bullish", "bearish", "neutral"] as const).map((o) => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              outcome === o
                ? o === "bullish"
                  ? "bg-green-600 text-white"
                  : o === "bearish"
                    ? "bg-red-600 text-white"
                    : "bg-yellow-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
      />
      <div className="flex gap-2">
        <button
          onClick={handleResolve}
          disabled={!outcome || saving}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
