"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/home", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/holidays", label: "Holidays" },
  { href: "/google-ads", label: "Ads" },
  { href: "/seo", label: "SEO" },
  { href: "/ga4", label: "GA4" },
  { href: "/unleashed", label: "Unleashed" },
  { href: "/settings", label: "Settings" }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="overflow-x-auto border-b border-white/15 bg-[#1f4f8f] px-4 py-3 lg:hidden">
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
              pathname === link.href || pathname.startsWith(`${link.href}/`)
                ? "bg-white/20 text-white"
                : "bg-white/10 text-white/90"
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
