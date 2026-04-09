"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardAccessLevel } from "@/lib/access-control";
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
  { href: "/calendar", label: "Personal" },
  { href: "/holidays", label: "Holidays" }
];

const unleashedStaffLinks = [
  { href: "/calendar", label: "Personal" },
  { href: "/unleashed", label: "Unleashed" },
  { href: "/holidays", label: "Holidays" }
];

export function MobileNav({ accessLevel = "full" }: { accessLevel?: DashboardAccessLevel }) {
  const pathname = usePathname();
  const links =
    accessLevel === "full" ? adminLinks : accessLevel === "staff-unleashed" ? unleashedStaffLinks : staffLinks;

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
