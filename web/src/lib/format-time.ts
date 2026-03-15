type DateInput = Date | string | null | undefined;

function toDate(d: DateInput): Date | null {
  if (!d) return null;
  return d instanceof Date ? d : new Date(d);
}

export function timeAgo(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "";
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days <= 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function shortDate(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isStale(d: DateInput, thresholdHours: number): boolean {
  const date = toDate(d);
  if (!date) return true;
  const diff = Date.now() - date.getTime();
  return diff > thresholdHours * 60 * 60 * 1000;
}
