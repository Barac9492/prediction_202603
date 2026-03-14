"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/overview", label: "Overview" },
  { href: "/thesis", label: "Theses" },
  { href: "/graph", label: "Graph" },
  { href: "/track-record", label: "Performance" },
  { href: "/ops", label: "Operations" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-pm-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-pm-text-primary">
          SignalTracker
        </Link>
        <div className="flex gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith(href)
                  ? "bg-pm-text-primary text-white"
                  : "text-pm-muted hover:bg-pm-bg-search hover:text-pm-text-primary"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
