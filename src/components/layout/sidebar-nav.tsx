"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChartColumn,
  Cog,
  Factory,
  LayoutGrid,
  Megaphone,
  ShoppingBag,
  Search,
  Users,
  Umbrella
} from "lucide-react";

import type { DashboardAccessLevel } from "@/lib/access-control";
import { cn } from "@/lib/utils";

const adminNavigation = [
  { href: "/calendar", label: "Main Calendar", icon: Calendar },
  { href: "/calendar/personal", label: "Personal Calendar", icon: Users },
  { href: "/calendar/brand-campaign", label: "Brand Calendar", icon: LayoutGrid },
  { href: "/shopify", label: "Shopify", icon: ShoppingBag },
  { href: "/unleashed", label: "Unleashed", icon: Factory },
  { href: "/google-ads", label: "Google Ads", icon: Megaphone },
  { href: "/ga4", label: "GA4", icon: ChartColumn },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/holidays", label: "Holidays", icon: Umbrella },
  { href: "/settings", label: "Settings", icon: Cog }
];

const staffNavigation = [
  { href: "/calendar", label: "Personal Calendar", icon: Calendar },
  { href: "/holidays", label: "Holidays", icon: Umbrella }
];

const unleashedStaffNavigation = [
  { href: "/calendar", label: "Personal Calendar", icon: Calendar },
  { href: "/unleashed", label: "Unleashed", icon: Factory },
  { href: "/holidays", label: "Holidays", icon: Umbrella }
];

export function SidebarNav({ accessLevel = "full" }: { accessLevel?: DashboardAccessLevel }) {
  const pathname = usePathname();
  const navigation =
    accessLevel === "full"
      ? adminNavigation
      : accessLevel === "staff-unleashed"
        ? unleashedStaffNavigation
        : staffNavigation;

  return (
    <aside className="sticky top-0 hidden h-screen w-72 border-r border-white/25 bg-[#0396FF] px-5 py-8 text-white lg:block">
      <div className="mb-10 px-2">
        <img
          src="https://cdn.shopify.com/s/files/1/0991/4689/1610/files/new_thesnuslife_logotype.svg?v=1775047239"
          alt="The Snus Life"
          className="h-auto w-full max-w-[232px]"
        />
        <p className="mt-3 font-heading text-lg italic text-white">Operation Takeover</p>
      </div>

      <nav className="space-y-1.5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/calendar"
              ? pathname === "/calendar"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-white/25 text-white"
                  : "text-white hover:bg-white/15 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
