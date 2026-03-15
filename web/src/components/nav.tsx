"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

let ClerkComponents: {
  UserButton: React.ComponentType;
  OrganizationSwitcher: React.ComponentType<{ appearance?: unknown }>;
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clerk = require("@clerk/nextjs");
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_")) {
    ClerkComponents = {
      UserButton: clerk.UserButton,
      OrganizationSwitcher: clerk.OrganizationSwitcher,
    };
  }
} catch {
  // Clerk not available
}

const links = [
  { href: "/briefing", label: "Briefing" },
  { href: "/thesis", label: "Research" },
  { href: "/recommendations", label: "Picks" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/performance", label: "Track Record" },
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
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/settings/billing"
            className="text-sm text-pm-muted hover:text-pm-text-primary transition-colors"
          >
            Settings
          </Link>
          {ClerkComponents ? (
            <>
              <ClerkComponents.OrganizationSwitcher
                appearance={{
                  elements: { rootBox: "flex items-center" },
                }}
              />
              <ClerkComponents.UserButton />
            </>
          ) : (
            <span className="text-xs text-pm-muted">[Dev Mode]</span>
          )}
        </div>
      </div>
    </nav>
  );
}
