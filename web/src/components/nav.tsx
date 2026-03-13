"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/analyze", label: "Analyze" },
  { href: "/log", label: "Log" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/thesis", label: "Thesis" },
  { href: "/graph", label: "Graph" },
  { href: "/predictions", label: "Predictions" },
  { href: "/track-record", label: "Track Record" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center gap-8 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-white">
          SignalTracker
        </Link>
        <div className="flex gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith(href)
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
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
