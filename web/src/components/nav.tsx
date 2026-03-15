"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DataFreshness } from "@/components/data-freshness";

const links = [
  { href: "/", label: "Picks", exact: true },
  { href: "/thesis", label: "Research" },
  { href: "/performance", label: "Track Record" },
];

export function Nav() {
  const pathname = usePathname();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFreshness() {
      try {
        const res = await fetch("/api/feed/ingest");
        if (!res.ok) return;
        const data = await res.json();
        const recent = data.recentEvents?.[0];
        if (recent) setLastUpdated(recent.ingestedAt);
      } catch {
        // silent
      }
    }
    fetchFreshness();
    const id = setInterval(fetchFreshness, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="border-b border-pm-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-pm-text-primary">
          SignalTracker
        </Link>
        <div className="flex gap-1">
          {links.map(({ href, label, exact }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                isActive(href, exact)
                  ? "bg-pm-text-primary text-white"
                  : "text-pm-muted hover:bg-pm-bg-search hover:text-pm-text-primary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <DataFreshness lastUpdated={lastUpdated} />
          <Link
            href="/feed"
            className="text-pm-muted hover:text-pm-text-primary transition-colors"
            title="Pipeline Admin"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </div>
    </nav>
  );
}
