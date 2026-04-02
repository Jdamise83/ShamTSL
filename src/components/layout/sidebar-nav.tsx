"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChartColumn,
  Cog,
  Factory,
  Home,
  Megaphone,
  Search,
  Umbrella
} from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/holidays", label: "Holidays", icon: Umbrella },
  { href: "/google-ads", label: "Google Ads", icon: Megaphone },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/ga4", label: "GA4", icon: ChartColumn },
  { href: "/unleashed", label: "Unleashed", icon: Factory },
  { href: "/settings", label: "Settings", icon: Cog }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 border-r border-border/80 bg-card px-5 py-8 lg:block">
      <div className="mb-10 px-2">
        <img
          src="https://cdn.shopify.com/s/files/1/0991/4689/1610/files/new_thesnuslife_logotype.svg?v=1775047239"
          alt="The Snus Life"
          className="h-10 w-auto"
        />

        <p className="mt-2 text-sm text-muted-foreground">
          The Snus Life Takeover
        </p>
      </div>

      <nav className="space-y-1.5">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
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