"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/calendar", label: "Main Cal" },
  { href: "/calendar/personal", label: "Personal Cal" },
  { href: "/calendar/brand-campaign", label: "Brand Cal" },
  { href: "/shopify", label: "Shopify" },
  { href: "/unleashed", label: "Unleashed" },
  { href: "/google-ads", label: "Ads" },
  { href: "/ga4", label: "GA4" },
  { href: "/seo", label: "SEO" },
  { href: "/holidays", label: "Holidays" },
  { href: "/settings", label: "Settings" }
];

const staffLinks = [
  { href: "/calendar", label: "My Cal" },
  { href: "/shopify", label: "Shopify" },
  { href: "/unleashed", label: "Unleashed" },
  { href: "/google-ads", label: "Ads" },
  { href: "/ga4", label: "GA4" },
  { href: "/seo", label: "SEO" },
  { href: "/holidays", label: "Holidays" },
  { href: "/settings", label: "Settings" }
];

export function MobileNav({ role = "admin" }: { role?: "staff" | "admin" }) {
  const pathname = usePathname();
  const links = role === "staff" ? staffLinks : adminLinks;

  return (
    <div className="overflow-x-auto border-b border-border bg-card px-4 py-3 lg:hidden">
      <div className="flex min-w-max gap-2">
        {links.map((link) => {
          const active =
            link.href === "/calendar"
              ? pathname === "/calendar"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                active
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
