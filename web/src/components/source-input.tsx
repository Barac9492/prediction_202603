"use client";

import { useState } from "react";

interface Props {
  onSubmit: (data: { topic: string; urls: string[]; text: string }) => void;
  disabled?: boolean;
}

export function SourceInput({ onSubmit, disabled }: Props) {
  const [topic, setTopic] = useState("");
  const [urls, setUrls] = useState("");
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onSubmit({
      topic: topic.trim(),
      urls: urls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean),
      text: text.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-pm-text-primary">
          Topic
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., K-AI Fund launch timing"
          className="w-full rounded-md border border-pm-border bg-white px-3 py-2 text-pm-text-primary placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          disabled={disabled}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-pm-text-primary">
          Source URLs <span className="text-pm-text-secondary">(one per line)</span>
        </label>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          rows={3}
          placeholder="https://example.com/article"
          className="w-full rounded-md border border-pm-border bg-white px-3 py-2 text-pm-text-primary placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          disabled={disabled}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-pm-text-primary">
          Additional context{" "}
          <span className="text-pm-text-secondary">(optional text)</span>
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste meeting notes, reports, or other text..."
          className="w-full rounded-md border border-pm-border bg-white px-3 py-2 text-pm-text-primary placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          disabled={disabled}
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !topic.trim()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Analyzing..." : "Analyze"}
      </button>
    </form>
  );
}
